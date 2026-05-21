import { encryptString } from '../utils/fieldCrypto.js';
import buildErrorResponse from '../utils/errorResponse.js';
import {
  buildConnectUrl,
  exchangeCodeForTokens,
  parseAndValidateState,
} from '../services/mercadoPagoService.js';

const MercadoPagoController = {
  async getConnectUrl(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      const url = buildConnectUrl({ userId });
      return res.json({ url });
    } catch (err) {
      console.error('MercadoPago getConnectUrl error:', err);
      return res.status(err?.statusCode || 500).json({ message: 'Erro ao gerar URL de conexão', ...buildErrorResponse(err) });
    }
  },

  async getStatus(req, res) {
    const db = req.pool;
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Não autenticado' });

      const { rows } = await db.query(
        `SELECT mp_user_id, expires_at, updated_at FROM mercadopago_accounts WHERE user_id = $1`,
        [userId]
      );

      if (!rows.length) return res.json({ connected: false });

      return res.json({
        connected: true,
        mp_user_id: rows[0].mp_user_id || null,
        expires_at: rows[0].expires_at || null,
        updated_at: rows[0].updated_at || null,
      });
    } catch (err) {
      console.error('MercadoPago getStatus error:', err);
      return res.status(500).json({ message: 'Erro ao buscar status Mercado Pago', ...buildErrorResponse(err) });
    }
  },

  async oauthCallback(req, res) {
    const db = req.pool;
    const { code, state, error, error_description } = req.query;

    try {
      if (error) {
        return res.status(400).json({ message: `OAuth Mercado Pago falhou: ${error_description || error}` });
      }

      if (!code) return res.status(400).json({ message: 'Missing code' });

      const { userId } = parseAndValidateState(state);

      const tokenData = await exchangeCodeForTokens({ code });

      const accessTokenEnc = tokenData?.access_token ? encryptString(tokenData.access_token) : null;
      const refreshTokenEnc = tokenData?.refresh_token ? encryptString(tokenData.refresh_token) : null;
      const expiresAt = tokenData?.expires_in
        ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
        : null;

      await db.query(
        `INSERT INTO mercadopago_accounts (user_id, mp_user_id, access_token_enc, refresh_token_enc, token_type, scope, expires_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           mp_user_id = EXCLUDED.mp_user_id,
           access_token_enc = EXCLUDED.access_token_enc,
           refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, mercadopago_accounts.refresh_token_enc),
           token_type = COALESCE(EXCLUDED.token_type, mercadopago_accounts.token_type),
           scope = COALESCE(EXCLUDED.scope, mercadopago_accounts.scope),
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
        [
          userId,
          tokenData?.user_id != null ? String(tokenData.user_id) : null,
          accessTokenEnc,
          refreshTokenEnc,
          tokenData?.token_type || null,
          tokenData?.scope || null,
          expiresAt,
        ]
      );

      const redirectBase = (process.env.FRONTEND_OAUTH_REDIRECT_URL || process.env.FRONTEND_URL || '').trim();
      if (redirectBase) {
        const url = new URL(redirectBase);
        url.searchParams.set('mp_connected', '1');
        return res.redirect(url.toString());
      }

      return res.json({ ok: true, connected: true });
    } catch (err) {
      console.error('MercadoPago oauthCallback error:', err);
      return res.status(err?.statusCode || 500).json({
        message: 'Erro no callback OAuth Mercado Pago',
        mp_error: err?.mpError || null,
        ...buildErrorResponse(err),
      });
    }
  },
};

export default MercadoPagoController;
