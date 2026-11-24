// Staff API: /api/staff/<route>. Requires a Supabase Auth access token with
// MFA satisfied (aal2) belonging to an active row in portal_staff.
//
//   GET    me
//   GET    templates
//   GET    requests
//   POST   requests                 create draft
//   GET    requests/:id             detail (files + recent audit)
//   PATCH  requests/:id             edit draft/open request text
//   POST   requests/:id/issue       generate (or rotate) invite link; opens request
//   POST   requests/:id/close       close or revoke
//   POST   files/:id/download       60-second signed URL for a clean file
//   POST   files/:id/rescan
//   DELETE files/:id

const { getEnv } = require('./lib/env');
const { serviceClient, audit, removeObject } = require('./lib/supabase');
const { randomToken, sha256, generateReference } = require('./lib/crypto');
const { json, parseBody, header, originAllowed, routeOf } = require('./lib/http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function authenticateStaff(db, event) {
  const auth = header(event, 'authorization');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: json(401, { ok: false, code: 'unauthenticated' }) };
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return { error: json(401, { ok: false, code: 'unauthenticated' }) };
  const claims = decodeJwtPayload(token) || {};
  if (claims.aal !== 'aal2') return { error: json(403, { ok: false, code: 'mfa_required', error: 'Multi-factor authentication is required.' }) };
  const { data: staff } = await db.from('portal_staff').select('*').eq('user_id', data.user.id).eq('is_active', true).maybeSingle();
  if (!staff) return { error: json(403, { ok: false, code: 'not_staff', error: 'This account is not authorized for the portal.' }) };
  return { user: data.user, staff };
}

function sanitizeChecklist(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((g) => ({
    group: String((g && g.group) || '').slice(0, 120),
    items: Array.isArray(g && g.items) ? g.items.slice(0, 60).map((it) => ({
      label: String((it && it.label) || '').slice(0, 300),
      note: String((it && it.note) || '').slice(0, 300),
    })).filter((it) => it.label) : [],
  })).filter((g) => g.items.length);
}

function fileView(f) {
  return {
    id: f.id,
    originalName: f.original_name,
    description: f.description || '',
    extension: f.extension,
    size: f.actual_size != null ? Number(f.actual_size) : Number(f.declared_size),
    status: f.status,
    rejectionReason: f.rejection_reason,
    detectedType: f.detected_type,
    uploadedAt: f.uploaded_at,
    scannedAt: f.scanned_at,
    scanProvider: f.scan_provider,
    serverScanned: f.status === 'clean' && !(f.scan_result && f.scan_result.serverScan === false),
    scanAttempts: f.scan_attempts,
    createdAt: f.created_at,
    deletedAt: f.deleted_at,
  };
}

function requestView(r, counts) {
  return {
    id: r.id,
    reference: r.reference,
    orgName: r.org_name,
    purpose: r.purpose,
    recipientEmail: r.recipient_email,
    instructions: r.instructions,
    checklist: r.checklist,
    status: r.status,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    closeReason: r.close_reason,
    limits: { maxFileBytes: Number(r.max_file_bytes), maxTotalBytes: Number(r.max_total_bytes), allowedTypes: r.allowed_types },
    counts: counts || undefined,
  };
}

// ---------------------------------------------------------------------------

async function listTemplates(db) {
  const { data } = await db.from('portal_templates').select('slug,name,purpose,instructions,checklist').order('name');
  return json(200, { ok: true, templates: data || [] });
}

async function listRequests(db) {
  const { data: reqs } = await db.from('portal_requests').select('*').order('created_at', { ascending: false }).limit(200);
  const ids = (reqs || []).map((r) => r.id);
  const counts = {};
  if (ids.length) {
    const { data: files } = await db.from('portal_files').select('request_id,status').in('request_id', ids);
    for (const f of files || []) {
      counts[f.request_id] = counts[f.request_id] || {};
      counts[f.request_id][f.status] = (counts[f.request_id][f.status] || 0) + 1;
    }
  }
  return json(200, { ok: true, requests: (reqs || []).map((r) => requestView(r, counts[r.id] || {})) });
}

