import { body, query, param, validationResult } from "express-validator";

const validationMiddleware = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	next();
};

// Funcionários
export const validateEmployeeCreate = [
	body("name").isString().notEmpty().withMessage("Nome é obrigatório"),
	body("email").isEmail().withMessage("E-mail inválido"),
	body("phone").optional().isString(),
	body("hire_date")
		.optional()
		.isISO8601()
		.toDate()
		.withMessage("Data de contratação inválida"),
	body("base_salary")
		.optional()
		.isNumeric()
		.withMessage("Salário deve ser numérico"),
	body("password").isString().notEmpty().withMessage("Senha é obrigatória"),
	body("role").isString().notEmpty().withMessage("Role é obrigatório"),
	validationMiddleware,
];

export const validateEmployeeUpdate = [
	body("name")
		.optional()
		.isString()
		.notEmpty()
		.withMessage("Nome é obrigatório"),
	body("email").optional().isEmail().withMessage("E-mail inválido"),
	body("phone").optional().isString(),
	body("hire_date")
		.optional()
		.isISO8601()
		.toDate()
		.withMessage("Data de contratação inválida"),
	body("base_salary")
		.optional()
		.isNumeric()
		.withMessage("Salário deve ser numérico"),
	body("status").optional().isString(),
	validationMiddleware,
];

export const validateSpecialtyCreate = [
	body("service_id").isInt().withMessage("service_id deve ser um inteiro"),
	body("commission_rate")
		.isNumeric()
		.withMessage("commission_rate deve ser numérico"),
	validationMiddleware,
];

export const validateSpecialtyUpdate = [
	body("commission_rate")
		.isNumeric()
		.withMessage("commission_rate deve ser numérico"),
	validationMiddleware,
];

// Autenticação
export const validateAuth = [
	body("email").isEmail().withMessage("Invalid email format"),
	body("password")
		.isLength({ min: 6 })
		.withMessage("Password must be at least 6 characters long"),
	validationMiddleware,
];

export const validadeRefreshToken = [
	(req, res, next) => {
		if (!req.headers["authorization"]) {
			return res.status(400).json({
				errors: [
					{
						msg: "Token is required in Authorization header",
						param: "authorization",
						location: "headers",
					},
				],
			});
		}
		next();
	},
	validationMiddleware,
];

export const validadeResetPassword = [
	body("email").isEmail().withMessage("Invalid email format"),
	body("newPassword")
		.isLength({ min: 6 })
		.withMessage("New password must be at least 6 characters long"),
	validationMiddleware,
];

export const validateForgotPassword = [
	body("email").isEmail().withMessage("Invalid email format"),
	validationMiddleware,
];

export const validateResetPasswordWithToken = [
	body("token").isString().notEmpty().withMessage("Token is required"),
	body("newPassword")
		.isLength({ min: 6 })
		.withMessage("New password must be at least 6 characters long"),
	validationMiddleware,
];

export const validateResetToken = [
	param("token").isString().notEmpty().withMessage("Token is required"),
	validationMiddleware,
];

export const validateGetServiceById = [
	param("id").isInt().withMessage("ID do serviço deve ser um inteiro"),
	validationMiddleware,
];

export const validateGetServiceByName = [
	query("name").isString().notEmpty().withMessage("Nome é obrigatório"),
	validationMiddleware,
];

export const validateCreateService = [
	body("name").isString().notEmpty().withMessage("Nome é obrigatório"),
	body("description")
		.optional()
		.isString()
		.withMessage("Descrição deve ser uma string"),
	body("profit_margin")
		.optional()
		.isNumeric()
		.withMessage("Margem de lucro deve ser um número"),
	body("category_id")
		.isInt()
		.withMessage("ID da categoria deve ser um inteiro"),
	body("base_cost").isNumeric().withMessage("Custo base deve ser um número"),
	body("recommended_price")
		.isNumeric()
		.withMessage("Preço recomendado deve ser um número"),
	body("duration_minutes")
		.isInt({ min: 1 })
		.withMessage("Duração deve ser um inteiro positivo"),
	validationMiddleware,
];

export const validateUpdateService = [
	body("name")
		.optional()
		.isString()
		.notEmpty()
		.withMessage("Nome é obrigatório"),
	body("description")
		.optional()
		.isString()
		.withMessage("Descrição deve ser uma string"),
	body("profit_margin")
		.optional()
		.isNumeric()
		.withMessage("Margem de lucro deve ser um número"),
	body("category_id")
		.optional()
		.isInt()
		.withMessage("ID da categoria deve ser um inteiro"),
	body("base_cost")
		.optional()
		.isNumeric()
		.withMessage("Custo base deve ser um número"),
	body("recommended_price")
		.optional()
		.isNumeric()
		.withMessage("Preço recomendado deve ser um número"),
	body("duration_minutes")
		.optional()
		.isInt({ min: 1 })
		.withMessage("Duração deve ser um inteiro positivo"),
	body("is_active")
		.optional()
		.isBoolean()
		.withMessage("O campo is_active deve ser booleano"),
	validationMiddleware,
];

