import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import MercadoPagoController from '../controllers/mercadoPagoController.js';

const router = express.Router();

// Authenticated endpoints
router.get(
  '/connect-url',
  authenticateJWT,
  roleMiddleware(['owner']),
  (req, res) => MercadoPagoController.getConnectUrl(req, res)
);

router.get(
  '/status',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  (req, res) => MercadoPagoController.getStatus(req, res)
);

router.delete(
  '/disconnect',
  authenticateJWT,
  roleMiddleware(['owner']),
  (req, res) => MercadoPagoController.disconnect(req, res)
);

// OAuth callback (public) - validates state signature
router.get('/oauth/callback', (req, res) => MercadoPagoController.oauthCallback(req, res));

export default router;
