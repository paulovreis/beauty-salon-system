import express from 'express';
import {
  getEmployeeNotificationSettings,
  updateEmployeeNotificationSettings,
  getAllEmployeeNotificationSettings,
  getNotificationTypes,
  sendTestNotification,
  sendDailyNotifications
} from '../controllers/notificationController.js';
import authenticateJWT from '../middlewares/authenticateJWT.js';

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authenticateJWT);

// Obter tipos de notificação disponíveis
router.get('/types', getNotificationTypes);

// Obter configurações de notificação de um funcionário específico
router.get('/employee/:employeeId', getEmployeeNotificationSettings);

// Atualizar configurações de notificação de um funcionário
router.put('/employee/:employeeId', updateEmployeeNotificationSettings);

// Listar configurações de todos os funcionários (apenas owner/manager)
router.get('/employees', getAllEmployeeNotificationSettings);

// Enviar notificação de teste
router.post('/employee/:employeeId/test', sendTestNotification);

// Enviar notificações diárias para todos os funcionários
router.post('/daily', sendDailyNotifications);

export default router;