export const validateAddServiceEspecialty = [
	body("employee_id")
		.isInt()
		.withMessage("ID do funcionário deve ser um inteiro"),
	body("service_id").isInt().withMessage("ID do serviço deve ser um inteiro"),
	body("commission_rate")
		.isNumeric()
		.withMessage("Taxa de comissão deve ser um número"),
	validationMiddleware,
];

export const updateServiceEspecialty = [
	body("commission_rate")
		.isNumeric()
		.withMessage("Taxa de comissão deve ser um número"),
	param("specialtyId")
		.isInt()
		.withMessage("ID da especialidade deve ser um inteiro"),
	param("id").isInt().withMessage("ID do serviço deve ser um inteiro"),
	validationMiddleware,
];

export const validateGetServicesByCategory = [
	param("categoryId")
		.isInt()
		.withMessage("ID da categoria deve ser um inteiro"),
	validationMiddleware,
];

export const validateCategoryCreate = [
	body("name").isString().notEmpty().withMessage("Nome é obrigatório"),
	body("description")
		.optional()
		.isString()
		.withMessage("Descrição deve ser uma string"),
	validationMiddleware,
];

export const validateCategoryUpdate = [
	body("name")
		.optional()
		.isString()
		.notEmpty()
		.withMessage("Nome é obrigatório"),
	body("description")
		.optional()
		.isString()
		.withMessage("Descrição deve ser uma string"),
	param("id").isInt().withMessage("ID da categoria deve ser um inteiro"),
	validationMiddleware,
];

export const validateCategoryId = [
	param("id").isInt().withMessage("ID da categoria deve ser um inteiro"),
	validationMiddleware,
];

// products validation
export const validateProductCreate = [
	body("name").isString().notEmpty().withMessage("Nome é obrigatório"),
	body("category_id")
		.isInt()
		.withMessage("ID da categoria deve ser um inteiro"),
	body("sku").optional().isString().withMessage("SKU deve ser uma string"),
	body("cost_price").isNumeric().withMessage("Custo deve ser um número"),
	body("selling_price")
		.isNumeric()
		.withMessage("Preço de venda deve ser um número"),
	body("current_stock")
		.optional()
		.isInt()
		.withMessage("Estoque atual deve ser um inteiro"),
	body("min_stock_level")
		.optional()
		.isInt()
		.withMessage("Estoque mínimo deve ser um inteiro"),
	body("max_stock_level")
		.optional()
		.isInt()
		.withMessage("Estoque máximo deve ser um inteiro"),
	body("supplier_name")
		.optional()
		.isString()
		.withMessage("Fornecedor deve ser uma string"),
	body("supplier_contact")
		.optional()
		.isString()
		.withMessage("Contato do fornecedor deve ser uma string"),
	body("description")
		.optional()
		.isString()
		.withMessage("Descrição deve ser uma string"),
	body("is_active")
		.optional()
		.isBoolean()
		.withMessage("O campo is_active deve ser booleano"),
	validationMiddleware,
];

export const validateProductUpdate = [
	body("name")
		.optional()
		.isString()
		.notEmpty()
		.withMessage("Nome é obrigatório"),
	body("category_id")
		.optional()
		.isInt()
		.withMessage("ID da categoria deve ser um inteiro"),
	body("sku").optional().isString().withMessage("SKU deve ser uma string"),
	body("cost_price")
		.optional()
		.isNumeric()
		.withMessage("Custo deve ser um número"),
	body("selling_price")
		.optional()
		.isNumeric()
		.withMessage("Preço de venda deve ser um número"),
	body("current_stock")
		.optional()
		.isInt()
		.withMessage("Estoque atual deve ser um inteiro"),
	body("min_stock_level")
		.optional()
		.isInt()
		.withMessage("Estoque mínimo deve ser um inteiro"),
	body("max_stock_level")
		.optional()
		.isInt()
		.withMessage("Estoque máximo deve ser um inteiro"),
	body("supplier_name")
		.optional()
		.isString()
		.withMessage("Fornecedor deve ser uma string"),
	body("supplier_contact")
		.optional()
		.isString()
		.withMessage("Contato do fornecedor deve ser uma string"),
	body("description")
		.optional()
		.isString()
		.withMessage("Descrição deve ser uma string"),
	body("is_active")
		.optional()
		.isBoolean()
		.withMessage("O campo is_active deve ser booleano"),
	param("id").isInt().withMessage("ID do produto deve ser um inteiro"),
	validationMiddleware,
];

export const validateProductDelete = [
	param("id").isInt().withMessage("ID do produto deve ser um inteiro"),
	validationMiddleware,
];

export const validateGetProductById = [
	param("id").isInt().withMessage("ID do produto deve ser um inteiro"),
	validationMiddleware,
];

