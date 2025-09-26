import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import ClientController from '../controllers/clientController.js';

const router = express.Router();

router.get('/', authenticateJWT, roleMiddleware(['owner','manager','employee']), (req,res)=> ClientController.list(req,res));
router.post('/', authenticateJWT, roleMiddleware(['owner','manager']), (req,res)=> ClientController.create(req,res));

export default router;
