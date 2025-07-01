import { body, query, validationResult } from 'express-validator';

const validationMiddleware = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Funcionários
export const validateEmployeeCreate = [
    body('name').isString().notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('E-mail inválido'),
    body('phone').optional().isString(),
    body('hire_date').optional().isISO8601().toDate().withMessage('Data de contratação inválida'),
    body('base_salary').optional().isNumeric().withMessage('Salário deve ser numérico'),
    validationMiddleware
];

export const validateEmployeeUpdate = [
    body('name').optional().isString().notEmpty().withMessage('Nome é obrigatório'),
    body('email').optional().isEmail().withMessage('E-mail inválido'),
    body('phone').optional().isString(),
    body('hire_date').optional().isISO8601().toDate().withMessage('Data de contratação inválida'),
    body('base_salary').optional().isNumeric().withMessage('Salário deve ser numérico'),
    body('status').optional().isString(),
    validationMiddleware
];

export const validateSpecialtyCreate = [
    body('service_id').isInt().withMessage('service_id deve ser um inteiro'),
    body('commission_rate').isNumeric().withMessage('commission_rate deve ser numérico'),
    validationMiddleware
];

export const validateSpecialtyUpdate = [
    body('commission_rate').isNumeric().withMessage('commission_rate deve ser numérico'),
    validationMiddleware
];

// Autenticação
export const validateAuth = [
    body('email')
        .isEmail()
        .withMessage('Invalid email format'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    validationMiddleware
];

export const validadeRefreshToken = [
    (req, res, next) => {
        if (!req.headers['authorization']) {
            return res.status(400).json({ errors: [{ msg: 'Token is required in Authorization header', param: 'authorization', location: 'headers' }] });
        }
        next();
    },
    validationMiddleware
];

export const validadeResetPassword = [
    body('email')
        .isEmail()
        .withMessage('Invalid email format'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long'),
    validationMiddleware
];

export default validationMiddleware;