const test = require('node:test');
const assert = require('node:assert/strict');
const { randomToken, sha256, hashIp, generateOtp, safeEqualHex, generateReference } = require('../netlify/functions/lib/crypto');
const { parseCookies, cookieHeader, originAllowed, routeOf, parseBody } = require('../netlify/functions/lib/http');
const { interpretClamResponse } = require('../netlify/functions/lib/scanner');
const { otpMessage, receiptMessage } = require('../netlify/functions/lib/email');

test('tokens and hashes', () => {
  const t = randomToken(32);
  assert.ok(t.length >= 40);
  assert.notEqual(randomToken(32), t);
  assert.equal(sha256('a').length, 64);
  assert.equal(sha256('a'), sha256('a'));
  assert.notEqual(hashIp('1.2.3.4', 'p1'), hashIp('1.2.3.4', 'p2'));
  assert.ok(!hashIp('1.2.3.4', 'p1').includes('1.2.3.4'));
});

test('otp is six digits and compares in constant time', () => {
  for (let i = 0; i < 50; i++) assert.match(generateOtp(), /^\d{6}$/);
  assert.equal(safeEqualHex(sha256('123456'), sha256('123456')), true);
  assert.equal(safeEqualHex(sha256('123456'), sha256('123457')), false);
  assert.equal(safeEqualHex('abc', 'abcd'), false);
  assert.equal(safeEqualHex(undefined, 'ab'), false);
});

test('reference format', () => {
  assert.match(generateReference(new Date('2026-11-24T00:00:00Z')), /^CR-2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
});

test('cookies', () => {
  const h = cookieHeader('crown_portal', 'abc', { maxAge: 60, path: '/api/portal' });
  assert.ok(h.includes('HttpOnly'));
  assert.ok(h.includes('Secure'));
  assert.ok(h.includes('SameSite=Strict'));
  assert.ok(h.includes('Path=/api/portal'));
  assert.deepEqual(parseCookies({ headers: { cookie: 'a=1; crown_portal=xyz; b=2' } }), { a: '1', crown_portal: 'xyz', b: '2' });
  assert.deepEqual(parseCookies({ headers: {} }), {});
});

test('origin check refuses cross-site and missing origin', () => {
  const ev = (origin, host) => ({ headers: { origin, host } });
  assert.equal(originAllowed(ev('https://crownconsultingteam.com', 'crownconsultingteam.com'), ''), true);
  assert.equal(originAllowed(ev('https://evil.example', 'crownconsultingteam.com'), ''), false);
  assert.equal(originAllowed(ev(undefined, 'crownconsultingteam.com'), ''), false);
  assert.equal(originAllowed(ev('https://staging--crownconsulting.netlify.app', 'other.host'), 'https://staging--crownconsulting.netlify.app'), true);
  assert.equal(originAllowed(ev('null', 'crownconsultingteam.com'), ''), false);
});

test('route extraction handles both rewritten and direct paths', () => {
  assert.equal(routeOf({ path: '/api/portal/send-code' }, 'portal'), 'send-code');
  assert.equal(routeOf({ path: '/.netlify/functions/portal/verify-code/' }, 'portal'), 'verify-code');
  assert.equal(routeOf({ path: '/api/staff/requests/abc/issue' }, 'staff'), 'requests/abc/issue');
  assert.equal(routeOf({ path: '/api/portal' }, 'portal'), '');
});

test('parseBody', () => {
  assert.deepEqual(parseBody({ body: '{"a":1}' }), { a: 1 });
  assert.deepEqual(parseBody({ body: '' }), {});
  assert.equal(parseBody({ body: 'not json' }), null);
  assert.deepEqual(parseBody({ body: Buffer.from('{"b":2}').toString('base64'), isBase64Encoded: true }), { b: 2 });
  assert.deepEqual(parseBody({ body: '[1,2]' }), [1, 2]);
});

test('scanner response shapes', () => {
  assert.equal(interpretClamResponse({ success: true, data: { result: [{ is_infected: false }] } }).verdict, 'clean');
  assert.equal(interpretClamResponse({ success: true, data: { result: [{ is_infected: true, viruses: ['Eicar'] }] } }).verdict, 'infected');
  assert.equal(interpretClamResponse({ Status: 'OK' }).verdict, 'clean');
  assert.equal(interpretClamResponse({ Status: 'FOUND', Description: 'Eicar' }).verdict, 'infected');
  assert.equal(interpretClamResponse({ infected: false }).verdict, 'clean');
  assert.equal(interpretClamResponse({ weird: true }).verdict, 'error');
  assert.equal(interpretClamResponse(null).verdict, 'error');
});

test('emails never include filenames or tokens', () => {
  const m = otpMessage({ code: '123456', orgName: 'Acme <Co>', ttlMinutes: 10 });
  assert.ok(m.text.includes('123456'));
  assert.ok(m.html.includes('Acme &lt;Co&gt;'));
  const r = receiptMessage({ reference: 'CR-2026-ABCDE', orgName: 'Acme', newFiles: 2, totalFiles: 5 });
  assert.ok(r.subject.includes('CR-2026-ABCDE'));
  assert.ok(r.text.includes('2 new files'));
  assert.ok(!/\.pdf|\.png|\.jpg/i.test(r.text));
});
