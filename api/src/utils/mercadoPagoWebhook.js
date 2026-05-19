import crypto from 'crypto';

function parseXSignature(headerValue) {
  const raw = String(headerValue || '').trim();
  if (!raw) return null;

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  const result = {};
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = value;
  }

  if (!result.ts || !result.v1) return null;
  return { ts: result.ts, v1: result.v1 };
}

function timingSafeEqualHex(aHex, bHex) {
  if (!aHex || !bHex) return false;
  const a = Buffer.from(String(aHex), 'hex');
  const b = Buffer.from(String(bHex), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyMercadoPagoWebhookSignature({ signatureHeader, requestId, dataId }) {
  const secret = (process.env.MP_WEBHOOK_SECRET || '').trim();
  if (!secret) return false;

  const parsed = parseXSignature(signatureHeader);
  if (!parsed) return false;

  const ts = parsed.ts;
  const v1 = parsed.v1;
  const id = String(dataId || '').trim().toLowerCase();
  const reqId = String(requestId || '').trim();
  if (!id || !reqId || !ts) return false;

  const manifest = `id:${id};request-id:${reqId};ts:${ts};`;
  const computed = crypto.createHmac('sha256', secret).update(manifest, 'utf8').digest('hex');

  return timingSafeEqualHex(computed, v1);
}
