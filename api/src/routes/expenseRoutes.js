import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import ExpenseController from '../controllers/expenseController.js';
import { 
  validateExpenseCreate, 
  validateExpenseUpdate, 
  validateExpenseQuery 
} from '../middlewares/validationMiddleware.js';

const router = express.Router();

// GET /expenses - Listar despesas (owner, manager, employee)
router.get(
  '/', 
  authenticateJWT, 
  roleMiddleware(['owner', 'manager', 'employee']),
  validateExpenseQuery,
  (req, res) => ExpenseController.list(req, res)
);

// GET /expenses/summary - Resumo de despesas (owner, manager)
router.get(
  '/summary',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  (req, res) => ExpenseController.summary(req, res)
);

// GET /expenses/categories - Categorias de despesas (owner, manager, employee)
router.get(
  '/categories',
  authenticateJWT,
  roleMiddleware(['owner', 'manager', 'employee']),
  (req, res) => ExpenseController.getCategories(req, res)
);

// GET /expenses/recent - Despesas recentes (owner, manager)
router.get(
  '/recent',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  (req, res) => ExpenseController.getRecent(req, res)
);

// GET /expenses/analytics - Analytics de despesas (owner, manager)
router.get(
  '/analytics',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  (req, res) => ExpenseController.analytics(req, res)
);

// GET /expenses/:id - Buscar despesa por ID (owner, manager)
router.get(
  '/:id',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  (req, res) => ExpenseController.getById(req, res)
);

// POST /expenses - Criar despesa (owner, manager)
router.post(
  '/',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  validateExpenseCreate,
  (req, res) => ExpenseController.create(req, res)
);

// PUT /expenses/:id - Atualizar despesa (owner, manager)
router.put(
  '/:id',
  authenticateJWT,
  roleMiddleware(['owner', 'manager']),
  validateExpenseUpdate,
  (req, res) => ExpenseController.update(req, res)
);

// DELETE /expenses/:id - Deletar despesa (owner)
router.delete(
  '/:id',
  authenticateJWT,
  roleMiddleware(['owner']),
  (req, res) => ExpenseController.delete(req, res)
);

export default router;