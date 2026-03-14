import pool from '../../db/postgre.js';
import buildErrorResponse from '../../utils/errorResponse.js';

const getPool = (req) => req.pool || pool;

const MobileCatalogController = {
  async listServices(req, res) {
    const db = getPool(req);
    try {
      const { rows } = await db.query(
        `SELECT
           s.id,
           s.category_id,
           s.name,
           s.description,
           s.recommended_price,
           s.duration_minutes,
           s.is_active,
           sc.name as category_name
         FROM services s
         LEFT JOIN service_categories sc ON sc.id = s.category_id
         WHERE s.is_active = TRUE
         ORDER BY sc.name NULLS LAST, s.name`
      );
      return res.json({ services: rows });
    } catch (err) {
      console.error('Mobile listServices error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async listEmployees(req, res) {
    const db = getPool(req);
    try {
      const { rows } = await db.query(
        `SELECT id, name
         FROM employees
         WHERE status = 'active'
         ORDER BY name`
      );
      return res.json({ employees: rows });
    } catch (err) {
      console.error('Mobile listEmployees error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async listAvailableSlots(req, res) {
    const db = getPool(req);
    try {
      const employeeId = Number.parseInt(req.params.employeeId, 10);
      const date = String(req.params.date || '').trim();
      const serviceIdRaw = req.query.service_id;
      const serviceId = serviceIdRaw ? Number.parseInt(serviceIdRaw, 10) : null;

      if (!Number.isFinite(employeeId) || !date) {
        return res.status(400).json({ message: 'employeeId e date são obrigatórios' });
      }

      let durationMinutes = null;
      if (serviceIdRaw) {
        if (!Number.isFinite(serviceId)) {
          return res.status(400).json({ message: 'service_id inválido' });
        }
        const { rows: serviceRows } = await db.query(
          'SELECT duration_minutes FROM services WHERE id = $1 AND is_active = TRUE LIMIT 1',
          [serviceId]
        );
        if (!serviceRows.length) {
          return res.status(400).json({ message: 'Serviço inválido' });
        }
        durationMinutes = serviceRows[0].duration_minutes;
      }

      if (!durationMinutes) {
        const { rows } = await db.query(
          `SELECT start_time
           FROM time_slots
           WHERE employee_id = $1 AND date = $2 AND is_available = TRUE
           ORDER BY start_time`,
          [employeeId, date]
        );
        return res.json({ slots: rows.map((r) => r.start_time) });
      }

      // Filter considering overlaps with existing appointments.
      const { rows } = await db.query(
        `SELECT ts.start_time
         FROM time_slots ts
         WHERE ts.employee_id = $1
           AND ts.date = $2
           AND ts.is_available = TRUE
           AND NOT EXISTS (
             SELECT 1
             FROM appointments a
             WHERE a.employee_id = ts.employee_id
               AND a.appointment_date = ts.date
               AND a.status <> 'canceled'
               AND NOT (
                 (a.appointment_time + make_interval(mins => a.duration_minutes)) <= ts.start_time
                 OR a.appointment_time >= (ts.start_time + make_interval(mins => $3))
               )
           )
         ORDER BY ts.start_time`,
        [employeeId, date, durationMinutes]
      );

      return res.json({ slots: rows.map((r) => r.start_time) });
    } catch (err) {
      console.error('Mobile listAvailableSlots error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobileCatalogController;
