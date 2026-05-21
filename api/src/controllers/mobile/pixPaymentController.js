import crypto from 'crypto';
import pool from '../../db/postgre.js';
import withTransaction from '../../db/withTransaction.js';
import buildErrorResponse from '../../utils/errorResponse.js';
import { decryptString } from '../../utils/fieldCrypto.js';
import { createClientNotification } from '../../utils/clientNotifications.js';
import whatsappService from '../../services/whatsappNotificationService.js';
import {
  computeDefaultPayerEmail,
  createPixPayment,
  getValidAccessTokenForUser,
} from '../../services/mercadoPagoService.js';

const getPool = (req) => req.pool || pool;

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
    (qrCode || '').trim(),
  ];

  if (ticketUrl) {
    lines.push('', `🔗 Ou pague pelo link: ${ticketUrl}`);
  }

  lines.push('', `_Após o pagamento, seu agendamento será confirmado automaticamente._ ✅`);

  return lines.filter((l) => l !== null).join('\n');
}

const MobilePixPaymentController = {
  async generatePix(req, res) {
    const db = getPool(req);
    const clientId = req.user?.client_id;
    const appointmentId = Number.parseInt(req.params.id, 10);

    if (!clientId) return res.status(403).json({ message: 'Conta de cliente não vinculada' });
    if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const result = await withTransaction(db, async (tx) => {
        const { rows } = await tx.query(
          `SELECT a.id, a.price, a.payment_status, a.appointment_date, a.appointment_time, a.client_id,
                  c.id AS client_id_check, c.name AS client_name, c.email AS client_email, c.phone_enc AS client_phone_enc,
                  e.id AS employee_id, e.user_id AS employee_user_id, e.name AS employee_name,
                  s.name AS service_name
           FROM appointments a
           JOIN clients c ON c.id = a.client_id
           JOIN employees e ON e.id = a.employee_id
           JOIN services s ON s.id = a.service_id
           WHERE a.id = $1 AND a.client_id = $2
           FOR UPDATE`,
          [appointmentId, clientId]
        );

        if (!rows.length) {
          const err = new Error('Agendamento não encontrado');
          err.statusCode = 404;
          throw err;
        }

        const appt = rows[0];

        if (appt.payment_status === 'paid') {
          const err = new Error('Este agendamento já foi pago');
          err.statusCode = 409;
          throw err;
        }

        const sellerUserId = appt.employee_user_id;
        if (!sellerUserId) {
          const err = new Error('Funcionário sem usuário vinculado para receber pagamentos');
          err.statusCode = 400;
          throw err;
        }

        const accessToken = await getValidAccessTokenForUser({ db: tx, userId: sellerUserId });

        const payerEmail = computeDefaultPayerEmail({
          clientId: appt.client_id_check,
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

        await tx.query(
          `INSERT INTO appointment_pix_payments
           (appointment_id, provider, seller_user_id, mp_payment_id, mp_payment_status, amount, currency,
            idempotency_key, qr_code, qr_code_base64, ticket_url, expires_at, created_by_user_id, created_at, updated_at)
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
        await tx.query(
          `UPDATE appointments
           SET payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE $2 END,
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
          _internal: {
            clientName: appt.client_name,
            clientPhoneEnc: appt.client_phone_enc,
            amount: appt.price,
            serviceName: appt.service_name,
            employeeName: appt.employee_name,
            appointmentDate: appt.appointment_date,
            appointmentTime: appt.appointment_time,
          },
        };
      });

      // Best-effort WhatsApp notification
      try {
        const i = result._internal;
        if (result?.pix?.qr_code) {
          const message = formatPixMessage({
            clientName: i.clientName,
            appointmentId: result.appointmentId,
            amount: i.amount,
            serviceName: i.serviceName,
            employeeName: i.employeeName,
            appointmentDate: i.appointmentDate,
            appointmentTime: i.appointmentTime,
            expiresAt: result.pix.expires_at,
            qrCode: result.pix.qr_code,
            ticketUrl: result.pix.ticket_url,
          });
          const phone = decryptString(i.clientPhoneEnc);
          if (phone) await whatsappService.sendMessage(phone, message);
        }
      } catch (err) {
        console.warn('Mobile PIX: WhatsApp warning:', err?.message || err);
      }

      const { _internal, ...response } = result;
      return res.json(response);
    } catch (err) {
      if (err?.statusCode) return res.status(err.statusCode).json({ message: err.message });
      console.error('MobilePixPaymentController generatePix error:', err);
      return res.status(500).json({ message: 'Erro ao gerar pagamento PIX', ...buildErrorResponse(err) });
    }
  },

  async getLatestPix(req, res) {
    const db = getPool(req);
    const clientId = req.user?.client_id;
    const appointmentId = Number.parseInt(req.params.id, 10);

    if (!clientId) return res.status(403).json({ message: 'Conta de cliente não vinculada' });
    if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const { rows } = await db.query(
        `SELECT a.id AS appointment_id, a.payment_status, a.payment_provider,
                p.mp_payment_id, p.mp_payment_status, p.amount,
                p.qr_code, p.qr_code_base64, p.ticket_url, p.expires_at, p.created_at
         FROM appointments a
         LEFT JOIN LATERAL (
           SELECT * FROM appointment_pix_payments
           WHERE appointment_id = a.id
           ORDER BY created_at DESC
           LIMIT 1
         ) p ON true
         WHERE a.id = $1 AND a.client_id = $2`,
        [appointmentId, clientId]
      );

      if (!rows.length) return res.status(404).json({ message: 'Agendamento não encontrado' });

      return res.json(rows[0]);
    } catch (err) {
      console.error('MobilePixPaymentController getLatestPix error:', err);
      return res.status(500).json({ message: 'Erro ao buscar pagamento PIX', ...buildErrorResponse(err) });
    }
  },
};

export default MobilePixPaymentController;