async function createRequest(db, env, user, body) {
  const orgName = String(body.orgName || '').trim().slice(0, 200);
  const purpose = String(body.purpose || '').trim().slice(0, 200);
  const email = String(body.recipientEmail || '').trim().toLowerCase();
  if (!orgName || !purpose) return json(422, { ok: false, error: 'Organization and purpose are required.' });
  if (!EMAIL_RE.test(email) || email.length > 254) return json(422, { ok: false, error: 'A valid recipient email is required.' });
  const expiryDays = Math.min(60, Math.max(1, Number.parseInt(body.expiryDays, 10) || env.defaultExpiryDays));

  let reference;
  let row;
  for (let i = 0; i < 5 && !row; i++) {
    reference = generateReference();
    const { data, error } = await db.from('portal_requests').insert({
      reference,
      org_name: orgName,
      purpose,
      recipient_email: email,
      instructions: String(body.instructions || '').slice(0, 4000),
      checklist: sanitizeChecklist(body.checklist),
      status: 'draft',
      expires_at: new Date(Date.now() + expiryDays * 86400 * 1000).toISOString(),
      max_file_bytes: env.defaultMaxFileBytes,
      max_total_bytes: env.defaultMaxTotalBytes,
      allowed_types: env.defaultAllowedTypes,
      created_by: user.id,
    }).select('*').single();
    if (!error) row = data;
    else if (!/duplicate/i.test(error.message)) return json(500, { ok: false, error: 'Could not create the request.' });
  }
  if (!row) return json(500, { ok: false, error: 'Could not create the request.' });
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: row.id, event: 'request_created' });
  return json(201, { ok: true, request: requestView(row) });
}

async function getRequest(db, id) {
  const { data: r } = await db.from('portal_requests').select('*').eq('id', id).maybeSingle();
  if (!r) return json(404, { ok: false });
  const { data: files } = await db.from('portal_files').select('*').eq('request_id', id).neq('status', 'reserved').order('created_at');
  const { data: events } = await db.from('portal_audit').select('at,actor_type,event,detail,file_id').eq('request_id', id).order('at', { ascending: false }).limit(50);
  return json(200, { ok: true, request: requestView(r), files: (files || []).map(fileView), audit: events || [] });
}

async function patchRequest(db, user, id, body) {
  const { data: r } = await db.from('portal_requests').select('id,status').eq('id', id).maybeSingle();
  if (!r) return json(404, { ok: false });
  if (!['draft', 'open'].includes(r.status)) return json(409, { ok: false, error: 'Closed requests cannot be edited.' });
  const patch = {};
  if (body.orgName !== undefined) patch.org_name = String(body.orgName).trim().slice(0, 200);
  if (body.purpose !== undefined) patch.purpose = String(body.purpose).trim().slice(0, 200);
  if (body.instructions !== undefined) patch.instructions = String(body.instructions).slice(0, 4000);
  if (body.checklist !== undefined) patch.checklist = sanitizeChecklist(body.checklist);
  if (body.recipientEmail !== undefined) {
    if (r.status !== 'draft') return json(409, { ok: false, error: 'The recipient cannot change once the link is issued. Close this request and create a new one.' });
    const email = String(body.recipientEmail).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json(422, { ok: false, error: 'A valid recipient email is required.' });
    patch.recipient_email = email;
  }
  const { data } = await db.from('portal_requests').update(patch).eq('id', id).select('*').single();
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: id, event: 'request_edited', detail: { fields: Object.keys(patch) } });
  return json(200, { ok: true, request: requestView(data) });
}

async function issueRequest(db, env, user, id, body) {
  const { data: r } = await db.from('portal_requests').select('*').eq('id', id).maybeSingle();
  if (!r) return json(404, { ok: false });
  if (!['draft', 'open'].includes(r.status)) return json(409, { ok: false, error: 'This request is closed. Create a new one instead.' });
  const expiryDays = Math.min(60, Math.max(1, Number.parseInt(body.expiryDays, 10) || env.defaultExpiryDays));
  const token = randomToken(32);
  const rotated = r.status === 'open';
  const { error } = await db.from('portal_requests').update({
    status: 'open',
    invite_token_hash: sha256(token),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + expiryDays * 86400 * 1000).toISOString(),
  }).eq('id', id);
  if (error) return json(500, { ok: false, error: 'Could not issue the link.' });
  if (rotated) {
    await db.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('request_id', id).is('revoked_at', null);
  }
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: id, event: rotated ? 'link_rotated' : 'request_issued', detail: { expiryDays } });
  const base = env.siteUrl || '';
  return json(200, { ok: true, inviteUrl: `${base}/upload/?r=${token}`, expiryDays });
}

async function closeRequest(db, user, id, body) {
  const { data: r } = await db.from('portal_requests').select('id,status').eq('id', id).maybeSingle();
  if (!r) return json(404, { ok: false });
  if (!['draft', 'open'].includes(r.status)) return json(200, { ok: true });
  const revoke = body.revoke === true;
  await db.from('portal_requests').update({
    status: revoke ? 'revoked' : 'closed',
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    close_reason: String(body.reason || (revoke ? 'revoked' : 'closed')).slice(0, 200),
    invite_token_hash: null,
  }).eq('id', id);
  await db.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('request_id', id).is('revoked_at', null);
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: id, event: revoke ? 'request_revoked' : 'request_closed' });
  return json(200, { ok: true });
}

