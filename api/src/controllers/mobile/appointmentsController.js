import pool from '../../db/postgre.js';
import withTransaction from '../../db/withTransaction.js';
import buildErrorResponse from '../../utils/errorResponse.js';
import { decryptString, encryptString, normalizeText } from '../../utils/fieldCrypto.js';
import { createClientNotification } from '../../utils/clientNotifications.js';
import { toDateOnlyString } from '../../utils/dateOnly.js';

const getPool = (req) => req.pool || pool;

function parsePagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const pageRaw = Number.parseInt(req.query.page, 10);
  const limitRaw = Number.parseInt(req.query.limit, 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, maxLimit) : defaultLimit;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

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

const MobileAppointmentsController = {
  async list(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const scope = String(req.query.scope || 'upcoming'); // upcoming | history | all
      const { page, limit, offset } = parsePagination(req, { defaultLimit: 20 });

      let where = 'WHERE a.client_id = $1';
      const baseParams = [clientId];

      if (scope === 'upcoming') {
        where += " AND a.appointment_date >= CURRENT_DATE AND a.status <> 'canceled'";
      } else if (scope === 'history') {
        where += " AND (a.appointment_date < CURRENT_DATE OR a.status IN ('completed','canceled'))";
      } else if (scope !== 'all') {
        return res.status(400).json({ message: 'scope inválido' });
      }

      const [{ rows }, { rows: countRows }] = await Promise.all([
        db.query(
          `SELECT
             a.id,
             a.client_id,
             a.employee_id,
             a.service_id,
             a.appointment_date,
             a.appointment_time,
             a.duration_minutes,
             a.status,
             a.payment_status,
             a.price,
             a.notes,
             a.notes_enc,
             a.created_at,
             a.updated_at,
             e.name AS employee_name,
             s.name AS service_name
           FROM appointments a
           JOIN employees e ON e.id = a.employee_id
           JOIN services s ON s.id = a.service_id
           ${where}
           ORDER BY a.appointment_date DESC, a.appointment_time DESC
           LIMIT $2 OFFSET $3`,
          [...baseParams, limit, offset]
        ),
        db.query(
          `SELECT COUNT(*)::int as total
           FROM appointments a
           ${where}`,
          baseParams
        ),
      ]);

      const total = countRows?.[0]?.total ?? 0;

      return res.json({
        appointments: rows.map(mapAppointmentRow),
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      console.error('Mobile appointments list error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async create(req, res) {
    const db = getPool(req);
    try {
      const clientId = req.user?.client_id;
      if (!clientId) {
        return res.status(403).json({ message: 'Conta de cliente não vinculada' });
      }

      const {
        appointment_date,
        appointment_time,
        employee_id,
        service_id,
        notes,
      } = req.body || {};

      if (!appointment_date || !appointment_time || !employee_id || !service_id) {
        return res.status(400).json({ message: 'appointment_date, appointment_time, employee_id e service_id são obrigatórios' });
      }

      let created;

      await withTransaction(db, async (tx) => {
        const { rows: serviceRows } = await tx.query(
          'SELECT id, duration_minutes, recommended_price, is_active FROM services WHERE id = $1 LIMIT 1',
          [service_id]
        );
        if (!serviceRows.length || serviceRows[0].is_active === false) {
          const e = new Error('Serviço inválido');
          e.statusCode = 400;
          throw e;
        }
        const { duration_minutes, recommended_price } = serviceRows[0];

        const { rows: employeeRows } = await tx.query(
          'SELECT id, status FROM employees WHERE id = $1 LIMIT 1',
          [employee_id]
        );
        if (!employeeRows.length) {
          const e = new Error('Funcionário não encontrado');
          e.statusCode = 400;
          throw e;
        }
        if (employeeRows[0].status !== 'active') {
          const e = new Error('Não é possível agendar com funcionário inativo');
          e.statusCode = 400;
          throw e;
        }

        const conflict = await tx.query(
          `SELECT 1 FROM appointments
           WHERE employee_id = $1 AND appointment_date = $2
             AND status <> 'canceled'
             AND NOT (
               (appointment_time + make_interval(mins => duration_minutes)) <= $3::time
               OR appointment_time >= ($3::time + make_interval(mins => $4))
             )
           LIMIT 1`,
          [employee_id, appointment_date, appointment_time, duration_minutes]
        );
        if (conflict.rows.length) {
          const e = new Error('Conflito de horário para este funcionário');
          e.statusCode = 409;
          throw e;
        }

        const slot = await tx.query(
          `SELECT id, is_available
           FROM time_slots
           WHERE employee_id = $1 AND date = $2 AND start_time = $3
           FOR UPDATE`,
          [employee_id, appointment_date, appointment_time]
        );
        if (slot.rows.length && slot.rows[0].is_available === false) {
          const e = new Error('Horário indisponível');
          e.statusCode = 409;
          throw e;
        }

        const normalizedNotes = normalizeText(notes);
        const notesEnc = normalizedNotes ? encryptString(normalizedNotes) : null;

        const { rows } = await tx.query(
          `INSERT INTO appointments (
             appointment_date, appointment_time,
             client_id, employee_id, service_id,
             status,
             notes, notes_enc,
             duration_minutes, price
           )
           VALUES ($1,$2,$3,$4,$5,'scheduled',NULL,$6,$7,$8)
           RETURNING *`,
          [
            appointment_date,
            appointment_time,
            clientId,
            employee_id,
            service_id,
            notesEnc,
            duration_minutes,
            recommended_price,
          ]
        );
        created = rows[0];

        await tx.query(
          'UPDATE time_slots SET is_available = FALSE WHERE employee_id = $1 AND date = $2 AND start_time = $3',
          [employee_id, appointment_date, appointment_time]
        );
      });

      // Notify in-app (best effort)
      await createClientNotification(db, {
        clientId,
        type: 'appointment_created',
        title: 'Agendamento criado',
        body: 'Seu agendamento foi criado com sucesso.',
        data: { appointment_id: created?.id },
      });

      return res.status(201).json({ appointment: mapAppointmentRow(created) });
    } catch (err) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error('Mobile appointments create error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },

  async cancel(req, res) {
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

      let updated;

      await withTransaction(db, async (tx) => {
        const { rows: apptRows } = await tx.query(
          `SELECT id, client_id, employee_id, appointment_date, appointment_time, status
           FROM appointments
           WHERE id = $1 AND client_id = $2
           LIMIT 1
           FOR UPDATE`,
          [id, clientId]
        );
        if (!apptRows.length) {
          const e = new Error('Agendamento não encontrado');
          e.statusCode = 404;
          throw e;
        }
        const appt = apptRows[0];

        if (appt.status === 'canceled') {
          updated = appt;
          return;
        }

        const { rows } = await tx.query(
          `UPDATE appointments
           SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND client_id = $2
           RETURNING *`,
          [id, clientId]
        );
        updated = rows[0];

        await tx.query(
          'UPDATE time_slots SET is_available = TRUE WHERE employee_id = $1 AND date = $2 AND start_time = $3',
          [appt.employee_id, appt.appointment_date, appt.appointment_time]
        );
      });

      await createClientNotification(db, {
        clientId,
        type: 'appointment_canceled',
        title: 'Agendamento cancelado',
        body: 'Seu agendamento foi cancelado.',
        data: { appointment_id: id },
      });

      return res.json({ appointment: mapAppointmentRow(updated) });
    } catch (err) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error('Mobile appointments cancel error:', err);
      return res.status(500).json({ message: 'Internal server error', ...buildErrorResponse(err) });
    }
  },
};

export default MobileAppointmentsController;
