import express from 'express';
import { getMobilePublicHealth, getMobilePublicMeta } from '../controllers/mobile/publicController.js';
import MobileAuthController from '../controllers/mobile/mobileAuthController.js';
import requireClientRole from '../middlewares/requireClientRole.js';
import MobileMeController from '../controllers/mobile/meController.js';
import MobileNotificationsController from '../controllers/mobile/notificationsController.js';
import MobileAppointmentsController from '../controllers/mobile/appointmentsController.js';
import MobileCatalogController from '../controllers/mobile/catalogController.js';
import MobileDashboardController from '../controllers/mobile/dashboardController.js';
import MobilePushController from '../controllers/mobile/pushController.js';
import {
  validateAuth,
  validateForgotPassword,
  validateResetPasswordWithToken,
  validateResetToken,
} from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public endpoints used by the Flutter app to verify which salon/tenant it is talking to.
router.get('/public/health', getMobilePublicHealth);
router.get('/public/meta', getMobilePublicMeta);

// Client-only auth endpoints.
router.post('/auth/register', validateAuth, MobileAuthController.register);
router.post('/auth/login', validateAuth, MobileAuthController.login);
router.post('/auth/forgot-password', validateForgotPassword, MobileAuthController.forgotPassword);
router.post('/auth/reset-password', validateResetPasswordWithToken, MobileAuthController.resetPassword);
router.get('/auth/validate-reset-token/:token', validateResetToken, MobileAuthController.validateResetToken);

// Protected client endpoints
router.get('/me', ...requireClientRole(), MobileMeController.getMe);
router.put('/me', ...requireClientRole(), MobileMeController.updateMe);

router.get('/dashboard', ...requireClientRole(), MobileDashboardController.getDashboard);

router.get('/notifications', ...requireClientRole(), MobileNotificationsController.list);
router.post('/notifications/:id/read', ...requireClientRole(), MobileNotificationsController.markRead);
router.post('/notifications/read-all', ...requireClientRole(), MobileNotificationsController.markAllRead);

router.get('/appointments', ...requireClientRole(), MobileAppointmentsController.list);
router.post('/appointments', ...requireClientRole(), MobileAppointmentsController.create);
router.post('/appointments/:id/cancel', ...requireClientRole(), MobileAppointmentsController.cancel);

router.get('/services', ...requireClientRole(), MobileCatalogController.listServices);
router.get('/employees', ...requireClientRole(), MobileCatalogController.listEmployees);
router.get('/available-slots/:employeeId/:date', ...requireClientRole(), MobileCatalogController.listAvailableSlots);

router.post('/push/register', ...requireClientRole(), MobilePushController.register);
router.post('/push/unregister', ...requireClientRole(), MobilePushController.unregister);

export default router;
