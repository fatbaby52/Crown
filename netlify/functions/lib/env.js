// Central place for portal configuration. Every value comes from environment
// variables; nothing secret is hard-coded. See .env.example and
// docs/PORTAL_RUNBOOK.md for what each one does.

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function getEnv() {
  const mode = (process.env.PORTAL_MODE || 'staff_only').toLowerCase();
  return {
    // off        -> every portal endpoint (client and staff) returns 503
    // staff_only -> staff console works; client link/code/grant endpoints refuse
    // live       -> full operation
    mode: ['off', 'staff_only', 'live'].includes(mode) ? mode : 'staff_only',
    // 'staging' | 'production' — only used to gate the staging scanner stub
    deployEnv: (process.env.PORTAL_ENV || 'production').toLowerCase(),
    siteUrl: (process.env.PORTAL_SITE_URL || process.env.URL || '').replace(/\/$/, ''),

    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    bucket: process.env.PORTAL_BUCKET || 'client-uploads',

    // Hash pepper for IP addresses in rate-limit keys and session rows.
    ipPepper: process.env.PORTAL_IP_PEPPER || '',
    // Shared secret between the public functions and the background scanner.
    internalSecret: process.env.PORTAL_INTERNAL_SECRET || '',

    emailProvider: (process.env.EMAIL_PROVIDER || 'resend').toLowerCase(),
    resendApiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.PORTAL_FROM_EMAIL || '',
    receiptEmail: process.env.PORTAL_RECEIPT_EMAIL || '',

    scannerProvider: (process.env.SCANNER_PROVIDER || 'none').toLowerCase(),
    scannerUrl: (process.env.SCANNER_URL || '').replace(/\/$/, ''),
    scannerToken: process.env.SCANNER_TOKEN || '',

    otpTtlSeconds: int('PORTAL_OTP_TTL_SECONDS', 600),
    otpResendCooldownSeconds: int('PORTAL_OTP_RESEND_COOLDOWN_SECONDS', 60),
    otpMaxAttempts: int('PORTAL_OTP_MAX_ATTEMPTS', 5),
    otpMaxSendsPerRequestPerHour: int('PORTAL_OTP_MAX_SENDS_PER_HOUR', 6),
    otpMaxSendsPerIpPerHour: int('PORTAL_OTP_MAX_SENDS_PER_IP_PER_HOUR', 20),
    otpMaxVerifiesPerIpPerHour: int('PORTAL_OTP_MAX_VERIFIES_PER_IP_PER_HOUR', 40),
    sessionTtlSeconds: int('PORTAL_SESSION_TTL_SECONDS', 3600),
    grantTtlSeconds: int('PORTAL_GRANT_TTL_SECONDS', 7200),
    maxGrantsPerSessionPerHour: int('PORTAL_MAX_GRANTS_PER_SESSION_PER_HOUR', 200),

    defaultMaxFileBytes: int('PORTAL_MAX_FILE_BYTES', 25 * 1024 * 1024),
    defaultMaxTotalBytes: int('PORTAL_MAX_TOTAL_BYTES', 250 * 1024 * 1024),
    defaultAllowedTypes: list('PORTAL_ALLOWED_TYPES', ['pdf', 'jpg', 'png']),
    defaultExpiryDays: int('PORTAL_DEFAULT_EXPIRY_DAYS', 7),
    retentionDays: int('PORTAL_RETENTION_DAYS', 90),
    orphanGraceHours: int('PORTAL_ORPHAN_GRACE_HOURS', 24),
    downloadUrlSeconds: int('PORTAL_DOWNLOAD_URL_SECONDS', 60),
  };
}

module.exports = { getEnv };
