import express from "express";
import { body, query, param } from "express-validator";
import authenticateJWT from "../middlewares/authenticateJWT.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import ServiceController from "../controllers/serviceController.js";
import ServiceCategoryController from "../controllers/serviceCategoryController.js";
import PriceController from "../controllers/priceController.js";
import {
  validateGetServiceById,
  validateGetServiceByName,
  validateCreateService,
  validateUpdateService,
  validateAddServiceEspecialty,
  updateServiceEspecialty,
  validateGetServicesByCategory,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateCategoryId,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();
const serviceController = new ServiceController();

// Listar todos os serviços
router.get(
  "/",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  (req, res) => serviceController.getAllServices(req, res)
);

// --- CATEGORIAS DE SERVIÇOS ---
// Listar categorias de serviços
router.get(
  "/categories",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  (req, res) => ServiceCategoryController.list(req, res)
);
// Criar categoria de serviço
router.post(
  "/categories",
  authenticateJWT,
  roleMiddleware(["owner", "manager"]),
  validateCategoryCreate,
  (req, res) => ServiceCategoryController.create(req, res)
);
// Atualizar categoria de serviço
router.put(
  "/categories/:id",
  authenticateJWT,
  roleMiddleware(["owner", "manager"]),
  validateCategoryUpdate,
  (req, res) => ServiceCategoryController.update(req, res)
);
// Remover categoria de serviço
router.delete(
  "/categories/:id",
  authenticateJWT,
  roleMiddleware(["owner"]),
  validateCategoryId,
  (req, res) => ServiceCategoryController.remove(req, res)
);

// Buscar serviço por ID
router.get(
  "/:id",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateGetServiceById,
  (req, res) => serviceController.getServiceById(req, res)
);

// Buscar serviços por nome (query param: name)
router.get(
  "/search/by-name",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateGetServiceByName,
  (req, res) => serviceController.getServicesByName(req, res)
);

// Criar serviço
router.post(
  "/",
  authenticateJWT,
  roleMiddleware(["owner", "manager"]),
  validateCreateService,
  (req, res) => serviceController.createService(req, res)
);

// Atualizar serviço
router.put(
  "/:id",
  authenticateJWT,
  roleMiddleware(["owner", "manager"]),
  validateUpdateService,
  (req, res) => serviceController.updateService(req, res)
);

// Remover serviço
router.delete(
  "/:id",
  authenticateJWT,
  roleMiddleware(["owner"]),
  validateGetServiceById,
  (req, res) => serviceController.deleteService(req, res)
);

// Listar serviços por categoria
router.get(
  "/category/:categoryId",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateGetServicesByCategory,
  (req, res) => serviceController.getServicesByCategory(req, res)
);

// Especialidades de serviço (employee_specialties)
// Listar especialidades de um serviço
router.get(
  "/:id/specialties",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateGetServiceById,
  (req, res) => serviceController.getServiceSpecialties(req, res)
);

// Adicionar especialidade a um serviço
router.post(
  "/:id/specialties",
  authenticateJWT,
  roleMiddleware(["owner", "manager"]),
  validateAddServiceEspecialty,
  (req, res) => serviceController.addServiceSpecialty(req, res)
);

// Atualizar especialidade de um serviço
router.put(
  "/:id/specialties/:specialtyId",
  authenticateJWT,
  roleMiddleware(["owner", "manager"]),
  updateServiceEspecialty,
  (req, res) => serviceController.updateServiceSpecialty(req, res)
);

// --- CALCULAR PREÇO DE SERVIÇO ---
router.post(
  "/calculate-price",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  body("base_cost").isNumeric().withMessage("Custo base deve ser um número"),
  body("profit_margin")
    .isNumeric()
    .withMessage("Margem de lucro deve ser um número"),
  (req, res) => PriceController.calculate(req, res)
);

export default router;
