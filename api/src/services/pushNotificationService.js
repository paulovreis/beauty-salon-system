import admin from 'firebase-admin';
import buildErrorResponse from '../utils/errorResponse.js';
import { decryptString } from '../utils/fieldCrypto.js';

let firebaseApp = null;

function isPushEnabled() {
  return String(process.env.PUSH_ENABLED || '').toLowerCase() === 'true';
}

function parseServiceAccountFromEnv() {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();

  let jsonText = rawJson;
  if (!jsonText && b64) {
    try {
      jsonText = Buffer.from(b64, 'base64').toString('utf8');
    } catch (e) {
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_BASE64');
    }
  }

  if (!jsonText) return null;

  let obj;
  try {
    obj = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON (must be valid JSON)');
  }

  if (obj.private_key && typeof obj.private_key === 'string') {
    // Common env formatting issue: newlines escaped.
    obj.private_key = obj.private_key.replace(/\\n/g, '\n');
  }

  return obj;
}

function getFirebaseApp() {
  if (!isPushEnabled()) return null;
  if (firebaseApp) return firebaseApp;

  const serviceAccount = parseServiceAccountFromEnv();
  if (!serviceAccount) return null;

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return firebaseApp;
  } catch (err) {
    // If initialized elsewhere, reuse default.
    if (err?.message?.includes('already exists')) {
      firebaseApp = admin.app();
      return firebaseApp;
    }
    throw err;
  }
}

function toFcmData(data) {
  if (!data) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || typeof v === 'undefined') continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

function isInvalidTokenErrorCode(code) {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-argument'
  );
}

export async function sendPushToClient(db, {
  clientId,
  title,
  body,
  data,
}) {
  if (!isPushEnabled()) return;

  let app;
  try {
    app = getFirebaseApp();
  } catch (err) {
    console.warn('Push init warning:', err?.message || err);
    return;
  }

  if (!app) return;
  if (!clientId) return;

  try {
    const { rows } = await db.query(
      `SELECT id, token_enc
       FROM client_devices
       WHERE client_id = $1 AND enabled = TRUE`,
      [clientId]
    );

    if (!rows.length) return;

    const tokens = rows
      .map((r) => (r.token_enc ? decryptString(r.token_enc) : null))
      .filter(Boolean);

    if (!tokens.length) return;

    const message = {
      tokens,
      notification: {
        title: title || 'Notificação',
        body: body || '',
      },
      data: toFcmData(data),
    };

    const result = await admin.messaging().sendEachForMulticast(message);

    // Disable invalid tokens (best-effort)
    const invalidDeviceIds = [];
    result.responses.forEach((resp, idx) => {
      if (resp.success) return;
      const code = resp.error?.code;
      if (isInvalidTokenErrorCode(code)) {
        const deviceId = rows[idx]?.id;
        if (deviceId) invalidDeviceIds.push(deviceId);
      }
    });

    if (invalidDeviceIds.length) {
      try {
        await db.query(
          `UPDATE client_devices
           SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::int[])`,
          [invalidDeviceIds]
        );
      } catch (e) {
        console.warn('Push token disable warning:', e?.message || e);
      }
    }

    return result;
  } catch (err) {
    console.warn('Push send warning:', err?.message || err, buildErrorResponse(err));
  }
}
