// Malware scanner adapters. Every adapter returns
//   { verdict: 'clean' | 'infected' | 'error', detail: object }
// and the caller fails closed on anything but 'clean'.
//
// Providers:
//   none          -> always 'error' (no scanner configured). Files stay locked.
//   clamav-rest   -> POST the bytes to a private ClamAV REST endpoint you host
//                    (SCANNER_URL, optional SCANNER_TOKEN). Accepts the two
//                    common response shapes used by clamav-rest images.
//   staging-stub  -> marks files clean WITHOUT scanning. Honoured only when
//                    PORTAL_ENV=staging; anywhere else it behaves like 'none'.

function interpretClamResponse(body) {
  // Shape A (benzino77/clamav-rest-api): { success, data: { result: [{ name, is_infected, viruses }] } }
  if (body && body.data && Array.isArray(body.data.result)) {
    const r = body.data.result[0] || {};
    return r.is_infected ? { verdict: 'infected', detail: { viruses: r.viruses || [] } } : { verdict: 'clean', detail: {} };
  }
  // Shape B (ajilaag/clamav-rest): { Status: 'OK' | 'FOUND', Description }
  if (body && typeof body.Status === 'string') {
    if (body.Status === 'OK') return { verdict: 'clean', detail: {} };
    if (body.Status === 'FOUND') return { verdict: 'infected', detail: { description: body.Description || '' } };
    return { verdict: 'error', detail: { status: body.Status } };
  }
  // Shape C: { infected: boolean, viruses?: [] }
  if (body && typeof body.infected === 'boolean') {
    return body.infected ? { verdict: 'infected', detail: { viruses: body.viruses || [] } } : { verdict: 'clean', detail: {} };
  }
  return { verdict: 'error', detail: { reason: 'unrecognised scanner response' } };
}

async function scanWithClamRest(env, bytes, filename) {
  if (!env.scannerUrl) return { verdict: 'error', detail: { reason: 'SCANNER_URL not set' } };
  const form = new FormData();
  // Do not leak the client's original filename to the scanner; use the object id.
  form.append('FILES', new Blob([bytes]), filename);
  form.append('file', new Blob([bytes]), filename);
  const headers = {};
  if (env.scannerToken) headers.Authorization = `Bearer ${env.scannerToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const res = await fetch(`${env.scannerUrl}/api/v1/scan`, { method: 'POST', headers, body: form, signal: controller.signal })
      .catch(() => fetch(`${env.scannerUrl}/scan`, { method: 'POST', headers, body: form, signal: controller.signal }));
    if (!res.ok) return { verdict: 'error', detail: { reason: `scanner HTTP ${res.status}` } };
    const body = await res.json().catch(() => null);
    return interpretClamResponse(body);
  } catch (err) {
    return { verdict: 'error', detail: { reason: err && err.name === 'AbortError' ? 'scanner timeout' : 'scanner unreachable' } };
  } finally {
    clearTimeout(timer);
  }
}

async function scanBytes(env, bytes, safeName) {
  switch (env.scannerProvider) {
    case 'clamav-rest':
      return scanWithClamRest(env, bytes, safeName);
    case 'staging-stub':
      if (env.deployEnv === 'staging') return { verdict: 'clean', detail: { stub: true } };
      return { verdict: 'error', detail: { reason: 'staging-stub refused outside staging' } };
    case 'none':
    default:
      return { verdict: 'error', detail: { reason: 'no scanner configured' } };
  }
}

module.exports = { scanBytes, interpretClamResponse };
