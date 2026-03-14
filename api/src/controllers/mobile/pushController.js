import pool from '../../db/postgre.js';
import buildErrorResponse from '../../utils/errorResponse.js';
import { encryptString, hmacSha256Hex, normalizeText } from '../../utils/fieldCrypto.js';

const getPool = (req) => req.pool || pool;

function normalizePlatform(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'android' || v === 'ios' || v === 'web') return v;
  return null;
}

const MobilePushController = {
  async register(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const token = normalizeText(req.body?.token);
      const platform = normalizePlatform(req.body?.platform);

      if (!token) return res.status(400).json({ message: 'token é obrigatório' });
      if (!platform) return res.status(400).json({ message: 'platform inválido (android|ios|web)' });

      const tokenHash = hmacSha256Hex(token);
      const tokenEnc = encryptString(token);

      // Upsert by token_hash (unique)
      const { rows } = await db.query(
        `INSERT INTO client_devices (client_id, platform, token_enc, token_hash, enabled, last_seen)
         VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)
         ON CONFLICT (token_hash)
         DO UPDATE SET
           client_id = EXCLUDED.client_id,
           platform = EXCLUDED.platform,
           token_enc = EXCLUDED.token_enc,
           enabled = TRUE,
           last_seen = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, client_id, platform, enabled, last_seen, created_at, updated_at`,
        [clientId, platform, tokenEnc, tokenHash]
      );

      return res.status(201).json({ device: rows[0] });
    } catch (err) {
      console.error('Mobile push register error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async unregister(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const token = normalizeText(req.body?.token);
      if (!token) return res.status(400).json({ message: 'token é obrigatório' });

      const tokenHash = hmacSha256Hex(token);

      const result = await db.query(
        `UPDATE client_devices
         SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE client_id = $1 AND token_hash = $2`,
        [clientId, tokenHash]
      );

      return res.json({ success: true, disabled: result.rowCount });
    } catch (err) {
      console.error('Mobile push unregister error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobilePushController;
