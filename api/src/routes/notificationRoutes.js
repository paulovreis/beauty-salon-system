import express from 'express';
import {
  getEmployeeNotificationSettings,
  updateEmployeeNotificationSettings,
  getAllEmployeeNotificationSettings,
  getNotificationTypes,
  sendTestNotification,
  sendDailyNotifications,
  sendDailyAnalysis,
  sendSystemChangeNotification,
  sendLowStockAlert,
  sendAppointmentReminder,
  checkLowStock
} from '../controllers/notificationController.js';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';

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

// Enviar análise diária completa (apenas owner/manager)
router.post('/daily-analysis', roleMiddleware(['owner', 'manager']), sendDailyAnalysis);

// Enviar notificação de alteração no sistema
router.post('/system-change', sendSystemChangeNotification);

// Enviar alerta de estoque baixo (apenas owner/manager)
router.post('/low-stock-alert', roleMiddleware(['owner', 'manager']), sendLowStockAlert);

// Verificar estoque baixo e enviar notificações (apenas owner/manager)
router.post('/check-low-stock', roleMiddleware(['owner', 'manager']), checkLowStock);

// Enviar lembrete de agendamento
router.post('/appointment/:appointmentId/reminder', sendAppointmentReminder);

export default router;