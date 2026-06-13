import axios from 'axios';
import crypto from 'crypto';
import { decryptString, encryptString } from '../utils/fieldCrypto.js';

const MP_API_BASE_URL = process.env.MP_API_BASE_URL || 'https://api.mercadopago.com';
const MP_AUTH_BASE_URL = process.env.MP_AUTH_BASE_URL || 'https://auth.mercadopago.com';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    const err = new Error(`Missing env var: ${name}`);
    err.statusCode = 500;
    throw err;
  }
  return value;
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecodeToString(input) {
  const b64 = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function hmacHex(value, secret) {
  return crypto.createHmac('sha256', secret).update(String(value), 'utf8').digest('hex');
}

export function buildConnectUrl({ userId }) {
  const clientId = requireEnv('MP_CLIENT_ID');
  const redirectUri = requireEnv('MP_OAUTH_REDIRECT_URI');
  const stateSecret = requireEnv('JWT_SECRET');

  const payload = {
    uid: Number(userId),
    iat: Date.now(),
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = hmacHex(payloadB64, stateSecret);
  const state = `${payloadB64}.${sig}`;

  const url = new URL('/authorization', MP_AUTH_BASE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  // Optional: force login each time
  if (String(process.env.MP_PROMPT || '').trim()) {
    url.searchParams.set('prompt', String(process.env.MP_PROMPT).trim());
  }

  return url.toString();
}

export function parseAndValidateState(state) {
  if (!state || typeof state !== 'string') {
    const err = new Error('Missing state');
    err.statusCode = 400;
    throw err;
  }
  const [payloadB64, sig] = state.split('.');
  if (!payloadB64 || !sig) {
    const err = new Error('Invalid state');
    err.statusCode = 400;
    throw err;
  }
  const stateSecret = requireEnv('JWT_SECRET');
  const expected = hmacHex(payloadB64, stateSecret);

  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error('Invalid state signature');
    err.statusCode = 400;
    throw err;
  }

  let decoded;
  try {
    decoded = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    const err = new Error('Invalid state payload');
    err.statusCode = 400;
    throw err;
  }

  if (!decoded?.uid || !Number.isFinite(Number(decoded.uid))) {
    const err = new Error('Invalid state uid');
    err.statusCode = 400;
    throw err;
  }

  return { userId: Number(decoded.uid) };
}

export async function exchangeCodeForTokens({ code }) {
  const clientId = requireEnv('MP_CLIENT_ID');
  const clientSecret = requireEnv('MP_CLIENT_SECRET');
  const redirectUri = requireEnv('MP_OAUTH_REDIRECT_URI');

  const url = `${MP_API_BASE_URL}/oauth/token`;
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', redirectUri);

  let res;
  try {
    res = await axios.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
  } catch (axiosErr) {
    const mpError = axiosErr?.response?.data;
    console.error('MP exchangeCodeForTokens failed:', JSON.stringify(mpError));
    console.error('MP request body (redacted secret):', { client_id: clientId, grant_type: 'authorization_code', redirect_uri: redirectUri, code });
    const err = new Error(mpError?.message || mpError?.error || 'MP token exchange failed');
    err.statusCode = axiosErr?.response?.status || 500;
    err.mpError = mpError;
    throw err;
  }

  return res.data;
}

export async function refreshAccessToken({ refreshToken }) {
  const clientId = requireEnv('MP_CLIENT_ID');
  const clientSecret = requireEnv('MP_CLIENT_SECRET');

  const url = `${MP_API_BASE_URL}/oauth/token`;
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const res = await axios.post(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });

  return res.data;
}

export async function getValidAccessTokenForUser({ db, userId }) {
  // Conexão Mercado Pago é GLOBAL para o sistema (uma conta), independente do usuário.
  // Mantemos a assinatura por compatibilidade com os controllers já existentes.
  void userId;

  const { rows } = await db.query(
    `SELECT id, user_id, access_token_enc, refresh_token_enc, expires_at
     FROM mercadopago_accounts
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`
  );

  if (!rows.length || !rows[0].access_token_enc) {
    const err = new Error('Nenhuma conta Mercado Pago conectada ainda');
    err.statusCode = 400;
    throw err;
  }

  const accountId = rows[0].id;
  const accessToken = decryptString(rows[0].access_token_enc);
  const refreshToken = rows[0].refresh_token_enc ? decryptString(rows[0].refresh_token_enc) : null;
  const expiresAt = rows[0].expires_at ? new Date(rows[0].expires_at).getTime() : null;
  const now = Date.now();

  // Refresh if expires in < 60s
  if (expiresAt && refreshToken && expiresAt - now < 60_000) {
    const refreshed = await refreshAccessToken({ refreshToken });
    const newAccessTokenEnc = refreshed.access_token ? encryptString(refreshed.access_token) : null;
    const newRefreshTokenEnc = refreshed.refresh_token ? encryptString(refreshed.refresh_token) : null;
    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + Number(refreshed.expires_in) * 1000)
      : null;

    await db.query(
      `UPDATE mercadopago_accounts
       SET access_token_enc = $2,
           refresh_token_enc = COALESCE($3, refresh_token_enc),
           token_type = COALESCE($4, token_type),
           scope = COALESCE($5, scope),
           expires_at = $6,
           updated_at = NOW()
       WHERE id = $1`,
      [accountId, newAccessTokenEnc, newRefreshTokenEnc, refreshed.token_type || null, refreshed.scope || null, newExpiresAt]
    );

    return refreshed.access_token;
  }

  return accessToken;
}

