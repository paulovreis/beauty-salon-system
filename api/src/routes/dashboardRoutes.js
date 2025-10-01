
import express from 'express';
import DashboardController from '../controllers/dashboardController.js';
import { validadeRefreshToken } from '../middlewares/validationMiddleware.js';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';

const router = express.Router();
const dashboardController = new DashboardController();


// Todas as rotas exigem autenticação e papel mínimo de 'employee'
// Exemplo de uso: roleMiddleware(['owner', 'manager', 'employee'])

// Rotas básicas existentes
router.get('/stats', authenticateJWT, roleMiddleware(['owner', 'manager', 'employee']), dashboardController.getStats);
router.get('/recent-appointments', authenticateJWT, roleMiddleware(['owner', 'manager', 'employee']), dashboardController.getRecentAppointments);
router.get('/top-employees', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getTopEmployees);
router.get('/revenue-summary', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getRevenueSummary);
router.get('/expense-breakdown', authenticateJWT, roleMiddleware(['owner']), dashboardController.getExpenseBreakdown);

// Novas rotas de análise avançada
router.get('/revenue-analysis', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getRevenueAnalysis);
router.get('/customer-analysis', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getCustomerAnalysis);
router.get('/service-analysis', authenticateJWT, roleMiddleware(['owner', 'manager', 'employee']), dashboardController.getServiceAnalysis);
router.get('/employee-analysis', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getEmployeeAnalysis);
router.get('/inventory-analysis', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getInventoryAnalysis);
router.get('/financial-analysis', authenticateJWT, roleMiddleware(['owner']), dashboardController.getFinancialAnalysis);
router.get('/predictive-analysis', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getPredictiveAnalysis);

// Rota para relatório completo (para geração de PDF)
router.get('/complete-report', authenticateJWT, roleMiddleware(['owner', 'manager']), dashboardController.getCompleteReport);

export default router;