async function downloadFile(db, env, user, id) {
  const { data: f } = await db.from('portal_files').select('*').eq('id', id).maybeSingle();
  if (!f) return json(404, { ok: false });
  if (f.status !== 'clean') return json(409, { ok: false, error: 'Only files that passed scanning can be downloaded.' });
  const { data, error } = await db.storage.from(env.bucket).createSignedUrl(f.object_key, env.downloadUrlSeconds, { download: f.original_name });
  if (error || !data) return json(500, { ok: false, error: 'Could not create a download link.' });
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: f.request_id, fileId: f.id, event: 'file_downloaded' });
  return json(200, { ok: true, url: data.signedUrl, expiresIn: env.downloadUrlSeconds });
}

async function rescanFile(db, env, user, id) {
  const { data: f } = await db.from('portal_files').select('*').eq('id', id).maybeSingle();
  if (!f) return json(404, { ok: false });
  if (!['scan_failed', 'pending_scan'].includes(f.status)) return json(409, { ok: false, error: 'Only files whose scan failed can be rescanned.' });
  await db.from('portal_files').update({ status: 'pending_scan' }).eq('id', id);
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: f.request_id, fileId: f.id, event: 'rescan_requested' });
  if (env.siteUrl && env.internalSecret) {
    await fetch(`${env.siteUrl}/.netlify/functions/portal-scan-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-internal': env.internalSecret },
      body: JSON.stringify({ fileId: id }),
    }).catch((e) => console.error('rescan trigger failed', e.message));
  }
  return json(200, { ok: true });
}

async function deleteFile(db, env, user, id) {
  const { data: f } = await db.from('portal_files').select('*').eq('id', id).maybeSingle();
  if (!f) return json(404, { ok: false });
  if (f.object_key !== 'pending') await removeObject(db, env.bucket, f.object_key).catch(() => {});
  await db.from('portal_files').update({ status: 'deleted', deleted_at: new Date().toISOString(), deleted_by: user.id }).eq('id', id);
  await audit(db, { actorType: 'staff', actorId: user.id, requestId: f.request_id, fileId: f.id, event: 'file_deleted' });
  return json(200, { ok: true });
}

// ---------------------------------------------------------------------------

exports.handler = async function (event) {
  const env = getEnv();
  if (env.mode === 'off') return json(503, { ok: false, error: 'The portal is switched off.' });

  const route = routeOf(event, 'staff');
  const method = event.httpMethod;
  const parts = route.split('/').filter(Boolean);

  // Public, non-secret browser config for the staff console sign-in.
  if (method === 'GET' && route === 'config') {
    return json(200, { ok: true, supabaseUrl: env.supabaseUrl, publishableKey: env.supabasePublishableKey, mode: env.mode, scanner: env.scannerProvider });
  }

  let db;
  try {
    db = serviceClient();
  } catch (err) {
    console.error(err.message);
    return json(503, { ok: false, error: 'The portal is not configured.' });
  }

  try {
    const auth = await authenticateStaff(db, event);
    if (auth.error) return auth.error;
    const { user } = auth;

    if (method !== 'GET' && !originAllowed(event, env.siteUrl)) return json(403, { ok: false, error: 'Cross-site request refused.' });
    const body = method === 'GET' ? {} : parseBody(event);
    if (body === null) return json(400, { ok: false, error: 'Invalid request body.' });

    if (method === 'GET' && route === 'me') return json(200, { ok: true, email: user.email, mode: env.mode, siteUrl: env.siteUrl });
    if (method === 'GET' && route === 'templates') return await listTemplates(db);
    if (method === 'GET' && route === 'requests') return await listRequests(db);
    if (method === 'POST' && route === 'requests') return await createRequest(db, env, user, body);

    if (parts[0] === 'requests' && parts[1]) {
      const id = parts[1];
      if (method === 'GET' && parts.length === 2) return await getRequest(db, id);
      if (method === 'PATCH' && parts.length === 2) return await patchRequest(db, user, id, body);
      if (method === 'POST' && parts[2] === 'issue') return await issueRequest(db, env, user, id, body);
      if (method === 'POST' && parts[2] === 'close') return await closeRequest(db, user, id, body);
    }
    if (parts[0] === 'files' && parts[1]) {
      const id = parts[1];
      if (method === 'POST' && parts[2] === 'download') return await downloadFile(db, env, user, id);
      if (method === 'POST' && parts[2] === 'rescan') return await rescanFile(db, env, user, id);
      if (method === 'DELETE' && parts.length === 2) return await deleteFile(db, env, user, id);
    }
    return json(404, { ok: false });
  } catch (err) {
    console.error('staff error', route, err && err.message);
    return json(500, { ok: false, error: 'Something went wrong.' });
  }
};
