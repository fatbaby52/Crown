// Transactional email. Resend in production; a console provider for local
// development that must never be enabled where PORTAL_MODE=live.

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendViaResend(env, { to, subject, text, html }) {
  if (!env.resendApiKey || !env.fromEmail) throw new Error('Resend is not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.fromEmail, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend error HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendEmail(env, message) {
  if (env.emailProvider === 'console') {
    if (env.mode === 'live') throw new Error('EMAIL_PROVIDER=console is not allowed when PORTAL_MODE=live');
    console.log(`[portal dev email] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }
  return sendViaResend(env, message);
}

function otpMessage({ code, orgName, ttlMinutes }) {
  const subject = `Your Crown Consulting verification code: ${code}`;
  const text = [
    `Your verification code is ${code}.`,
    '',
    `It expires in ${ttlMinutes} minutes and can be used once. Enter it on the Crown Consulting upload page you opened for ${orgName}.`,
    '',
    'If you did not request this code, you can ignore this email.',
    '',
    'Crown Consulting Team',
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <p style="font-size:15px">Your verification code is</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:8px 0 16px">${escapeHtml(code)}</p>
      <p style="font-size:14px;color:#444">It expires in ${ttlMinutes} minutes and can be used once. Enter it on the Crown Consulting upload page you opened for <strong>${escapeHtml(orgName)}</strong>.</p>
      <p style="font-size:13px;color:#777">If you did not request this code, you can ignore this email.</p>
      <p style="font-size:13px;color:#777">Crown Consulting Team</p>
    </div>`;
  return { subject, text, html };
}

// Receipt to Crown: reference and counts only. Never filenames, contents,
// attachments or tokens.
function receiptMessage({ reference, orgName, newFiles, totalFiles }) {
  const subject = `[Upload portal] ${reference}: ${newFiles} new file${newFiles === 1 ? '' : 's'} received`;
  const text = [
    `Request ${reference} (${orgName}) received ${newFiles} new file${newFiles === 1 ? '' : 's'}.`,
    `Total files on this request: ${totalFiles}.`,
    '',
    'Files are checked before release. Sign in to the staff console to review and download them.',
  ].join('\n');
  return { subject, text, html: `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>` };
}

module.exports = { sendEmail, otpMessage, receiptMessage, escapeHtml };
