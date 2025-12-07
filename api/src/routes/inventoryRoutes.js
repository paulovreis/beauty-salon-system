import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import InventoryController from '../controllers/inventoryController.js';
import { body, param } from 'express-validator';
import { 
  validateCreateOutput, 
  validateUpdateOutput, 
  validateOutputId 
} from '../middlewares/validationMiddleware.js';
import { validateRestockProduct } from '../middlewares/validationMiddleware.js';

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

// Rotas para saídas de inventário

// GET /inventory/outputs - Listar todas as saídas
router.get(
  '/outputs',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  (req, res) => InventoryController.listOutputs(req, res)
);

// GET /inventory/outputs/:id - Buscar saída específica
router.get(
  '/outputs/:id',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  validateOutputId,
  (req, res) => InventoryController.getOutputById(req, res)
);

// POST /inventory/outputs - Registrar nova saída
router.post(
  '/outputs',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  validateCreateOutput,
  (req, res) => InventoryController.createOutput(req, res)
);

// PUT /inventory/outputs/:id - Editar saída
router.put(
  '/outputs/:id',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  validateUpdateOutput,
  (req, res) => InventoryController.updateOutput(req, res)
);

// DELETE /inventory/outputs/:id - Deletar saída
router.delete(
  '/outputs/:id',
  authenticateJWT,
  roleMiddleware(['owner']),
  validateOutputId,
  (req, res) => InventoryController.deleteOutput(req, res)
);

// POST /inventory/:id/restock - Reabastecer produto
router.post(
  '/:id/restock',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  validateRestockProduct,
  (req, res) => InventoryController.restockProduct(req, res)
);

export default router;
