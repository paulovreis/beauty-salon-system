import crypto from 'crypto';
import pool from '../db/postgre.js';
import withTransaction from '../db/withTransaction.js';
import buildErrorResponse from '../utils/errorResponse.js';
import whatsappService from '../services/whatsappNotificationService.js';
import { decryptString } from '../utils/fieldCrypto.js';
import {
  computeDefaultPayerEmail,
  createPixPayment,
  getValidAccessTokenForUser,
} from '../services/mercadoPagoService.js';

function mapMpStatusToPaymentStatus(mpStatus) {
  const s = String(mpStatus || '').toLowerCase();
  if (s === 'approved') return 'paid';
  if (s === 'pending' || s === 'in_process') return 'pending';
  if (s === 'rejected' || s === 'cancelled') return 'failed';
  if (s === 'expired') return 'expired';
  return 'pending';
}

function formatPixMessage({ clientName, appointmentId, amount, serviceName, employeeName, appointmentDate, appointmentTime, expiresAt, qrCode, ticketUrl }) {
  const salonName = (process.env.NOME_SALAO || 'Salão').trim();
  const value = Number(amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const code = (qrCode || '').trim();

  let dateStr = '';
  if (appointmentDate) {
    try {
      const [y, m, d] = String(appointmentDate).slice(0, 10).split('-');
      dateStr = `${d}/${m}/${y}`;
    } catch { dateStr = ''; }
  }

  let expiresStr = '';
  if (expiresAt) {
    try {
      expiresStr = new Date(expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { expiresStr = ''; }
  }

  const lines = [
    `💚 *${salonName}*`,
    '',
    `Olá, *${clientName || 'Cliente'}*! 😊`,
    `Segue o PIX para o seu agendamento *#${appointmentId}*:`,
    '',
    `✂️ Serviço: ${serviceName || ''}`,
    employeeName ? `👩 Profissional: ${employeeName}` : null,
    (dateStr && appointmentTime) ? `📅 Data/hora: ${dateStr} às ${String(appointmentTime).slice(0, 5)}` : null,
    `💰 Valor: *R$ ${value}*`,
    expiresStr ? `⏳ Válido até: ${expiresStr}` : null,
    '',
    `📋 *PIX Copia e Cola:*`,
    code,
  ];

  if (ticketUrl) {
    lines.push('', `🔗 Ou pague pelo link: ${ticketUrl}`);
  }

  lines.push('', `_Após o pagamento, seu agendamento será confirmado automaticamente._ ✅`);

  return lines.filter(l => l !== null).join('\n');
}

const AppointmentPixPaymentController = {
  async createPix(req, res) {
    const db = req.pool || pool;
    const appointmentId = req.params.id;

    try {
      const result = await withTransaction(db, async (client) => {
        const { rows } = await client.query(
          `SELECT a.id, a.price, a.payment_status, a.appointment_date, a.appointment_time,
                  c.id AS client_id, c.name AS client_name, c.email AS client_email, c.phone_enc AS client_phone_enc,
                  e.id AS employee_id, e.user_id AS employee_user_id, e.name AS employee_name,
                  s.name AS service_name
           FROM appointments a
           JOIN clients c ON c.id = a.client_id
           JOIN employees e ON e.id = a.employee_id
           JOIN services s ON s.id = a.service_id
           WHERE a.id = $1
           FOR UPDATE`,
          [appointmentId]
        );

        if (!rows.length) {
          const err = new Error('Agendamento não encontrado');
          err.statusCode = 404;
          throw err;
        }

        const appt = rows[0];
        const sellerUserId = appt.employee_user_id;
        if (!sellerUserId) {
          const err = new Error('Funcionário do agendamento não possui usuário vinculado');
          err.statusCode = 400;
          throw err;
        }

        const accessToken = await getValidAccessTokenForUser({ db: client, userId: sellerUserId });

        const payerEmail = computeDefaultPayerEmail({
          clientId: appt.client_id,
          clientEmail: appt.client_email,
        });

        const idempotencyKey = crypto.randomUUID();
        const notificationUrl = (process.env.MP_NOTIFICATION_URL || '').trim();

        const mpResult = await createPixPayment({
          accessToken,
          appointment: {
            amount: appt.price,
            description: `Agendamento #${appt.id} - ${appt.service_name}`,
            externalReference: `appointment:${appt.id}`,
          },
          payerEmail,
          notificationUrl,
          idempotencyKey,
        });

        await client.query(
          `INSERT INTO appointment_pix_payments
           (appointment_id, provider, seller_user_id, mp_payment_id, mp_payment_status, amount, currency, idempotency_key, qr_code, qr_code_base64, ticket_url, expires_at, created_by_user_id, created_at, updated_at)
           VALUES ($1,'mercadopago',$2,$3,$4,$5,'BRL',$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
          [
            appt.id,
            sellerUserId,
            mpResult.mpPaymentId,
            mpResult.status,
            appt.price,
            idempotencyKey,
            mpResult.qrCode,
            mpResult.qrCodeBase64,
            mpResult.ticketUrl,
            mpResult.expiresAt,
            req.user?.id || null,
          ]
        );

        const nextStatus = mapMpStatusToPaymentStatus(mpResult.status);
        // Only move forward; never override paid with pending
        await client.query(
          `UPDATE appointments
           SET payment_status = CASE
             WHEN payment_status = 'paid' THEN payment_status
             ELSE $2
           END,
           payment_provider = 'mercadopago',
           updated_at = NOW()
           WHERE id = $1`,
          [appt.id, nextStatus]
        );

        return {
          appointmentId: appt.id,
          payment_status: nextStatus,
          pix: {
            mp_payment_id: mpResult.mpPaymentId,
            mp_status: mpResult.status,
            expires_at: mpResult.expiresAt,
            qr_code: mpResult.qrCode,
            qr_code_base64: mpResult.qrCodeBase64,
            ticket_url: mpResult.ticketUrl,
          },
          client: {
            name: appt.client_name,
            phone_enc: appt.client_phone_enc,
          },
          amount: appt.price,
          serviceName: appt.service_name,
          employeeName: appt.employee_name,
          appointmentDate: appt.appointment_date,
          appointmentTime: appt.appointment_time,
        };
      });

      // Best-effort WhatsApp notification
      try {
        if (result?.pix?.qr_code) {
          const message = formatPixMessage({
            clientName: result.client?.name,
            appointmentId: result.appointmentId,
            amount: result.amount,
            serviceName: result.serviceName,
            employeeName: result.employeeName,
            appointmentDate: result.appointmentDate,
            appointmentTime: result.appointmentTime,
            expiresAt: result.pix?.expires_at,
            qrCode: result.pix.qr_code,
            ticketUrl: result.pix?.ticket_url,
          });

          const phone = decryptString(result.client?.phone_enc);
          if (phone) {
            await whatsappService.sendMessage(phone, message);
          }
        }
      } catch (err) {
        console.warn('WhatsApp PIX message warning:', err?.message || err);
      }

      return res.json(result);
    } catch (err) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error('AppointmentPixPaymentController createPix error:', err);
      return res.status(500).json({ message: 'Erro ao gerar pagamento PIX', ...buildErrorResponse(err) });
    }
  },

  async resendPix(req, res) {
    // Semântica: gerar um novo PIX (novo payment) e persistir
    return AppointmentPixPaymentController.createPix(req, res);
  },

  async manualApprove(req, res) {
    const db = req.pool || pool;
    const appointmentId = req.params.id;

    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      const { rows } = await db.query(
        `UPDATE appointments
         SET payment_status = 'paid',
             payment_provider = 'manual',
             payment_approved_by_user_id = $2,
             payment_approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, payment_status, payment_provider, payment_approved_by_user_id, payment_approved_at`,
        [appointmentId, userId]
      );

      if (!rows.length) return res.status(404).json({ message: 'Agendamento não encontrado' });

      return res.json(rows[0]);
    } catch (err) {
      console.error('AppointmentPixPaymentController manualApprove error:', err);
      return res.status(500).json({ message: 'Erro ao aprovar pagamento manualmente', ...buildErrorResponse(err) });
    }
  },

  async getLatestPix(req, res) {
    const db = req.pool || pool;
    const appointmentId = req.params.id;

    try {
      const { rows } = await db.query(
        `SELECT a.id AS appointment_id, a.payment_status, a.payment_provider,
                p.mp_payment_id, p.mp_payment_status, p.amount, p.qr_code, p.qr_code_base64, p.ticket_url, p.expires_at, p.created_at
         FROM appointments a
         LEFT JOIN LATERAL (
           SELECT * FROM appointment_pix_payments
           WHERE appointment_id = a.id
           ORDER BY created_at DESC
           LIMIT 1
         ) p ON true
         WHERE a.id = $1`,
        [appointmentId]
      );

      if (!rows.length) return res.status(404).json({ message: 'Agendamento não encontrado' });

      return res.json(rows[0]);
    } catch (err) {
      console.error('AppointmentPixPaymentController getLatestPix error:', err);
      return res.status(500).json({ message: 'Erro ao buscar pagamento PIX', ...buildErrorResponse(err) });
    }
  },
};

export default AppointmentPixPaymentController;
