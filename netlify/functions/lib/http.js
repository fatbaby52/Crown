// Small HTTP helpers for Netlify (Lambda-style) functions.

const NO_STORE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

// Generic error used for every unauthenticated failure so nothing can be
// enumerated from the response (invalid link, expired link, wrong code...).
function genericError(statusCode = 400) {
  return json(statusCode, { ok: false, error: 'This request could not be completed.' });
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return null;
  }
}

function header(event, name) {
  const h = event.headers || {};
  return h[name] || h[name.toLowerCase()] || h[name.toUpperCase()] || '';
}

function clientIp(event) {
  return (
    header(event, 'x-nf-client-connection-ip') ||
    (header(event, 'x-forwarded-for') || '').split(',')[0].trim() ||
    ''
  );
}

function parseCookies(event) {
  const raw = header(event, 'cookie');
  const out = {};
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function cookieHeader(name, value, { maxAge, path = '/', secure = true, sameSite = 'Strict' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', `SameSite=${sameSite}`];
  if (secure) parts.push('Secure');
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}

// The request must come from our own origin. Browsers always send Origin on
// cross-site and same-site POSTs; a missing Origin on a write is refused.
function originAllowed(event, siteUrl) {
  const origin = header(event, 'origin');
  if (!origin) return false;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = new Set();
  const host = header(event, 'x-forwarded-host') || header(event, 'host');
  if (host) hosts.add(host.toLowerCase());
  if (siteUrl) {
    try {
      hosts.add(new URL(siteUrl).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return hosts.has(originHost.toLowerCase());
}

// Route suffix after /api/portal or /.netlify/functions/portal (either may
// appear depending on how Netlify rewrote the request).
function routeOf(event, fnName) {
  const p = event.path || '';
  const patterns = [`/.netlify/functions/${fnName}`, `/api/${fnName}`];
  for (const pat of patterns) {
    const i = p.indexOf(pat);
    if (i !== -1) return p.slice(i + pat.length).replace(/^\/+|\/+$/g, '');
  }
  return p.replace(/^\/+|\/+$/g, '');
}

module.exports = { json, genericError, parseBody, header, clientIp, parseCookies, cookieHeader, originAllowed, routeOf };
