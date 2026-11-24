// Handler-level tests with the Supabase client stubbed out. These exercise the
// authorization decisions in portal.js and staff.js without a database.

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

process.env.PORTAL_MODE = 'live';
process.env.PORTAL_SITE_URL = 'https://staging.example.test';
process.env.SUPABASE_URL = 'https://proj.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.PORTAL_INTERNAL_SECRET = 'internal';
process.env.EMAIL_PROVIDER = 'resend';
process.env.RESEND_API_KEY = 'x';
process.env.PORTAL_FROM_EMAIL = 'uploads@example.test';

// ---- minimal query-builder fake --------------------------------------------
function makeDb(state) {
  const rpcs = {
    portal_rate_limit: () => ({ data: state.rateLimitOk !== false, error: null }),
    portal_request_used_bytes: () => ({ data: state.usedBytes || 0, error: null }),
  };
  function table(name) {
    const rows = () => state.tables[name] || [];
    const q = {
      _filters: [], _op: 'select', _patch: null, _insert: null,
      select() { if (this._op === 'select' || this._op === 'update' || this._op === 'insert') this._returning = true; return this; },
      insert(v) { this._op = 'insert'; this._insert = v; return this; },
      update(v) { this._op = 'update'; this._patch = v; return this; },
      delete() { this._op = 'delete'; return this; },
      eq(k, v) { this._filters.push((r) => r[k] === v); return this; },
      neq(k, v) { this._filters.push((r) => r[k] !== v); return this; },
      is(k, v) { this._filters.push((r) => r[k] === v || (v === null && r[k] == null)); return this; },
      gt(k, v) { this._filters.push((r) => r[k] > v); return this; },
      lt(k, v) { this._filters.push((r) => r[k] < v); return this; },
      in(k, arr) { this._filters.push((r) => arr.includes(r[k])); return this; },
      order() { return this; }, limit() { return this; },
      _apply() { return rows().filter((r) => this._filters.every((f) => f(r))); },
      _run() {
        if (this._op === 'insert') {
          const row = { id: 'id-' + Math.random().toString(36).slice(2, 8), ...this._insert };
          state.tables[name] = [...rows(), row];
          state.inserts.push({ table: name, row });
          return [row];
        }
        if (this._op === 'update') {
          const hit = this._apply();
          hit.forEach((r) => Object.assign(r, this._patch));
          state.updates.push({ table: name, rows: hit.map((r) => ({ ...r })) });
          return hit;
        }
        if (this._op === 'delete') { const hit = this._apply(); state.tables[name] = rows().filter((r) => !hit.includes(r)); return hit; }
        return this._apply();
      },
      maybeSingle() { const r = this._run(); return Promise.resolve({ data: r[0] || null, error: null }); },
      single() { const r = this._run(); return Promise.resolve({ data: r[0] || null, error: r[0] ? null : { message: 'none' } }); },
      then(res, rej) { return Promise.resolve({ data: this._run(), error: null, count: this._apply().length }).then(res, rej); },
    };
    return q;
  }
  return {
    from: table,
    rpc: (name, args) => Promise.resolve(rpcs[name](args)),
    storage: {
      from: () => ({
        createSignedUploadUrl: () => Promise.resolve({ data: { token: 'tok', signedUrl: 'https://proj.supabase.co/storage/v1/object/upload/sign/x?token=tok' }, error: null }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://signed' }, error: null }),
        remove: () => Promise.resolve({ error: null }),
        list: () => Promise.resolve({ data: state.objects || [], error: null }),
      }),
    },
    auth: { getUser: (token) => Promise.resolve(state.users[token] ? { data: { user: state.users[token] }, error: null } : { data: null, error: { message: 'bad' } }) },
  };
}

// Patch require so lib/supabase returns our fake, and email/fetch are stubbed.
const libPath = path.resolve(__dirname, '../netlify/functions/lib/supabase.js');
const realLoad = Module._load;
let state;
Module._load = function (request, parent, isMain) {
  const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return ''; } })();
  if (resolved === libPath) {
    const real = realLoad.apply(this, arguments);
    return { ...real, serviceClient: () => makeDb(state) };
  }
  return realLoad.apply(this, arguments);
};
const sent = [];
global.fetch = async (url, opts) => {
  sent.push({ url, opts });
  return { ok: true, status: 200, json: async () => ({ id: 'x' }), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
};

const portal = require('../netlify/functions/portal');
const staff = require('../netlify/functions/staff');
const { sha256 } = require('../netlify/functions/lib/crypto');

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 1000).toISOString();
const TOKEN = 'a'.repeat(43);