export const validateGetProductsByCategory = [
	param("categoryId")
		.isInt()
		.withMessage("ID da categoria deve ser um inteiro"),
	validationMiddleware,
];

export const validateCategoryDelete = [
	param("id").isInt().withMessage("ID da categoria deve ser um inteiro"),
	validationMiddleware,
];

export const validateRestockProduct = [
	body("quantity")
		.isInt({ min: 1 })
		.withMessage("Quantidade deve ser um inteiro positivo"),
	body("unit_cost")
		.optional()
		.isNumeric()
		.withMessage("Custo unitário deve ser um número"),
	body("notes").optional().isString().withMessage("Notas devem ser uma string"),
	param("id").isInt().withMessage("ID do produto deve ser um inteiro"),
	validationMiddleware,
];

export const validateProductMovements = [
	param("id").isInt().withMessage("ID do produto deve ser um inteiro"),
	validationMiddleware,
];

// INVENTORY VALIDATIONS
export const validateInventoryList = [validationMiddleware];

export const validateInventoryLowStock = [validationMiddleware];

export const validateInventoryListMovements = [validationMiddleware];

export const validateInventoryCreateMovement = [
	body("product_id").isInt().withMessage("ID do produto deve ser um inteiro"),
	body("movement_type")
		.isString()
		.notEmpty()
		.withMessage("Tipo de movimentação obrigatório"),
	body("quantity").isInt().withMessage("Quantidade deve ser um inteiro"),
	body("unit_cost")
		.optional()
		.isNumeric()
		.withMessage("Custo unitário deve ser um número"),
	body("reference_type")
		.optional()
		.isString()
		.withMessage("Tipo de referência deve ser uma string"),
	body("notes").optional().isString().withMessage("Notas devem ser uma string"),
	validationMiddleware,
];

export const validateInventoryPromotionsSuggestions = [validationMiddleware];

export const validateInventoryProductHistory = [
	param("id").isInt().withMessage("ID do produto deve ser um inteiro"),
	validationMiddleware,
];

export const validateInventoryBulkUpdate = [
	body("updates")
		.isArray({ min: 1 })
		.withMessage("Atualizações devem ser um array"),
	body("updates.*.product_id")
		.isInt()
		.withMessage("ID do produto deve ser um inteiro"),
	body("updates.*.quantity")
		.isInt()
		.withMessage("Quantidade deve ser um inteiro"),
	body("updates.*.unit_cost")
		.optional()
		.isNumeric()
		.withMessage("Custo unitário deve ser um número"),
	body("updates.*.notes")
		.optional()
		.isString()
		.withMessage("Notas devem ser uma string"),
	validationMiddleware,
];

// Scheduling validations
export const validateCreateScheduling = [
	body("appointment_date")
		.isISO8601()
		.withMessage("Data do agendamento inválida"),
	body("appointment_time")
		.matches(/^\d{2}:\d{2}(:\d{2})?$/)
		.withMessage("Hora do agendamento inválida"),
	body("client_id").isInt().withMessage("ID do cliente deve ser um inteiro"),
	body("employee_id")
		.isInt()
		.withMessage("ID do funcionário deve ser um inteiro"),
	body("service_id").isInt().withMessage("ID do serviço deve ser um inteiro"),
	body("status").optional().isString(),
	body("notes").optional().isString(),
	validationMiddleware,
];

export const validateGetAllSchedulings = [validationMiddleware];

export const validateGetSchedulingById = [
	param("id").isInt().withMessage("ID do agendamento deve ser um inteiro"),
	validationMiddleware,
];

export const validateGetSchedulingByDate = [
	param("date").isISO8601().withMessage("Data inválida"),
	validationMiddleware,
];

export const validateGetSchedulingByEmployee = [
	param("employeeId")
		.isInt()
		.withMessage("ID do funcionário deve ser um inteiro"),
	validationMiddleware,
];

export const validateUpdateScheduling = [
	param("id").isInt().withMessage("ID do agendamento deve ser um inteiro"),
	body("appointment_date")
		.optional()
		.isISO8601()
		.withMessage("Data do agendamento inválida"),
	body("appointment_time")
		.optional()
		.matches(/^\d{2}:\d{2}(:\d{2})?$/)
		.withMessage("Hora do agendamento inválida"),
	body("client_id")
		.optional()
		.isInt()
		.withMessage("ID do cliente deve ser um inteiro"),
	body("employee_id")
		.optional()
		.isInt()
		.withMessage("ID do funcionário deve ser um inteiro"),
	body("service_id")
		.optional()
		.isInt()
		.withMessage("ID do serviço deve ser um inteiro"),
	body("status").optional().isString(),
	body("notes").optional().isString(),
	validationMiddleware,
];

export const validateGetAvailableTimeSlots = [
	param("employeeId")
		.isInt()
		.withMessage("ID do funcionário deve ser um inteiro"),
	param("date").isISO8601().withMessage("Data inválida"),
	validationMiddleware,
];

export default validationMiddleware;
