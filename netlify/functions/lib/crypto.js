const crypto = require('crypto');

// URL-safe random token (invite links, session cookies, CSRF secrets).
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Peppered hash for IP addresses so raw IPs are never stored.
function hashIp(ip, pepper) {
  return crypto.createHmac('sha256', pepper || 'portal').update(String(ip || '')).digest('hex').slice(0, 32);
}

// Six-digit numeric code, uniformly distributed.
function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Constant-time comparison of two hex digests of equal length.
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// Human-friendly case reference like CR-2026-7K3PQ (no 0/O/1/I ambiguity).
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateReference(now = new Date()) {
  let s = '';
  for (let i = 0; i < 5; i++) s += REF_ALPHABET[crypto.randomInt(0, REF_ALPHABET.length)];
  return `CR-${now.getUTCFullYear()}-${s}`;
}

module.exports = { randomToken, sha256, hashIp, generateOtp, safeEqualHex, generateReference };
