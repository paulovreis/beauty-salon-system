import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import ClientController from '../controllers/clientController.js';
import { body } from 'express-validator';

const router = express.Router();

// Validações
const validateClientCreate = [
  body('name').isString().notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString().isLength({ min: 10, max: 20 }).withMessage('Telefone deve ter entre 10 e 20 caracteres'),
  body('birth_date').optional().isISO8601().toDate().withMessage('Data de nascimento inválida'),
];

const validateClientUpdate = [
  body('name').isString().notEmpty().withMessage('Nome é obrigatório'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString().isLength({ min: 10, max: 20 }).withMessage('Telefone deve ter entre 10 e 20 caracteres'),
  body('birth_date').optional().isISO8601().toDate().withMessage('Data de nascimento inválida'),
];

// Rotas
router.get('/', authenticateJWT, roleMiddleware(['owner','manager','employee']), (req,res)=> ClientController.list(req,res));
router.get('/stats', authenticateJWT, roleMiddleware(['owner','manager']), (req,res)=> ClientController.getStats(req,res));
router.get('/:id', authenticateJWT, roleMiddleware(['owner','manager','employee']), (req,res)=> ClientController.getById(req,res));
router.post('/', authenticateJWT, roleMiddleware(['owner','manager']), validateClientCreate, (req,res)=> ClientController.create(req,res));
router.put('/:id', authenticateJWT, roleMiddleware(['owner','manager']), validateClientUpdate, (req,res)=> ClientController.update(req,res));
router.delete('/:id', authenticateJWT, roleMiddleware(['owner']), (req,res)=> ClientController.delete(req,res));

export default router;
