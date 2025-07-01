import express from 'express';
import AuthController from '../controllers/authController.js';
import { validadeRefreshToken, validadeResetPassword, validateAuth } from '../middlewares/validationMiddleware.js';

const router = express.Router();
const authController = new AuthController();

router.post('/login', validateAuth, authController.login);
router.post('/register', validateAuth, authController.register);
router.post('/refresh-token', validadeRefreshToken, authController.refreshToken);
router.put('/reset-password', validadeResetPassword, authController.resetPassword);

export default router;
