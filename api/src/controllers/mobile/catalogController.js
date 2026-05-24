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
      const serviceIdRaw = req.query.service_id;
      const serviceId = serviceIdRaw ? Number.parseInt(serviceIdRaw, 10) : null;

      let rows;
      if (serviceId && Number.isFinite(serviceId)) {
        ({ rows } = await db.query(
          `SELECT DISTINCT e.id, e.name
           FROM employees e
           JOIN employee_specialties es ON es.employee_id = e.id
           WHERE e.status = 'active' AND es.service_id = $1
           ORDER BY e.name`,
          [serviceId]
        ));
      } else {
        ({ rows } = await db.query(
          `SELECT id, name FROM employees WHERE status = 'active' ORDER BY name`
        ));
      }

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

      let durationMinutes = 30;
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

      const { rows: existingAppointments } = await db.query(
        `SELECT appointment_time, duration_minutes
         FROM appointments
         WHERE employee_id = $1 AND appointment_date = $2 AND status <> 'canceled'`,
        [employeeId, date]
      );

      const timeToMinutes = (t) => {
        const [h, m] = String(t).slice(0, 5).split(':').map(Number);
        return h * 60 + m;
      };

      const END_OF_DAY = 18 * 60;
      const slots = [];

      for (let h = 8; h < 18; h++) {
        for (let m = 0; m < 60; m += 30) {
          const slotStart = h * 60 + m;
          const slotEnd = slotStart + durationMinutes;

          if (slotEnd > END_OF_DAY) continue;

          const hasConflict = existingAppointments.some((apt) => {
            if (!apt.appointment_time) return false;
            const aptStart = timeToMinutes(apt.appointment_time);
            const aptEnd = aptStart + (apt.duration_minutes || 30);
            return !(slotEnd <= aptStart || slotStart >= aptEnd);
          });

          if (!hasConflict) {
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          }
        }
      }

      return res.json({ slots });
    } catch (err) {
      console.error('Mobile listAvailableSlots error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobileCatalogController;
