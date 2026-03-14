import pool from '../../db/postgre.js';
import buildErrorResponse from '../../utils/errorResponse.js';
import {
  decryptString,
  encryptString,
  hmacSha256Hex,
  normalizePhoneBR,
  normalizeText,
} from '../../utils/fieldCrypto.js';

const getPool = (req) => req.pool || pool;

function decryptClientRow(row) {
  if (!row) return row;

  const phone = row.phone_enc ? decryptString(row.phone_enc) : row.phone;
  const address = row.address_enc ? decryptString(row.address_enc) : row.address;
  const birth_date = row.birth_date_enc ? decryptString(row.birth_date_enc) : row.birth_date;

  // eslint-disable-next-line no-unused-vars
  const { phone_enc, address_enc, birth_date_enc, phone_hash, email_hash, email_enc, notes_enc, ...rest } = row;
  return { ...rest, phone, address, birth_date };
}

function deriveBirthParts(birthDateValue) {
  if (!birthDateValue) return { birth_month: null, birth_day: null };
  const d = new Date(birthDateValue);
  if (Number.isNaN(d.getTime())) return { birth_month: null, birth_day: null };
  return { birth_month: d.getUTCMonth() + 1, birth_day: d.getUTCDate() };
}

const MobileMeController = {
  async getMe(req, res) {
    const db = getPool(req);
    try {
      const userId = req.user?.id;
      const clientId = req.user?.client_id;
      if (!userId || !clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const { rows } = await db.query(
        `SELECT
           u.id as user_id,
           u.role,
           u.created_at as user_created_at,
           c.*
         FROM users u
         JOIN clients c ON c.user_id = u.id
         WHERE u.id = $1 AND c.id = $2
         LIMIT 1`,
        [userId, clientId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }

      const row = rows[0];
      const client = decryptClientRow(row);

      return res.json({
        user: { id: row.user_id, role: row.role, created_at: row.user_created_at },
        client,
      });
    } catch (err) {
      console.error('Mobile getMe error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async updateMe(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const {
        name,
        phone,
        address,
        birth_date,
      } = req.body || {};

      // Load current values to support partial updates.
      const { rows: currentRows } = await db.query(
        'SELECT id, name, phone, phone_enc, phone_hash, address, address_enc, birth_date, birth_date_enc, birth_month, birth_day FROM clients WHERE id = $1 LIMIT 1',
        [clientId]
      );
      if (!currentRows.length) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      const current = currentRows[0];

      const nextName = typeof name === 'undefined' ? current.name : (normalizeText(name) || name);

      let nextPhoneEnc = current.phone_enc;
      let nextPhoneHash = current.phone_hash;
      if (typeof phone !== 'undefined') {
        const normalizedPhone = normalizePhoneBR(phone);
        if (phone && !normalizedPhone) {
          return res.status(400).json({ message: 'Telefone inválido' });
        }
        if (!normalizedPhone) {
          nextPhoneEnc = null;
          nextPhoneHash = null;
        } else {
          nextPhoneEnc = encryptString(normalizedPhone);
          nextPhoneHash = hmacSha256Hex(normalizedPhone);
        }
      }

      let nextAddressEnc = current.address_enc;
      if (typeof address !== 'undefined') {
        const normalizedAddress = normalizeText(address);
        nextAddressEnc = normalizedAddress ? encryptString(normalizedAddress) : null;
      }

      let nextBirthDateEnc = current.birth_date_enc;
      let nextBirthMonth = current.birth_month;
      let nextBirthDay = current.birth_day;
      if (typeof birth_date !== 'undefined') {
        const birthDateValue = birth_date ? String(birth_date) : null;
        if (birthDateValue) {
          const parsed = new Date(birthDateValue);
          if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ message: 'Data de nascimento inválida' });
          }
        }

        nextBirthDateEnc = birthDateValue ? encryptString(birthDateValue) : null;
        const parts = deriveBirthParts(birthDateValue);
        nextBirthMonth = parts.birth_month;
        nextBirthDay = parts.birth_day;
      }

      const { rows } = await db.query(
        `UPDATE clients
         SET name = $1,
             phone = NULL,
             phone_enc = $2,
             phone_hash = $3,
             address = NULL,
             address_enc = $4,
             birth_date = NULL,
             birth_date_enc = $5,
             birth_month = $6,
             birth_day = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [
          nextName,
          nextPhoneEnc,
          nextPhoneHash,
          nextAddressEnc,
          nextBirthDateEnc,
          nextBirthMonth,
          nextBirthDay,
          clientId,
        ]
      );

      return res.json({ client: decryptClientRow(rows[0]) });
    } catch (err) {
      console.error('Mobile updateMe error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobileMeController;
