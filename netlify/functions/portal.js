// Client-facing portal API: /api/portal/<route>
//
//   POST lookup       { token }            -> { ok, emailHint }
//   POST send-code    { token }            -> { ok }
//   POST verify-code  { token, code }      -> { ok, csrf, context }  (sets session cookie)
//   GET  session                           -> { ok, context }
//   POST grant        { filename, size, mime } -> { ok, fileId, upload }
//   POST finalize     { fileId }           -> { ok, status, reason? }
//   POST batch-done                        -> { ok }
//   POST logout                            -> { ok }
//
// Every failure before verification returns the same generic error. All
// writes after verification require the session cookie, a CSRF header that
// matches the session, and a same-origin Origin header.

const { getEnv } = require('./lib/env');
const { serviceClient, audit, rateLimit, fetchObjectRange, statObject, removeObject } = require('./lib/supabase');
const { randomToken, sha256, hashIp, generateOtp, safeEqualHex } = require('./lib/crypto');
const { json, genericError, parseBody, header, clientIp, parseCookies, cookieHeader, originAllowed, routeOf } = require('./lib/http');
const { sendEmail, otpMessage, receiptMessage } = require('./lib/email');
const { sanitizeFilename, validateDeclaredFile, mimeForExtension, verifyStoredObject } = require('./lib/files');

const COOKIE = 'crown_portal';
const COOKIE_PATH = '/api/portal';
const SNIFF_BYTES = 4096;

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

function requestIsOpen(req, now = Date.now()) {
  return req && req.status === 'open' && new Date(req.expires_at).getTime() > now;
}

function publicContext(req) {
  return {
    reference: req.reference,
    orgName: req.org_name,
    purpose: req.purpose,
    instructions: req.instructions,
    checklist: req.checklist,
    expiresAt: req.expires_at,
    limits: {
      maxFileBytes: Number(req.max_file_bytes),
      maxTotalBytes: Number(req.max_total_bytes),
      allowedTypes: req.allowed_types,
    },
  };
}

async function findRequestByToken(db, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const { data } = await db
    .from('portal_requests')
    .select('*')
    .eq('invite_token_hash', sha256(token))
    .maybeSingle();
  return data || null;
}

async function loadSession(db, event) {
  const cookies = parseCookies(event);
  const raw = cookies[COOKIE];
  if (!raw || raw.length < 20) return null;
  const { data: session } = await db
    .from('portal_sessions')
    .select('*')
    .eq('token_hash', sha256(raw))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!session) return null;
  const { data: req } = await db.from('portal_requests').select('*').eq('id', session.request_id).maybeSingle();
  if (!req) return null;
  return { session, req };
}

function csrfOk(event, session) {
  const sent = header(event, 'x-csrf-token');
  return !!sent && safeEqualHex(sha256(sent), session.csrf_hash);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleLookup(db, env, body) {
  const req = await findRequestByToken(db, body.token);
  if (!requestIsOpen(req)) return genericError(404);
  return json(200, { ok: true, emailHint: maskEmail(req.recipient_email) });
}

async function handleSendCode(db, env, event, body) {
  const ip = hashIp(clientIp(event), env.ipPepper);
  if (!(await rateLimit(db, 'otp_send_ip', ip, env.otpMaxSendsPerIpPerHour, 3600))) return genericError(429);

  const req = await findRequestByToken(db, body.token);
  if (!requestIsOpen(req)) return genericError(404);

  if (!(await rateLimit(db, 'otp_send_req', req.id, env.otpMaxSendsPerRequestPerHour, 3600))) return genericError(429);
  if (!(await rateLimit(db, 'otp_cooldown', req.id, 1, env.otpResendCooldownSeconds))) return genericError(429);

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpTtlSeconds * 1000).toISOString();

  // Any older unused codes for this request are invalidated.
  await db.from('portal_otp_codes').update({ consumed_at: new Date().toISOString() })
    .eq('request_id', req.id).is('consumed_at', null);
  const { error } = await db.from('portal_otp_codes').insert({
    request_id: req.id, code_hash: sha256(`${req.id}:${code}`), expires_at: expiresAt, ip_hash: ip,
  });
  if (error) return genericError(500);

  try {
    await sendEmail(env, { to: req.recipient_email, ...otpMessage({ code, orgName: req.org_name, ttlMinutes: Math.round(env.otpTtlSeconds / 60) }) });
  } catch (err) {
    console.error('otp email failed', err && err.message);
    return genericError(502);
  }
  await audit(db, { actorType: 'client', requestId: req.id, event: 'otp_sent', detail: { ip } });
  return json(200, { ok: true });
}