function reset() {
  state = {
    inserts: [], updates: [], users: {}, objects: [],
    tables: {
      portal_requests: [{
        id: 'req1', reference: 'CR-2026-AAAAA', org_name: 'Synthetic Co', purpose: 'Test', recipient_email: 'recipient@example.test',
        instructions: '', checklist: [], status: 'open', invite_token_hash: sha256(TOKEN), expires_at: future,
        max_file_bytes: 1000, max_total_bytes: 5000, allowed_types: ['pdf', 'jpg', 'png'], receipt_file_count: 0,
      }, {
        id: 'req2', reference: 'CR-2026-BBBBB', org_name: 'Other Co', purpose: 'Test', recipient_email: 'other@example.test',
        instructions: '', checklist: [], status: 'open', invite_token_hash: sha256('b'.repeat(43)), expires_at: future,
        max_file_bytes: 1000, max_total_bytes: 5000, allowed_types: ['pdf'], receipt_file_count: 0,
      }],
      portal_otp_codes: [], portal_sessions: [], portal_files: [], portal_audit: [], portal_staff: [],
    },
  };
  sent.length = 0;
}

function ev(method, route, body, headers = {}) {
  return {
    httpMethod: method,
    path: `/api/portal/${route}`,
    headers: { origin: 'https://staging.example.test', host: 'staging.example.test', 'x-nf-client-connection-ip': '203.0.113.9', ...headers },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}
const parse = (res) => ({ status: res.statusCode, body: JSON.parse(res.body), headers: res.headers });

test('lookup: valid link ok; forwarded/garbage/closed link refused with generic error', async () => {
  reset();
  let r = parse(await portal.handler(ev('POST', 'lookup', { token: TOKEN })));
  assert.equal(r.status, 200);
  assert.equal(r.body.emailHint, 'r***@example.test');
  r = parse(await portal.handler(ev('POST', 'lookup', { token: 'x'.repeat(43) })));
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'This request could not be completed.');
  state.tables.portal_requests[0].status = 'closed';
  r = parse(await portal.handler(ev('POST', 'lookup', { token: TOKEN })));
  assert.equal(r.status, 404);
  state.tables.portal_requests[0].status = 'open';
  state.tables.portal_requests[0].expires_at = past;
  r = parse(await portal.handler(ev('POST', 'lookup', { token: TOKEN })));
  assert.equal(r.status, 404);
});

test('writes without a same-origin Origin header are refused', async () => {
  reset();
  const e = ev('POST', 'lookup', { token: TOKEN });
  delete e.headers.origin;
  assert.equal(parse(await portal.handler(e)).status, 403);
  e.headers.origin = 'https://attacker.example';
  assert.equal(parse(await portal.handler(e)).status, 403);
});

test('send-code stores only a hash, emails the bound recipient, honours rate limits', async () => {
  reset();
  let r = parse(await portal.handler(ev('POST', 'send-code', { token: TOKEN })));
  assert.equal(r.status, 200);
  const otp = state.tables.portal_otp_codes[0];
  assert.ok(otp && otp.code_hash.length === 64);
  assert.ok(!JSON.stringify(otp).match(/\b\d{6}\b/), 'raw code must not be stored');
  const mail = JSON.parse(sent[0].opts.body);
  assert.deepEqual(mail.to, ['recipient@example.test']);
  state.rateLimitOk = false;
  r = parse(await portal.handler(ev('POST', 'send-code', { token: TOKEN })));
  assert.equal(r.status, 429);
});

async function verifiedSession() {
  // Issue a code, then recover it from the email stub to verify.
  await portal.handler(ev('POST', 'send-code', { token: TOKEN }));
  const code = JSON.parse(sent[sent.length - 1].opts.body).text.match(/\b(\d{6})\b/)[1];
  const r = parse(await portal.handler(ev('POST', 'verify-code', { token: TOKEN, code })));
  assert.equal(r.status, 200, 'verify should succeed');
  const cookie = r.headers['Set-Cookie'].split(';')[0];
  return { cookie, csrf: r.body.csrf, code, context: r.body.context };
}

