import { body, query, param, validationResult } from 'express-validator';

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

export const validateGetServiceById = [
    param('id')
        .isInt()
        .withMessage('ID do serviço deve ser um inteiro'),
    validationMiddleware
];

export const validateGetServiceByName = [
    query('name')
        .isString()
        .notEmpty()
        .withMessage('Nome é obrigatório'),
    validationMiddleware
];

export const validateCreateService = [
    body('name')
        .isString()
        .notEmpty()
        .withMessage('Nome é obrigatório'),
    body('description')
        .optional()
        .isString()
        .withMessage('Descrição deve ser uma string'),
    body('profit_margin')
        .optional()
        .isNumeric()
        .withMessage('Margem de lucro deve ser um número'),
    body('category_id')
        .isInt()
        .withMessage('ID da categoria deve ser um inteiro'),
    body('base_cost')
        .isNumeric()
        .withMessage('Custo base deve ser um número'),
    body('recommended_price')
        .isNumeric()
        .withMessage('Preço recomendado deve ser um número'),
    body('duration_minutes')
        .isInt({ min: 1 })
        .withMessage('Duração deve ser um inteiro positivo'),
    validationMiddleware
];

export const validateUpdateService = [
    body('name')
        .optional()
        .isString()
        .notEmpty()
        .withMessage('Nome é obrigatório'),
    body('description')
        .optional()
        .isString()
        .withMessage('Descrição deve ser uma string'),
    body('profit_margin')
        .optional()
        .isNumeric()
        .withMessage('Margem de lucro deve ser um número'),
    body('category_id')
        .optional()
        .isInt()
        .withMessage('ID da categoria deve ser um inteiro'),
    body('base_cost')
        .optional()
        .isNumeric()
        .withMessage('Custo base deve ser um número'),
    body('recommended_price')
        .optional()
        .isNumeric()
        .withMessage('Preço recomendado deve ser um número'),
    body('duration_minutes')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Duração deve ser um inteiro positivo'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('O campo is_active deve ser booleano'),
    validationMiddleware
];

export const validateAddServiceEspecialty = [
    body('employee_id')
        .isInt()
        .withMessage('ID do funcionário deve ser um inteiro'),
    body('service_id')
        .isInt()
        .withMessage('ID do serviço deve ser um inteiro'),
    body('commission_rate')
        .isNumeric()
        .withMessage('Taxa de comissão deve ser um número'),
    validationMiddleware
];

export const updateServiceEspecialty = [
    body('commission_rate')
        .isNumeric()
        .withMessage('Taxa de comissão deve ser um número'),
    param('specialtyId')
        .isInt()
        .withMessage('ID da especialidade deve ser um inteiro'),
    param('id')
        .isInt()
        .withMessage('ID do serviço deve ser um inteiro'),
    validationMiddleware
];

export const validateGetServicesByCategory = [
    param('categoryId')
        .isInt()
        .withMessage('ID da categoria deve ser um inteiro'),
    validationMiddleware
];

export const validateCategoryCreate = [
  body('name').isString().notEmpty().withMessage('Nome é obrigatório'),
  body('description').optional().isString().withMessage('Descrição deve ser uma string'),
];
export const validateCategoryUpdate = [
  body('name').optional().isString().notEmpty().withMessage('Nome é obrigatório'),
  body('description').optional().isString().withMessage('Descrição deve ser uma string'),
  param('id').isInt().withMessage('ID da categoria deve ser um inteiro'),
];
export const validateCategoryId = [
  param('id').isInt().withMessage('ID da categoria deve ser um inteiro'),
];

export default validationMiddleware;