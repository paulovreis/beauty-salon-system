import pool from '../../db/postgre.js';
import buildErrorResponse from '../../utils/errorResponse.js';
import { decryptString } from '../../utils/fieldCrypto.js';
import { toDateOnlyString } from '../../utils/dateOnly.js';

const getPool = (req) => req.pool || pool;

function mapAppointmentRow(row) {
  if (!row) return row;
  const out = { ...row };
  if ('appointment_date' in out) {
    out.appointment_date = toDateOnlyString(out.appointment_date);
  }
  if ('notes_enc' in out) {
    out.notes = out.notes_enc ? decryptString(out.notes_enc) : out.notes;
    delete out.notes_enc;
  }
  return out;
}

const MobileDashboardController = {
  async getDashboard(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const [nextApptResult, unreadResult] = await Promise.all([
        db.query(
          `SELECT
             a.id,
             a.employee_id,
             a.service_id,
             a.appointment_date,
             a.appointment_time,
             a.duration_minutes,
             a.status,
             a.price,
             a.notes,
             a.notes_enc,
             e.name AS employee_name,
             s.name AS service_name
           FROM appointments a
           JOIN employees e ON e.id = a.employee_id
           JOIN services s ON s.id = a.service_id
           WHERE a.client_id = $1
             AND a.appointment_date >= CURRENT_DATE
             AND a.status IN ('scheduled','confirmed')
           ORDER BY a.appointment_date ASC, a.appointment_time ASC
           LIMIT 1`,
          [clientId]
        ),
        db.query(
          `SELECT COUNT(*)::int AS unread
           FROM client_notifications
           WHERE client_id = $1 AND is_read = FALSE`,
          [clientId]
        ),
      ]);

      const nextAppointment = nextApptResult.rows.length ? mapAppointmentRow(nextApptResult.rows[0]) : null;
      const unreadNotifications = unreadResult.rows?.[0]?.unread ?? 0;

      return res.json({
        nextAppointment,
        unreadNotifications,
      });
    } catch (err) {
      console.error('Mobile dashboard error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobileDashboardController;
