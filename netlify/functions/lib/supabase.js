const { createClient } = require('@supabase/supabase-js');
const { getEnv } = require('./env');

let cached;

// Service-role client. Server-side only; never ship this key to a browser.
function serviceClient() {
  if (cached) return cached;
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  cached = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

async function audit(db, { actorType, actorId = null, requestId = null, fileId = null, event, detail = null }) {
  try {
    await db.from('portal_audit').insert({
      actor_type: actorType,
      actor_id: actorId,
      request_id: requestId,
      file_id: fileId,
      event,
      detail,
    });
  } catch (err) {
    console.error('audit insert failed', event, err && err.message);
  }
}

async function rateLimit(db, scope, key, limit, windowSeconds) {
  const { data, error } = await db.rpc('portal_rate_limit', {
    p_scope: scope,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rate limit rpc failed', error.message);
    return false; // fail closed
  }
  return data === true;
}

// Fetch a byte range of a stored object using the service key (never leaves
// the server). Supabase Storage honours HTTP Range on the object endpoint.
async function fetchObjectRange(env, objectKey, start, end) {
  const url = `${env.supabaseUrl}/storage/v1/object/${env.bucket}/${encodeURI(objectKey)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.supabaseServiceKey}`,
      apikey: env.supabaseServiceKey,
      Range: `bytes=${start}-${end}`,
    },
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`object range fetch failed: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Object metadata (size, mimetype) or null when the object does not exist.
async function statObject(db, bucket, objectKey) {
  const idx = objectKey.lastIndexOf('/');
  const dir = idx === -1 ? '' : objectKey.slice(0, idx);
  const base = idx === -1 ? objectKey : objectKey.slice(idx + 1);
  const { data, error } = await db.storage.from(bucket).list(dir, { limit: 100, search: base });
  if (error) throw new Error(`storage list failed: ${error.message}`);
  const hit = (data || []).find((o) => o.name === base);
  if (!hit) return null;
  const meta = hit.metadata || {};
  return { size: Number(meta.size ?? meta.contentLength ?? 0), mimetype: meta.mimetype || null };
}

async function removeObject(db, bucket, objectKey) {
  const { error } = await db.storage.from(bucket).remove([objectKey]);
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`storage remove failed: ${error.message}`);
  }
}

module.exports = { serviceClient, audit, rateLimit, fetchObjectRange, statObject, removeObject };
