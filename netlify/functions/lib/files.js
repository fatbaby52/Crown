// Pure helpers for filename handling, type allow-listing and content sniffing.

const TYPE_TABLE = {
  pdf: { mimes: ['application/pdf'], label: 'PDF' },
  jpg: { mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg'], label: 'JPG', aliases: ['jpeg'] },
  png: { mimes: ['image/png'], label: 'PNG' },
};

function canonicalExtension(ext) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'jpeg') return 'jpg';
  return e;
}

function extensionOf(filename) {
  const name = String(filename || '');
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return canonicalExtension(name.slice(idx + 1));
}

function mimeForExtension(ext) {
  const t = TYPE_TABLE[canonicalExtension(ext)];
  return t ? t.mimes[0] : 'application/octet-stream';
}

// Strip paths and control characters; keep the name readable for staff.
function sanitizeFilename(filename) {
  let name = String(filename || '').split(/[\\/]/).pop() || '';
  name = name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (name.length > 180) {
    const ext = extensionOf(name);
    name = name.slice(0, 160) + (ext ? '.' + ext : '');
  }
  return name || 'upload';
}

// Decide whether a declared file may receive an upload grant.
// Returns { ok: true, extension } or { ok: false, reason }.
function validateDeclaredFile({ filename, size, mime }, { allowedTypes, maxFileBytes, usedBytes, maxTotalBytes }) {
  const ext = extensionOf(filename);
  const allowed = (allowedTypes || []).map(canonicalExtension);
  if (!ext || !allowed.includes(ext)) {
    const labels = allowed.map((a) => (TYPE_TABLE[a] ? TYPE_TABLE[a].label : a.toUpperCase()));
    return { ok: false, code: 'type', reason: `Only ${labels.join(', ')} files are accepted. ZIP and other archives are not accepted; please upload each document separately.` };
  }
  if (mime) {
    const m = String(mime).toLowerCase();
    const allowedMimes = TYPE_TABLE[ext] ? TYPE_TABLE[ext].mimes : [];
    // Browsers sometimes send an empty or generic type; only reject a clear mismatch.
    if (m && m !== 'application/octet-stream' && !allowedMimes.includes(m)) {
      return { ok: false, code: 'type', reason: `This file does not look like a ${TYPE_TABLE[ext].label}.` };
    }
  }
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, code: 'size', reason: 'This file is empty.' };
  if (n > maxFileBytes) return { ok: false, code: 'size', reason: `This file is larger than the ${formatBytes(maxFileBytes)} per-file limit.` };
  if (usedBytes + n > maxTotalBytes) return { ok: false, code: 'quota', reason: `Adding this file would exceed the ${formatBytes(maxTotalBytes)} total limit for this request.` };
  return { ok: true, extension: ext };
}

function formatBytes(n) {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

// Identify a file by its leading bytes. Returns 'pdf' | 'jpg' | 'png' |
// 'zip' | 'rar' | '7z' | 'gz' | 'unknown'.
function sniffType(head) {
  const b = Buffer.isBuffer(head) ? head : Buffer.from(head || []);
  if (b.length >= 5 && b.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 8 && b[0] === 0x89 && b.slice(1, 4).toString('latin1') === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'zip';
  if (b.length >= 7 && b.slice(0, 6).toString('latin1') === 'Rar!\x1a\x07') return 'rar';
  if (b.length >= 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c) return '7z';
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return 'gz';
  return 'unknown';
}

// Encrypted PDFs carry an /Encrypt entry in the trailer dictionary (classic
// xref) or in the xref stream dictionary (PDF 1.5+). Both live near the end of
// the file, and some writers also place the trailer early (linearized files),
// so we check both the head and the tail.
function pdfLooksEncrypted(head, tail) {
  const re = /\/Encrypt\b/;
  const h = Buffer.isBuffer(head) ? head.toString('latin1') : String(head || '');
  const t = Buffer.isBuffer(tail) ? tail.toString('latin1') : String(tail || '');
  return re.test(h) || re.test(t);
}

// Final server-side verdict on a stored object before scanning.
function verifyStoredObject({ extension, actualSize, maxFileBytes, head, tail }) {
  if (!Number.isFinite(actualSize) || actualSize <= 0) {
    return { ok: false, code: 'empty', reason: 'The uploaded file is empty.' };
  }
  if (actualSize > maxFileBytes) {
    return { ok: false, code: 'size', reason: `The uploaded file exceeds the ${formatBytes(maxFileBytes)} limit.` };
  }
  const detected = sniffType(head);
  if (['zip', 'rar', '7z', 'gz'].includes(detected)) {
    return { ok: false, code: 'archive', reason: 'Archives (ZIP, RAR, 7z) are not accepted. Please upload each document separately.', detected };
  }
  if (detected !== canonicalExtension(extension)) {
    return { ok: false, code: 'mismatch', reason: `The file contents do not match a ${(TYPE_TABLE[extension] || {}).label || extension.toUpperCase()} file.`, detected };
  }
  if (detected === 'pdf' && pdfLooksEncrypted(head, tail)) {
    return { ok: false, code: 'encrypted', reason: 'This PDF is password-protected. Please remove the password (Print to PDF works) and upload it again.', detected };
  }
  return { ok: true, detected };
}

module.exports = {
  TYPE_TABLE,
  canonicalExtension,
  extensionOf,
  mimeForExtension,
  sanitizeFilename,
  validateDeclaredFile,
  formatBytes,
  sniffType,
  pdfLooksEncrypted,
  verifyStoredObject,
};
