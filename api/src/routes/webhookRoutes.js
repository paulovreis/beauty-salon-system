import express from 'express';
import MercadoPagoWebhookController from '../controllers/mercadoPagoWebhookController.js';

const router = express.Router();

router.post('/mercadopago', (req, res) => MercadoPagoWebhookController.handleWebhook(req, res));

export default router;
