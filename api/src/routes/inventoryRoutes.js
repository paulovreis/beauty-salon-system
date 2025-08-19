import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import InventoryController from '../controllers/inventoryController.js';
import { body, param } from 'express-validator';

const router = express.Router();

// GET /inventory
router.get(
  '/',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  (req, res) => InventoryController.list(req, res)
);

// GET /inventory/low-stock
router.get(
  '/low-stock',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  (req, res) => InventoryController.lowStock(req, res)
);

// GET /inventory/movements
router.get(
  '/movements',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  (req, res) => InventoryController.listMovements(req, res)
);

// POST /inventory/movements
router.post(
  '/movements',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  body('product_id').isInt().withMessage('ID do produto deve ser um inteiro'),
  body('movement_type').isString().notEmpty().withMessage('Tipo de movimentação obrigatório'),
  body('quantity').isInt().withMessage('Quantidade deve ser um inteiro'),
  (req, res) => InventoryController.createMovement(req, res)
);

// GET /inventory/promotions-suggestions
router.get(
  '/promotions-suggestions',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  (req, res) => InventoryController.promotionsSuggestions(req, res)
);

// GET /inventory/:id/history
router.get(
  '/:id/history',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  param('id').isInt().withMessage('ID do produto deve ser um inteiro'),
  (req, res) => InventoryController.productHistory(req, res)
);

// POST /inventory/bulk-update
router.post(
  '/bulk-update',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  body('updates').isArray({ min: 1 }).withMessage('Atualizações devem ser um array'),
  (req, res) => InventoryController.bulkUpdate(req, res)
);

export default router;