test('verify-code: wrong, replayed, expired and over-attempted codes fail; success sets cookie and reveals org', async () => {
  reset();
  await portal.handler(ev('POST', 'send-code', { token: TOKEN }));
  const code = JSON.parse(sent[0].opts.body).text.match(/\b(\d{6})\b/)[1];
  const wrong = code === '000000' ? '000001' : '000000';
  let r = parse(await portal.handler(ev('POST', 'verify-code', { token: TOKEN, code: wrong })));
  assert.equal(r.status, 400);
  r = parse(await portal.handler(ev('POST', 'verify-code', { token: TOKEN, code })));
  assert.equal(r.status, 200);
  assert.equal(r.body.context.orgName, 'Synthetic Co');
  assert.match(r.headers['Set-Cookie'], /HttpOnly/);
  // replay
  r = parse(await portal.handler(ev('POST', 'verify-code', { token: TOKEN, code })));
  assert.equal(r.status, 400);
  // expired
  await portal.handler(ev('POST', 'send-code', { token: TOKEN }));
  const code2 = JSON.parse(sent[sent.length - 1].opts.body).text.match(/\b(\d{6})\b/)[1];
  state.tables.portal_otp_codes.find((o) => !o.consumed_at).expires_at = past;
  r = parse(await portal.handler(ev('POST', 'verify-code', { token: TOKEN, code: code2 })));
  assert.equal(r.status, 400);
  // attempts exhausted
  await portal.handler(ev('POST', 'send-code', { token: TOKEN }));
  const code3 = JSON.parse(sent[sent.length - 1].opts.body).text.match(/\b(\d{6})\b/)[1];
  state.tables.portal_otp_codes.find((o) => !o.consumed_at).attempts = 5;
  r = parse(await portal.handler(ev('POST', 'verify-code', { token: TOKEN, code: code3 })));
  assert.equal(r.status, 429);
});

test('grant: requires session + CSRF, enforces type/size/quota, scopes object key to the request', async () => {
  reset();
  const s = await verifiedSession();
  // no cookie
  let r = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.pdf', size: 10 })));
  assert.equal(r.status, 401);
  // cookie but no csrf
  r = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.pdf', size: 10 }, { cookie: s.cookie })));
  assert.equal(r.status, 403);
  const H = { cookie: s.cookie, 'x-csrf-token': s.csrf };
  r = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.zip', size: 10 }, H)));
  assert.equal(r.status, 422); assert.equal(r.body.code, 'type');
  r = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.pdf', size: 5000 }, H)));
  assert.equal(r.status, 422); assert.equal(r.body.code, 'size');
  state.usedBytes = 4995;
  r = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.pdf', size: 10 }, H)));
  assert.equal(r.status, 422); assert.equal(r.body.code, 'quota');
  state.usedBytes = 0;
  r = parse(await portal.handler(ev('POST', 'grant', { filename: 'Tax.PDF', size: 10, mime: 'application/pdf' }, H)));
  assert.equal(r.status, 200);
  assert.equal(r.body.upload.tus.headers['x-upsert'], 'false');
  assert.equal(r.body.upload.tus.headers['x-signature'], 'tok');
  const file = state.tables.portal_files.find((f) => f.id === r.body.fileId);
  assert.ok(file.object_key.startsWith('requests/req1/'), 'object key is server-chosen under the request');
  assert.equal(file.status, 'reserved');
});

test('grant refused once the request is closed; finalize refuses late uploads and purges them', async () => {
  reset();
  const s = await verifiedSession();
  const H = { cookie: s.cookie, 'x-csrf-token': s.csrf };
  const g = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.pdf', size: 10 }, H)));
  state.tables.portal_requests[0].status = 'closed';
  let r = parse(await portal.handler(ev('POST', 'grant', { filename: 'b.pdf', size: 10 }, H)));
  assert.equal(r.status, 409); assert.equal(r.body.closed, true);
  r = parse(await portal.handler(ev('POST', 'finalize', { fileId: g.body.fileId }, H)));
  assert.equal(r.status, 409);
  const f = state.tables.portal_files.find((x) => x.id === g.body.fileId);
  assert.equal(f.status, 'rejected'); assert.equal(f.rejection_reason, 'late');
});

