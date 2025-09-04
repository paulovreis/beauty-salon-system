import express from 'express';
import AuthController from '../controllers/authController.js';
import { 
    validadeRefreshToken, 
    validateAuth,
    validateForgotPassword,
    validateResetPasswordWithToken,
    validateResetToken
} from '../middlewares/validationMiddleware.js';

const router = express.Router();
const authController = new AuthController();

router.post('/login', validateAuth, authController.login);
router.post('/register', validateAuth, authController.register);
router.post('/refresh-token', validadeRefreshToken, authController.refreshToken);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPasswordWithToken, authController.resetPassword);
router.get('/validate-reset-token/:token', validateResetToken, authController.validateResetToken);

export default router;
