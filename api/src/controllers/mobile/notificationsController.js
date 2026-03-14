import pool from '../../db/postgre.js';
import buildErrorResponse from '../../utils/errorResponse.js';

const getPool = (req) => req.pool || pool;

function parsePagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const pageRaw = Number.parseInt(req.query.page, 10);
  const limitRaw = Number.parseInt(req.query.limit, 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, maxLimit) : defaultLimit;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

const MobileNotificationsController = {
  async list(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const { page, limit, offset } = parsePagination(req);

      const [{ rows }, { rows: countRows }] = await Promise.all([
        db.query(
          `SELECT id, client_id, type, title, body, data, is_read, read_at, created_at
           FROM client_notifications
           WHERE client_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [clientId, limit, offset]
        ),
        db.query(
          'SELECT COUNT(*)::int as total FROM client_notifications WHERE client_id = $1',
          [clientId]
        ),
      ]);

      const total = countRows?.[0]?.total ?? 0;

      return res.json({
        notifications: rows,
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      console.error('Mobile notifications list error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async markAllRead(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const result = await db.query(
        `UPDATE client_notifications
         SET is_read = TRUE,
             read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE client_id = $1 AND is_read = FALSE`,
        [clientId]
      );

      return res.json({ success: true, updated: result.rowCount });
    } catch (err) {
      console.error('Mobile notifications markAllRead error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async markRead(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const { rows } = await db.query(
        `UPDATE client_notifications
         SET is_read = TRUE,
             read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE id = $1 AND client_id = $2
         RETURNING id, client_id, type, title, body, data, is_read, read_at, created_at`,
        [id, clientId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: 'Notificação não encontrada' });
      }

      return res.json({ notification: rows[0] });
    } catch (err) {
      console.error('Mobile notifications markRead error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobileNotificationsController;