test('finalize: missing object, mismatched content, duplicate completion, success + scan trigger', async () => {
  reset();
  const s = await verifiedSession();
  const H = { cookie: s.cookie, 'x-csrf-token': s.csrf };
  const g = parse(await portal.handler(ev('POST', 'grant', { filename: 'a.pdf', size: 10 }, H)));
  const key = state.tables.portal_files.find((x) => x.id === g.body.fileId).object_key;
  // not uploaded yet
  let r = parse(await portal.handler(ev('POST', 'finalize', { fileId: g.body.fileId }, H)));
  assert.equal(r.status, 409); assert.equal(r.body.status, 'missing');
  // uploaded but it's really a PNG
  state.objects = [{ name: key.split('/').pop(), metadata: { size: 20 } }];
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => (String(url).includes('/storage/v1/object/') ? { ok: true, status: 206, arrayBuffer: async () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).buffer } : origFetch(url, opts));
  r = parse(await portal.handler(ev('POST', 'finalize', { fileId: g.body.fileId }, H)));
  assert.equal(r.status, 422); assert.equal(r.body.code, 'mismatch');
  // a real pdf on a fresh grant
  const g2 = parse(await portal.handler(ev('POST', 'grant', { filename: 'b.pdf', size: 10 }, H)));
  const key2 = state.tables.portal_files.find((x) => x.id === g2.body.fileId).object_key;
  state.objects = [{ name: key2.split('/').pop(), metadata: { size: 20 } }];
  global.fetch = async (url, opts) => (String(url).includes('/storage/v1/object/') ? { ok: true, status: 206, arrayBuffer: async () => Uint8Array.from(Buffer.from('%PDF-1.4 abc %%EOF')).buffer } : origFetch(url, opts));
  sent.length = 0;
  r = parse(await portal.handler(ev('POST', 'finalize', { fileId: g2.body.fileId }, H)));
  assert.equal(r.status, 200); assert.equal(r.body.status, 'received');
  assert.equal(state.tables.portal_files.find((x) => x.id === g2.body.fileId).status, 'pending_scan');
  assert.ok(sent.some((c) => String(c.url).includes('portal-scan-background') && c.opts.headers['x-portal-internal'] === 'internal'));
  // duplicate completion is idempotent
  r = parse(await portal.handler(ev('POST', 'finalize', { fileId: g2.body.fileId }, H)));
  assert.equal(r.status, 200); assert.equal(r.body.status, 'received');
  // oversize actual object (declared small, real big)
  const g3 = parse(await portal.handler(ev('POST', 'grant', { filename: 'c.pdf', size: 10 }, H)));
  const key3 = state.tables.portal_files.find((x) => x.id === g3.body.fileId).object_key;
  state.objects = [{ name: key3.split('/').pop(), metadata: { size: 999999 } }];
  r = parse(await portal.handler(ev('POST', 'finalize', { fileId: g3.body.fileId }, H)));
  assert.equal(r.status, 422); assert.equal(r.body.code, 'size');
  global.fetch = origFetch;
});

test('a session for one company cannot finalize a file belonging to another request', async () => {
  reset();
  const s = await verifiedSession();
  const H = { cookie: s.cookie, 'x-csrf-token': s.csrf };
  state.tables.portal_files.push({ id: 'foreign', request_id: 'req2', status: 'reserved', object_key: 'requests/req2/foreign.pdf', extension: 'pdf', declared_size: 5, grant_expires_at: future });
  const r = parse(await portal.handler(ev('POST', 'finalize', { fileId: 'foreign' }, H)));
  assert.equal(r.status, 404);
});

test('session endpoint never reveals the organization without a valid cookie; closed request reported', async () => {
  reset();
  let r = parse(await portal.handler(ev('GET', 'session')));
  assert.equal(r.status, 401);
  const s = await verifiedSession();
  r = parse(await portal.handler(ev('GET', 'session', undefined, { cookie: s.cookie })));
  assert.equal(r.body.context.orgName, 'Synthetic Co');
  state.tables.portal_requests[0].status = 'closed';
  r = parse(await portal.handler(ev('GET', 'session', undefined, { cookie: s.cookie })));
  assert.equal(r.body.closed, true);
  assert.equal(r.body.context.checklist, undefined);
});

test('portal refuses everything unless PORTAL_MODE=live', async () => {
  reset();
  process.env.PORTAL_MODE = 'staff_only';
  const r = parse(await portal.handler(ev('POST', 'lookup', { token: TOKEN })));
  assert.equal(r.status, 503);
  process.env.PORTAL_MODE = 'live';
});