async function handleVerifyCode(db, env, event, body) {
  const ip = hashIp(clientIp(event), env.ipPepper);
  if (!(await rateLimit(db, 'otp_verify_ip', ip, env.otpMaxVerifiesPerIpPerHour, 3600))) return genericError(429);

  const req = await findRequestByToken(db, body.token);
  if (!requestIsOpen(req)) return genericError(404);

  const code = String(body.code || '').replace(/\D/g, '');
  if (code.length !== 6) return genericError(400);

  const { data: otp } = await db.from('portal_otp_codes').select('*')
    .eq('request_id', req.id).is('consumed_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) return genericError(400);
  if (otp.attempts >= env.otpMaxAttempts) return genericError(429);

  // Count the attempt before comparing so a crash cannot grant a free retry.
  await db.from('portal_otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);

  if (!safeEqualHex(sha256(`${req.id}:${code}`), otp.code_hash)) {
    await audit(db, { actorType: 'client', requestId: req.id, event: 'otp_failed', detail: { ip } });
    return genericError(400);
  }

  // Single use: consume, then only succeed if we were the one to consume it.
  const { data: consumed } = await db.from('portal_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', otp.id).is('consumed_at', null).select('id');
  if (!consumed || consumed.length === 0) return genericError(400);

  const sessionToken = randomToken(32);
  const csrf = randomToken(32);
  const expiresAt = new Date(Date.now() + env.sessionTtlSeconds * 1000).toISOString();
  const { error } = await db.from('portal_sessions').insert({
    request_id: req.id, token_hash: sha256(sessionToken), csrf_hash: sha256(csrf), expires_at: expiresAt, ip_hash: ip,
  });
  if (error) return genericError(500);
  await audit(db, { actorType: 'client', requestId: req.id, event: 'client_verified', detail: { ip } });

  return json(200, { ok: true, csrf, context: publicContext(req) }, {
    'Set-Cookie': cookieHeader(COOKIE, sessionToken, { maxAge: env.sessionTtlSeconds, path: COOKIE_PATH }),
  });
}

async function handleSession(db, env, event) {
  const s = await loadSession(db, event);
  if (!s) return json(401, { ok: false, error: 'Please verify your email again.' });
  if (!requestIsOpen(s.req)) return json(200, { ok: true, closed: true, context: { reference: s.req.reference, orgName: s.req.org_name } });
  await db.from('portal_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', s.session.id);
  return json(200, { ok: true, context: publicContext(s.req) });
}

async function handleGrant(db, env, event, body) {
  const s = await loadSession(db, event);
  if (!s) return json(401, { ok: false, error: 'Please verify your email again.' });
  if (!csrfOk(event, s.session)) return json(403, { ok: false, error: 'Please reload the page and try again.' });
  if (!requestIsOpen(s.req)) return json(409, { ok: false, closed: true, error: 'This request is closed. No further uploads are being accepted.' });
  if (!(await rateLimit(db, 'grant_session', s.session.id, env.maxGrantsPerSessionPerHour, 3600))) {
    return json(429, { ok: false, error: 'Too many uploads started. Please wait a few minutes.' });
  }

  const filename = sanitizeFilename(body.filename);
  const { data: used } = await db.rpc('portal_request_used_bytes', { p_request_id: s.req.id });
  const check = validateDeclaredFile(
    { filename, size: body.size, mime: body.mime },
    { allowedTypes: s.req.allowed_types, maxFileBytes: Number(s.req.max_file_bytes), usedBytes: Number(used || 0), maxTotalBytes: Number(s.req.max_total_bytes) },
  );
  if (!check.ok) return json(422, { ok: false, code: check.code, error: check.reason });

  // Reserve the row first so the object key is unique and server-chosen.
  const grantExpires = new Date(Date.now() + env.grantTtlSeconds * 1000).toISOString();
  const { data: inserted, error } = await db.from('portal_files').insert({
    request_id: s.req.id, session_id: s.session.id, object_key: 'pending', original_name: filename,
    extension: check.extension, declared_size: Number(body.size), declared_mime: body.mime || null,
    status: 'reserved', grant_expires_at: grantExpires,
  }).select('id').single();
  if (error) return json(500, { ok: false, error: 'Could not start this upload. Please try again.' });

  const objectKey = `requests/${s.req.id}/${inserted.id}.${check.extension}`;
  await db.from('portal_files').update({ object_key: objectKey }).eq('id', inserted.id);

  const { data: signed, error: signErr } = await db.storage.from(env.bucket).createSignedUploadUrl(objectKey, { upsert: false });
  if (signErr || !signed) {
    await db.from('portal_files').update({ status: 'rejected', rejection_reason: 'grant_failed' }).eq('id', inserted.id);
    return json(500, { ok: false, error: 'Could not start this upload. Please try again.' });
  }

  await audit(db, { actorType: 'client', requestId: s.req.id, fileId: inserted.id, event: 'grant_issued', detail: { bytes: Number(body.size) } });

  const storageHost = env.supabaseUrl.replace('.supabase.co', '.storage.supabase.co');
  const headers = { 'x-signature': signed.token, 'x-upsert': 'false' };
  if (env.supabasePublishableKey) headers.apikey = env.supabasePublishableKey;
  return json(200, {
    ok: true,
    fileId: inserted.id,
    expiresAt: grantExpires,
    upload: {
      tus: env.resumableUploads ? {
        endpoint: `${storageHost}/storage/v1/upload/resumable`,
        headers,
        metadata: { bucketName: env.bucket, objectName: objectKey, contentType: mimeForExtension(check.extension), cacheControl: '3600' },
        chunkSize: 6 * 1024 * 1024,
      } : null,
      put: { url: signed.signedUrl, contentType: mimeForExtension(check.extension) },
    },
  });
}

async function triggerScan(env, fileId) {
  if (!env.siteUrl || !env.internalSecret) {
    console.error('scan trigger skipped: PORTAL_SITE_URL / PORTAL_INTERNAL_SECRET missing');
    return;
  }
  try {
    await fetch(`${env.siteUrl}/.netlify/functions/portal-scan-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-internal': env.internalSecret },
      body: JSON.stringify({ fileId }),
    });
  } catch (err) {
    console.error('scan trigger failed', err && err.message);
  }
}

async function handleFinalize(db, env, event, body) {
  const s = await loadSession(db, event);
  if (!s) return json(401, { ok: false, error: 'Please verify your email again.' });
  if (!csrfOk(event, s.session)) return json(403, { ok: false, error: 'Please reload the page and try again.' });

  const fileId = String(body.fileId || '');
  const { data: file } = await db.from('portal_files').select('*').eq('id', fileId).eq('request_id', s.req.id).maybeSingle();
  if (!file) return json(404, { ok: false, error: 'Unknown upload.' });

  // Duplicate completion: report the state we already reached.
  if (file.status !== 'reserved') {
    const received = ['uploaded', 'pending_scan', 'clean', 'infected', 'scan_failed'].includes(file.status);
    return json(200, { ok: true, status: received ? 'received' : file.status, reason: file.rejection_reason || undefined });
  }

  // Late upload: request closed after the grant was issued. Refuse and purge.
  if (!requestIsOpen(s.req)) {
    await removeObject(db, env.bucket, file.object_key).catch(() => {});
    await db.from('portal_files').update({ status: 'rejected', rejection_reason: 'late' }).eq('id', file.id);
    await audit(db, { actorType: 'system', requestId: s.req.id, fileId: file.id, event: 'late_upload_refused' });
    return json(409, { ok: false, closed: true, error: 'This request is closed. The file was not accepted.' });
  }

  const stat = await statObject(db, env.bucket, file.object_key).catch(() => undefined);
  if (stat === undefined) return json(500, { ok: false, error: 'Could not confirm the upload. Please retry.' });
  if (stat === null) return json(409, { ok: false, status: 'missing', error: 'The upload did not complete. Please retry this file.' });

  let head = Buffer.alloc(0);
  let tail = Buffer.alloc(0);
  try {
    head = await fetchObjectRange(env, file.object_key, 0, Math.min(SNIFF_BYTES, stat.size) - 1);
    const tailStart = Math.max(0, stat.size - SNIFF_BYTES);
    tail = tailStart > 0 ? await fetchObjectRange(env, file.object_key, tailStart, stat.size - 1) : head;
  } catch (err) {
    console.error('sniff failed', err && err.message);
    return json(500, { ok: false, error: 'Could not confirm the upload. Please retry.' });
  }

  const verdict = verifyStoredObject({ extension: file.extension, actualSize: stat.size, maxFileBytes: Number(s.req.max_file_bytes), head, tail });
  if (!verdict.ok) {
    await removeObject(db, env.bucket, file.object_key).catch(() => {});
    await db.from('portal_files').update({ status: 'rejected', rejection_reason: verdict.code, actual_size: stat.size, detected_type: verdict.detected || null }).eq('id', file.id);
    await audit(db, { actorType: 'system', requestId: s.req.id, fileId: file.id, event: 'upload_rejected', detail: { code: verdict.code } });
    return json(422, { ok: false, status: 'rejected', code: verdict.code, error: verdict.reason });
  }

  // Quota check on actual bytes (declared size is never trusted).
  const { data: used } = await db.rpc('portal_request_used_bytes', { p_request_id: s.req.id });
  const usedOthers = Number(used || 0) - Number(file.declared_size);
  if (usedOthers + stat.size > Number(s.req.max_total_bytes)) {
    await removeObject(db, env.bucket, file.object_key).catch(() => {});
    await db.from('portal_files').update({ status: 'rejected', rejection_reason: 'quota', actual_size: stat.size }).eq('id', file.id);
    return json(422, { ok: false, status: 'rejected', code: 'quota', error: 'This file would exceed the total size limit for this request.' });
  }

  const { data: updated } = await db.from('portal_files')
    .update({ status: 'pending_scan', actual_size: stat.size, detected_type: verdict.detected, uploaded_at: new Date().toISOString() })
    .eq('id', file.id).eq('status', 'reserved').select('id');
  if (!updated || updated.length === 0) return json(200, { ok: true, status: 'received' });

  await audit(db, { actorType: 'client', requestId: s.req.id, fileId: file.id, event: 'upload_received', detail: { bytes: stat.size, type: verdict.detected } });
  await triggerScan(env, file.id);
  return json(200, { ok: true, status: 'received' });
}

async function handleBatchDone(db, env, event) {
  const s = await loadSession(db, event);
  if (!s) return json(401, { ok: false });
  if (!csrfOk(event, s.session)) return json(403, { ok: false });

  const { count } = await db.from('portal_files').select('id', { count: 'exact', head: true })
    .eq('request_id', s.req.id).in('status', ['uploaded', 'pending_scan', 'clean', 'infected', 'scan_failed']);
  const total = count || 0;
  const newFiles = total - (s.req.receipt_file_count || 0);
  if (newFiles <= 0) return json(200, { ok: true });

  await db.from('portal_requests').update({ receipt_file_count: total, last_receipt_at: new Date().toISOString() }).eq('id', s.req.id);
  if (env.receiptEmail) {
    try {
      await sendEmail(env, { to: env.receiptEmail, ...receiptMessage({ reference: s.req.reference, orgName: s.req.org_name, newFiles, totalFiles: total }) });
      await audit(db, { actorType: 'system', requestId: s.req.id, event: 'receipt_emailed', detail: { newFiles, total } });
    } catch (err) {
      console.error('receipt email failed', err && err.message);
    }
  }
  return json(200, { ok: true });
}

async function handleLogout(db, env, event) {
  const s = await loadSession(db, event);
  if (s) await db.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', s.session.id);
  return json(200, { ok: true }, { 'Set-Cookie': cookieHeader(COOKIE, '', { maxAge: 0, path: COOKIE_PATH }) });
}

// ---------------------------------------------------------------------------

exports.handler = async function (event) {
  const env = getEnv();
  if (env.mode !== 'live') return json(503, { ok: false, error: 'The upload portal is not available right now.' });

  const route = routeOf(event, 'portal');
  const method = event.httpMethod;

  let db;
  try {
    db = serviceClient();
  } catch (err) {
    console.error(err.message);
    return json(503, { ok: false, error: 'The upload portal is not available right now.' });
  }

  try {
    if (method === 'GET' && route === 'session') return await handleSession(db, env, event);
    if (method !== 'POST') return json(405, { ok: false });
    if (!originAllowed(event, env.siteUrl)) return json(403, { ok: false, error: 'Cross-site request refused.' });
    const body = parseBody(event);
    if (body === null) return json(400, { ok: false, error: 'Invalid request body.' });

    switch (route) {
      case 'lookup': return await handleLookup(db, env, body);
      case 'send-code': return await handleSendCode(db, env, event, body);
      case 'verify-code': return await handleVerifyCode(db, env, event, body);
      case 'grant': return await handleGrant(db, env, event, body);
      case 'finalize': return await handleFinalize(db, env, event, body);
      case 'batch-done': return await handleBatchDone(db, env, event);
      case 'logout': return await handleLogout(db, env, event);
      default: return json(404, { ok: false });
    }
  } catch (err) {
    console.error('portal error', route, err && err.message);
    return json(500, { ok: false, error: 'Something went wrong. Please try again.' });
  }
};