function getFallbackPayerEmail(clientId) {
  const domain = (process.env.MP_FALLBACK_PAYER_EMAIL_DOMAIN || 'example.com').trim();
  return `cliente${clientId}@${domain}`;
}

export async function createPixPayment({ accessToken, appointment, payerEmail, notificationUrl, idempotencyKey }) {
  const url = `${MP_API_BASE_URL}/v1/payments`;
  const body = {
    transaction_amount: Number(appointment.amount),
    description: appointment.description,
    payment_method_id: 'pix',
    payer: {
      email: payerEmail,
    },
    external_reference: appointment.externalReference,
  };

  if (notificationUrl) body.notification_url = notificationUrl;

  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    timeout: 20000,
  });

  const data = res.data;
  const td = data?.point_of_interaction?.transaction_data || {};

  return {
    mpPaymentId: data?.id != null ? String(data.id) : null,
    status: data?.status ? String(data.status) : null,
    statusDetail: data?.status_detail ? String(data.status_detail) : null,
    expiresAt: data?.date_of_expiration ? new Date(data.date_of_expiration) : null,
    qrCode: td?.qr_code || null,
    qrCodeBase64: td?.qr_code_base64 || null,
    ticketUrl: td?.ticket_url || null,
    raw: data,
  };
}

export async function fetchPayment({ accessToken, mpPaymentId }) {
  const url = `${MP_API_BASE_URL}/v1/payments/${encodeURIComponent(String(mpPaymentId))}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });
  return res.data;
}

export function extractPixDetailsFromPayment(payment) {
  const td = payment?.point_of_interaction?.transaction_data || {};
  return {
    status: payment?.status ? String(payment.status) : null,
    statusDetail: payment?.status_detail ? String(payment.status_detail) : null,
    expiresAt: payment?.date_of_expiration ? new Date(payment.date_of_expiration) : null,
    qrCode: td?.qr_code || null,
    qrCodeBase64: td?.qr_code_base64 || null,
    ticketUrl: td?.ticket_url || null,
  };
}

export function computeDefaultPayerEmail({ clientId, clientEmail }) {
  const normalized = (clientEmail || '').trim();
  if (normalized) return normalized;
  return getFallbackPayerEmail(clientId);
}