// ---- staff ----------------------------------------------------------------
function jwt(claims) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256' })}.${b(claims)}.sig`;
}
function sev(method, route, body, token) {
  return {
    httpMethod: method,
    path: `/api/staff/${route}`,
    headers: { origin: 'https://staging.example.test', host: 'staging.example.test', authorization: token ? `Bearer ${token}` : '' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

test('staff: no token, aal1 token, non-staff user are refused; aal2 staff allowed', async () => {
  reset();
  const aal1 = jwt({ sub: 'u1', aal: 'aal1' });
  const aal2 = jwt({ sub: 'u1', aal: 'aal2' });
  state.users[aal1] = { id: 'u1', email: 'staff@example.test' };
  state.users[aal2] = { id: 'u1', email: 'staff@example.test' };
  let r = parse(await staff.handler(sev('GET', 'requests')));
  assert.equal(r.status, 401);
  r = parse(await staff.handler(sev('GET', 'requests', undefined, aal1)));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'mfa_required');
  r = parse(await staff.handler(sev('GET', 'requests', undefined, aal2)));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'not_staff');
  state.tables.portal_staff.push({ user_id: 'u1', email: 'staff@example.test', is_active: true });
  r = parse(await staff.handler(sev('GET', 'requests', undefined, aal2)));
  assert.equal(r.status, 200); assert.equal(r.body.requests.length, 2);
  // deactivated staff lose access
  state.tables.portal_staff[0].is_active = false;
  r = parse(await staff.handler(sev('GET', 'requests', undefined, aal2)));
  assert.equal(r.status, 403);
});

test('staff: download only for clean files; issue returns link once and stores only its hash; close revokes sessions', async () => {
  reset();
  const aal2 = jwt({ sub: 'u1', aal: 'aal2' });
  state.users[aal2] = { id: 'u1', email: 'staff@example.test' };
  state.tables.portal_staff.push({ user_id: 'u1', email: 'staff@example.test', is_active: true });
  state.tables.portal_files.push(
    { id: 'f-pending', request_id: 'req1', status: 'pending_scan', object_key: 'requests/req1/f1.pdf', original_name: 'x.pdf' },
    { id: 'f-clean', request_id: 'req1', status: 'clean', object_key: 'requests/req1/f2.pdf', original_name: 'y.pdf' },
    { id: 'f-failed', request_id: 'req1', status: 'scan_failed', object_key: 'requests/req1/f3.pdf', original_name: 'z.pdf' },
  );
  let r = parse(await staff.handler(sev('POST', 'files/f-pending/download', {}, aal2)));
  assert.equal(r.status, 409);
  r = parse(await staff.handler(sev('POST', 'files/f-failed/download', {}, aal2)));
  assert.equal(r.status, 409);
  r = parse(await staff.handler(sev('POST', 'files/f-clean/download', {}, aal2)));
  assert.equal(r.status, 200); assert.equal(r.body.url, 'https://signed');

  // create + issue
  r = parse(await staff.handler(sev('POST', 'requests', { orgName: 'New Co', purpose: 'Intake', recipientEmail: 'Person@Example.Test', checklist: [{ group: 'A', items: [{ label: 'Doc' }] }] }, aal2)));
  assert.equal(r.status, 201); assert.equal(r.body.request.status, 'draft'); assert.equal(r.body.request.recipientEmail, 'person@example.test');
  const id = r.body.request.id;
  r = parse(await staff.handler(sev('POST', 'requests', { orgName: 'New Co', purpose: 'Intake', recipientEmail: 'not-an-email' }, aal2)));
  assert.equal(r.status, 422);
  r = parse(await staff.handler(sev('POST', `requests/${id}/issue`, { expiryDays: 7 }, aal2)));
  assert.equal(r.status, 200);
  const tokenInUrl = new URL(r.body.inviteUrl).searchParams.get('r');
  const row = state.tables.portal_requests.find((x) => x.id === id);
  assert.equal(row.status, 'open');
  assert.equal(row.invite_token_hash, sha256(tokenInUrl));
  assert.ok(!JSON.stringify(row).includes(tokenInUrl), 'raw token must not be stored');

  // close revokes sessions and clears the token
  state.tables.portal_sessions.push({ id: 's1', request_id: id, revoked_at: null });
  r = parse(await staff.handler(sev('POST', `requests/${id}/close`, { revoke: true }, aal2)));
  assert.equal(r.status, 200);
  assert.equal(row.status, 'revoked');
  assert.equal(row.invite_token_hash, null);
  assert.ok(state.tables.portal_sessions[0].revoked_at);
  // closed requests cannot be re-issued or edited
  r = parse(await staff.handler(sev('POST', `requests/${id}/issue`, {}, aal2)));
  assert.equal(r.status, 409);
  r = parse(await staff.handler(sev('PATCH', `requests/${id}`, { orgName: 'X' }, aal2)));
  assert.equal(r.status, 409);
});

test('staff: cross-site writes refused; config route is public and non-secret', async () => {
  reset();
  const aal2 = jwt({ sub: 'u1', aal: 'aal2' });
  state.users[aal2] = { id: 'u1', email: 'staff@example.test' };
  state.tables.portal_staff.push({ user_id: 'u1', email: 'staff@example.test', is_active: true });
  const e = sev('POST', 'requests', { orgName: 'A', purpose: 'B', recipientEmail: 'a@b.co' }, aal2);
  e.headers.origin = 'https://evil.example';
  assert.equal(parse(await staff.handler(e)).status, 403);
  const c = parse(await staff.handler(sev('GET', 'config')));
  assert.equal(c.status, 200);
  assert.ok(!JSON.stringify(c.body).includes('service-key'));
});
