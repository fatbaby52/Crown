// Scheduled daily (see netlify.toml). Housekeeping only; never makes anything
// public. Safe to run repeatedly.
//
//  1. Open requests past expires_at -> expired.
//  2. Reserved grants past grace -> delete any orphaned object, mark rejected.
//  3. Objects left behind by rejected/infected rows -> delete.
//  4. Requests closed/revoked/expired longer than PORTAL_RETENTION_DAYS ->
//     delete every object and the metadata rows (audit rows are kept).
//  5. Old OTP codes, sessions and rate-limit windows -> delete.

const { getEnv } = require('./lib/env');
const { serviceClient, audit, removeObject } = require('./lib/supabase');

async function expireRequests(db) {
  const { data } = await db.from('portal_requests').select('id')
    .eq('status', 'open').lt('expires_at', new Date().toISOString());
  for (const r of data || []) {
    await db.from('portal_requests').update({ status: 'expired', closed_at: new Date().toISOString(), close_reason: 'expired' }).eq('id', r.id).eq('status', 'open');
    await db.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('request_id', r.id).is('revoked_at', null);
    await audit(db, { actorType: 'system', requestId: r.id, event: 'request_expired' });
  }
  return (data || []).length;
}

async function cleanOrphans(db, env) {
  const cutoff = new Date(Date.now() - env.orphanGraceHours * 3600 * 1000).toISOString();
  const { data } = await db.from('portal_files').select('id, request_id, object_key')
    .eq('status', 'reserved').lt('grant_expires_at', cutoff).limit(500);
  for (const f of data || []) {
    if (f.object_key !== 'pending') await removeObject(db, env.bucket, f.object_key).catch(() => {});
    await db.from('portal_files').update({ status: 'rejected', rejection_reason: 'orphan' }).eq('id', f.id).eq('status', 'reserved');
    await audit(db, { actorType: 'system', requestId: f.request_id, fileId: f.id, event: 'orphan_cleaned' });
  }
  return (data || []).length;
}

async function sweepRejectedObjects(db, env) {
  const { data } = await db.from('portal_files').select('id, object_key')
    .in('status', ['rejected', 'infected']).is('deleted_at', null).limit(500);
  for (const f of data || []) {
    if (f.object_key !== 'pending') await removeObject(db, env.bucket, f.object_key).catch(() => {});
    await db.from('portal_files').update({ deleted_at: new Date().toISOString() }).eq('id', f.id);
  }
  return (data || []).length;
}

async function applyRetention(db, env) {
  const cutoff = new Date(Date.now() - env.retentionDays * 86400 * 1000).toISOString();
  const { data: reqs } = await db.from('portal_requests').select('id, reference')
    .in('status', ['closed', 'revoked', 'expired']).lt('closed_at', cutoff).limit(100);
  let purged = 0;
  for (const r of reqs || []) {
    const { data: files } = await db.from('portal_files').select('id, object_key').eq('request_id', r.id);
    for (const f of files || []) {
      if (f.object_key !== 'pending') await removeObject(db, env.bucket, f.object_key).catch(() => {});
    }
    // Cascades to files, sessions and OTP rows. Audit rows remain by request_id.
    await db.from('portal_requests').delete().eq('id', r.id);
    await audit(db, { actorType: 'system', requestId: r.id, event: 'retention_purged', detail: { files: (files || []).length } });
    purged++;
  }
  return purged;
}

async function pruneTransient(db) {
  const dayAgo = new Date(Date.now() - 86400 * 1000).toISOString();
  await db.from('portal_otp_codes').delete().lt('expires_at', dayAgo);
  await db.from('portal_sessions').delete().lt('expires_at', dayAgo);
  await db.from('portal_rate_limits').delete().lt('window_start', dayAgo);
}

exports.handler = async function () {
  const env = getEnv();
  let db;
  try {
    db = serviceClient();
  } catch (err) {
    console.error(err.message);
    return { statusCode: 200, body: 'not configured' };
  }
  const summary = {};
  try {
    summary.expired = await expireRequests(db);
    summary.orphans = await cleanOrphans(db, env);
    summary.swept = await sweepRejectedObjects(db, env);
    summary.purgedRequests = await applyRetention(db, env);
    await pruneTransient(db);
  } catch (err) {
    console.error('cleanup error', err && err.message);
  }
  console.log('portal cleanup', JSON.stringify(summary));
  return { statusCode: 200, body: JSON.stringify(summary) };
};
