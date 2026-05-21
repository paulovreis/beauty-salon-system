import pool from '../db/postgre.js';
import withTransaction from '../db/withTransaction.js';
import buildErrorResponse from '../utils/errorResponse.js';
import { verifyMercadoPagoWebhookSignature } from '../utils/mercadoPagoWebhook.js';
import {
  extractPixDetailsFromPayment,
  fetchPayment,
  getValidAccessTokenForUser,
} from '../services/mercadoPagoService.js';
import whatsappService from '../services/whatsappNotificationService.js';

function mapMpStatusToAppointmentPaymentStatus(mpStatus) {
  const s = String(mpStatus || '').toLowerCase();
  if (s === 'approved') return 'paid';
  if (s === 'pending' || s === 'in_process') return 'pending';
  if (s === 'rejected' || s === 'cancelled') return 'failed';
  if (s === 'expired') return 'expired';
  return 'pending';
}

const MercadoPagoWebhookController = {
  async handleWebhook(req, res) {
    const db = req.pool || pool;

    try {
      const signatureHeader = req.get('x-signature');
      const requestId = req.get('x-request-id');
      // MP sends data.id as a query param AND in the body.
      // The HMAC manifest uses the query param value.
      const dataId = req.query?.['data.id'] ?? req.body?.data?.id;

      const valid = verifyMercadoPagoWebhookSignature({
        signatureHeader,
        requestId,
        dataId,
      });

      if (!valid) {
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }

      const mpPaymentId = dataId != null ? String(dataId) : null;
      if (!mpPaymentId) {
        return res.status(200).json({ ok: true });
      }

      const updated = await withTransaction(db, async (client) => {
        const { rows } = await client.query(
          `SELECT id, appointment_id, seller_user_id
           FROM appointment_pix_payments
           WHERE mp_payment_id = $1
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          [mpPaymentId]
        );

        if (!rows.length) {
          return { ignored: true };
        }

        const localPayment = rows[0];
        if (!localPayment.seller_user_id) {
          return { ignored: true };
        }

        const accessToken = await getValidAccessTokenForUser({
          db: client,
          userId: localPayment.seller_user_id,
        });

        const mpPayment = await fetchPayment({ accessToken, mpPaymentId });
        const pix = extractPixDetailsFromPayment(mpPayment);
        const appointmentPaymentStatus = mapMpStatusToAppointmentPaymentStatus(pix.status);

        await client.query(
          `UPDATE appointment_pix_payments
           SET mp_payment_status = $2,
               qr_code = COALESCE($3, qr_code),
               qr_code_base64 = COALESCE($4, qr_code_base64),
               ticket_url = COALESCE($5, ticket_url),
               expires_at = COALESCE($6, expires_at),
               updated_at = NOW()
           WHERE id = $1`,
          [localPayment.id, pix.status, pix.qrCode, pix.qrCodeBase64, pix.ticketUrl, pix.expiresAt]
        );

        // Update appointment status. Never downgrade paid.
        await client.query(
          `UPDATE appointments
           SET payment_status = CASE
             WHEN payment_status = 'paid' THEN payment_status
             ELSE $2
           END,
           payment_provider = 'mercadopago',
           updated_at = NOW()
           WHERE id = $1`,
          [localPayment.appointment_id, appointmentPaymentStatus]
        );

        return { ok: true, appointment_id: localPayment.appointment_id, payment_status: appointmentPaymentStatus, just_paid: appointmentPaymentStatus === 'paid' };
      });

      // Send payment confirmation WhatsApp notifications (best-effort, outside transaction)
      if (updated?.just_paid && updated?.appointment_id) {
        whatsappService.sendPixPaymentConfirmedNotification({ db: pool, appointmentId: updated.appointment_id })
          .catch(err => console.warn('Webhook: falha ao enviar notificação de pagamento confirmado:', err?.message));
      }

      return res.status(200).json({ ok: true, ...updated });
    } catch (err) {
      console.error('MercadoPagoWebhookController error:', err);
      // Webhooks should not cause retries for transient internal errors unless needed.
      return res.status(200).json({ ok: true, warning: 'internal_error', ...buildErrorResponse(err) });
    }
  },
};

export default MercadoPagoWebhookController;
