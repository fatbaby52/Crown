// Background function (Netlify runs *-background functions for up to 15 min
// and answers the caller with 202 immediately). Scans one quarantined file.
//
// Triggered internally by portal.js (finalize) and staff.js (rescan) with the
// shared PORTAL_INTERNAL_SECRET header. Fails closed: anything but a clean
// verdict leaves the file undownloadable.

const { getEnv } = require('./lib/env');
const { serviceClient, audit, removeObject } = require('./lib/supabase');
const { scanBytes } = require('./lib/scanner');
const { header, parseBody } = require('./lib/http');
const { safeEqualHex, sha256 } = require('./lib/crypto');

exports.handler = async function (event) {
  const env = getEnv();
  const provided = header(event, 'x-portal-internal');
  if (!env.internalSecret || !provided || !safeEqualHex(sha256(provided), sha256(env.internalSecret))) {
    return { statusCode: 401, body: '' };
  }
  const body = parseBody(event) || {};
  const fileId = String(body.fileId || '');
  if (!fileId) return { statusCode: 400, body: '' };

  const db = serviceClient();
  const { data: file } = await db.from('portal_files').select('*').eq('id', fileId).maybeSingle();
  if (!file || file.status !== 'pending_scan') return { statusCode: 200, body: '' };

  await db.from('portal_files').update({ scan_attempts: (file.scan_attempts || 0) + 1, scan_provider: env.scannerProvider }).eq('id', file.id);

  let result;
  if (env.scannerProvider === 'endpoint-only') {
    // No bytes are inspected; record the decision explicitly.
    result = await scanBytes(env, null, '');
  } else try {
    const { data: blob, error } = await db.storage.from(env.bucket).download(file.object_key);
    if (error || !blob) throw new Error(error ? error.message : 'download returned nothing');
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (bytes.length !== Number(file.actual_size)) {
      result = { verdict: 'error', detail: { reason: 'size changed after finalize' } };
    } else {
      result = await scanBytes(env, bytes, `${file.id}.${file.extension}`);
    }
  } catch (err) {
    result = { verdict: 'error', detail: { reason: 'download failed' } };
    console.error('scan download failed', err && err.message);
  }

  const now = new Date().toISOString();
  if (result.verdict === 'clean') {
    await db.from('portal_files').update({ status: 'clean', scanned_at: now, scan_result: result.detail }).eq('id', file.id).eq('status', 'pending_scan');
  } else if (result.verdict === 'infected') {
    await removeObject(db, env.bucket, file.object_key).catch((e) => console.error('remove infected failed', e.message));
    await db.from('portal_files').update({ status: 'infected', scanned_at: now, scan_result: result.detail }).eq('id', file.id).eq('status', 'pending_scan');
  } else {
    await db.from('portal_files').update({ status: 'scan_failed', scanned_at: now, scan_result: result.detail }).eq('id', file.id).eq('status', 'pending_scan');
  }
  await audit(db, { actorType: 'system', requestId: file.request_id, fileId: file.id, event: `scan_${result.verdict}`, detail: { provider: env.scannerProvider } });
  return { statusCode: 200, body: '' };
};
