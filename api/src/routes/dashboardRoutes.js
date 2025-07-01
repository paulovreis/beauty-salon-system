
import express from 'express';
import DashboardController from '../controllers/dashboardController.js';
import { validadeRefreshToken } from '../middlewares/validationMiddleware.js';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';

const router = express.Router();
const dashboardController = new DashboardController();


// Todas as rotas exigem autenticação e papel mínimo de 'employee'
// Exemplo de uso: roleMiddleware(['owner', 'manager', 'employee'])
router.get('/stats', authenticateJWT, roleMiddleware(['owner', 'manager', 'employee']), dashboardController.getStats);
router.get('/recent-appointments', authenticateJWT, roleMiddleware(['owner', 'manager', 'employee']), dashboardController.getRecentAppointments);
router.get('/top-employees', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getTopEmployees);
router.get('/revenue-summary', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getRevenueSummary);
router.get('/expense-breakdown', authenticateJWT, roleMiddleware(['owner']), dashboardController.getExpenseBreakdown);

export default router;
