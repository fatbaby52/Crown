const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extensionOf, sanitizeFilename, validateDeclaredFile, sniffType, pdfLooksEncrypted, verifyStoredObject, canonicalExtension,
} = require('../netlify/functions/lib/files');

const limits = { allowedTypes: ['pdf', 'jpg', 'png'], maxFileBytes: 25 * 1024 * 1024, usedBytes: 0, maxTotalBytes: 250 * 1024 * 1024 };

test('extension handling', () => {
  assert.equal(extensionOf('Tax Return 2024.PDF'), 'pdf');
  assert.equal(extensionOf('photo.JPEG'), 'jpg');
  assert.equal(extensionOf('noext'), '');
  assert.equal(extensionOf('.hidden'), '');
  assert.equal(canonicalExtension('.Jpeg'), 'jpg');
});

test('sanitizeFilename strips paths and control chars', () => {
  assert.equal(sanitizeFilename('C:\\Users\\x\\invoice.pdf'), 'invoice.pdf');
  assert.equal(sanitizeFilename('../../etc/passwd.png'), 'passwd.png');
  assert.equal(sanitizeFilename('bad\u0000name\u001f.pdf'), 'badname.pdf');
  assert.equal(sanitizeFilename(''), 'upload');
  assert.ok(sanitizeFilename('a'.repeat(400) + '.pdf').length <= 180);
});

test('validateDeclaredFile enforces type, size and quota', () => {
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: 1000, mime: 'application/pdf' }, limits).ok, true);
  assert.equal(validateDeclaredFile({ filename: 'a.zip', size: 1000, mime: 'application/zip' }, limits).code, 'type');
  assert.equal(validateDeclaredFile({ filename: 'a.exe', size: 1000 }, limits).code, 'type');
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: 1000, mime: 'image/png' }, limits).code, 'type');
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: 1000, mime: 'application/octet-stream' }, limits).ok, true);
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: 0 }, limits).code, 'size');
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: limits.maxFileBytes + 1 }, limits).code, 'size');
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: 10 }, { ...limits, usedBytes: limits.maxTotalBytes - 5 }).code, 'quota');
  assert.equal(validateDeclaredFile({ filename: 'a.pdf', size: 10 }, { ...limits, allowedTypes: ['jpg'] }).code, 'type');
});

test('sniffType recognises signatures', () => {
  assert.equal(sniffType(Buffer.from('%PDF-1.7\n%âãÏÓ', 'latin1')), 'pdf');
  assert.equal(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'jpg');
  assert.equal(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(sniffType(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'zip');
  assert.equal(sniffType(Buffer.from('Rar!\x1a\x07\x00', 'latin1')), 'rar');
  assert.equal(sniffType(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])), '7z');
  assert.equal(sniffType(Buffer.from([0x1f, 0x8b, 0x08])), 'gz');
  assert.equal(sniffType(Buffer.from('hello')), 'unknown');
  assert.equal(sniffType(Buffer.alloc(0)), 'unknown');
});

test('pdfLooksEncrypted detects /Encrypt in head or tail', () => {
  const plainTail = Buffer.from('trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n123\n%%EOF');
  const encTail = Buffer.from('trailer\n<< /Size 10 /Root 1 0 R /Encrypt 9 0 R >>\nstartxref\n123\n%%EOF');
  assert.equal(pdfLooksEncrypted(Buffer.from('%PDF-1.4'), plainTail), false);
  assert.equal(pdfLooksEncrypted(Buffer.from('%PDF-1.4'), encTail), true);
  assert.equal(pdfLooksEncrypted(Buffer.from('%PDF-1.4 /Encrypt 5 0 R'), plainTail), true);
  // A content string containing the word "Encrypted" alone should not trip it.
  assert.equal(pdfLooksEncrypted(Buffer.from('%PDF-1.4 (Encrypted files are bad)'), plainTail), false);
});

test('verifyStoredObject rejects mismatches, archives, encrypted PDFs and oversize', () => {
  const pdfHead = Buffer.from('%PDF-1.5 stuff');
  const okTail = Buffer.from('trailer << >> %%EOF');
  assert.equal(verifyStoredObject({ extension: 'pdf', actualSize: 100, maxFileBytes: 1000, head: pdfHead, tail: okTail }).ok, true);
  assert.equal(verifyStoredObject({ extension: 'pdf', actualSize: 2000, maxFileBytes: 1000, head: pdfHead, tail: okTail }).code, 'size');
  assert.equal(verifyStoredObject({ extension: 'pdf', actualSize: 0, maxFileBytes: 1000, head: pdfHead, tail: okTail }).code, 'empty');
  assert.equal(verifyStoredObject({ extension: 'pdf', actualSize: 100, maxFileBytes: 1000, head: Buffer.from([0x50, 0x4b, 0x03, 0x04]), tail: okTail }).code, 'archive');
  assert.equal(verifyStoredObject({ extension: 'png', actualSize: 100, maxFileBytes: 1000, head: pdfHead, tail: okTail }).code, 'mismatch');
  assert.equal(verifyStoredObject({ extension: 'pdf', actualSize: 100, maxFileBytes: 1000, head: pdfHead, tail: Buffer.from('/Encrypt 1 0 R') }).code, 'encrypted');
  assert.equal(verifyStoredObject({ extension: 'jpg', actualSize: 100, maxFileBytes: 1000, head: Buffer.from([0xff, 0xd8, 0xff, 0xdb]), tail: Buffer.alloc(0) }).ok, true);
});
