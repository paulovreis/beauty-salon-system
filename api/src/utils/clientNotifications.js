import pool from '../db/postgre.js';
import { sendPushToClient } from '../services/pushNotificationService.js';

const getPool = (reqOrDb) => {
  if (!reqOrDb) return pool;
  if (typeof reqOrDb.query === 'function') return reqOrDb;
  if (reqOrDb.pool && typeof reqOrDb.pool.query === 'function') return reqOrDb.pool;
  return pool;
};

export async function createClientNotification(dbOrReq, {
  clientId,
  type,
  title,
  body,
  data,
}) {
  if (!clientId) return;

  const db = getPool(dbOrReq);
  try {
    await db.query(
      `INSERT INTO client_notifications (client_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [clientId, type || 'generic', title || null, body || null, data ? JSON.stringify(data) : null]
    );

    // Best-effort push notification
    try {
      await sendPushToClient(db, {
        clientId,
        title: title || 'Notificação',
        body: body || '',
        data: {
          type: type || 'generic',
          ...(data || {}),
        },
      });
    } catch (pushErr) {
      console.warn('client push warning:', pushErr?.message || pushErr);
    }
  } catch (err) {
    // Notifications should never block core flows.
    console.warn('client notification insert warning:', err?.message || err);
  }
}
