import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // recommended for GCM
const TAG_LEN = 16;

function decodeKeyFromEnv(value, { name }) {
  if (!value) return null;

  // Accept base64/base64url/hex.
  const trimmed = value.trim();

  // hex (64 chars => 32 bytes)
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  // base64url -> base64
  const b64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    throw new Error(`Invalid ${name}: expected base64/base64url/hex`);
  }
}

function loadKeyRing(prefix) {
  // Keys are expected as e.g. DATA_ENCRYPTION_KEY_V1, DATA_ENCRYPTION_KEY_V2...
  const ring = new Map();
  for (const [envName, envValue] of Object.entries(process.env)) {
    if (!envName.startsWith(prefix)) continue;

    const kid = envName.substring(prefix.length).toLowerCase(); // V1 -> v1
    const key = decodeKeyFromEnv(envValue, { name: envName });
    if (key) ring.set(kid, key);
  }
  return ring;
}

const ACTIVE_KID = (process.env.DATA_ENCRYPTION_ACTIVE_KID || '').trim().toLowerCase();
const ENC_KEYS = loadKeyRing('DATA_ENCRYPTION_KEY_');
const HMAC_KEYS = loadKeyRing('DATA_ENCRYPTION_HMAC_KEY_');

function getActiveKid() {
  if (ACTIVE_KID) return ACTIVE_KID;

  // Backward-friendly default when only V1 exists.
  if (ENC_KEYS.has('v1')) return 'v1';
  return null;
}

function getEncKey(kid) {
  const key = ENC_KEYS.get(kid);
  if (!key) throw new Error(`Missing encryption key for kid='${kid}'. Set DATA_ENCRYPTION_KEY_${kid.toUpperCase()}.`);
  if (key.length !== 32) throw new Error(`Invalid encryption key length for kid='${kid}'. Expected 32 bytes.`);
  return key;
}

function getHmacKey(kid) {
  const key = HMAC_KEYS.get(kid);
  if (!key) throw new Error(`Missing HMAC key for kid='${kid}'. Set DATA_ENCRYPTION_HMAC_KEY_${kid.toUpperCase()}.`);
  if (key.length < 32) throw new Error(`Invalid HMAC key length for kid='${kid}'. Expected >= 32 bytes.`);
  return key;
}

export function isEncryptedPayload(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 4) return false;
  const [kid, ivB64, ctB64, tagB64] = parts;
  if (!kid || !ivB64 || !ctB64 || !tagB64) return false;
  if (!ENC_KEYS.has(kid.toLowerCase())) return false;
  return true;
}

export function encryptString(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const normalized = String(plaintext);
  if (normalized.length === 0) return null;

  const kid = getActiveKid();
  if (!kid) {
    throw new Error('DATA_ENCRYPTION_ACTIVE_KID (or DATA_ENCRYPTION_KEY_V1) must be configured');
  }

  const key = getEncKey(kid);
  const iv = randomBytes(IV_LEN);

  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${kid}:${iv.toString('base64')}:${ciphertext.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptString(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== 'string') return String(payload);
  if (!isEncryptedPayload(payload)) return payload; // backward-compatible

  const [kidRaw, ivB64, ctB64, tagB64] = payload.split(':');
  const kid = kidRaw.toLowerCase();
  const key = getEncKey(kid);

  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function normalizeEmail(email) {
  if (email === null || email === undefined) return null;
  const v = String(email).trim().toLowerCase();
  return v.length ? v : null;
}

export function normalizePhoneBR(phone) {
  if (phone === null || phone === undefined) return null;
  const digits = String(phone).replace(/\D+/g, '');
  if (!digits) return null;

  // Accept local numbers, or already prefixed with 55.
  let normalized = digits;
  if (normalized.startsWith('0')) normalized = normalized.replace(/^0+/, '');
  if (!normalized.startsWith('55')) normalized = `55${normalized}`;
  return `+${normalized}`;
}

export function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length ? v : null;
}

export function hmacSha256Hex(value, { kid } = {}) {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (!str.length) return null;

  const resolvedKid = (kid || getActiveKid());
  if (!resolvedKid) {
    throw new Error('DATA_ENCRYPTION_ACTIVE_KID (or DATA_ENCRYPTION_HMAC_KEY_V1) must be configured');
  }
  const key = getHmacKey(resolvedKid);
  return createHmac('sha256', key).update(str, 'utf8').digest('hex');
}

export function constantTimeEqualsHex(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
