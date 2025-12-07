import express from "express";
import authenticateJWT from "../middlewares/authenticateJWT.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import ProductController from "../controllers/productController.js";
import ProductCategoryController from "../controllers/productCategoryController.js";
import {
  validateProductCreate,
  validateProductUpdate,
  validateProductDelete,
  validateGetProductById,
  validateGetProductsByCategory,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateCategoryDelete,
  validateRestockProduct,
  validateProductMovements
} from "../middlewares/validationMiddleware.js";

const router = express.Router();
const productController = new ProductController();

// --- CATEGORIAS DE PRODUTOS ---
// Listar categorias de produtos
router.get(
  "/categories",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  (req, res) => ProductCategoryController.list(req, res)
);

// Criar categoria de produto
router.post(
  "/categories",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateCategoryCreate,
  (req, res) => ProductCategoryController.create(req, res)
);

// Atualizar categoria de produto
router.put(
  "/categories/:id",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateCategoryUpdate,
  (req, res) => ProductCategoryController.update(req, res)
);

// Remover categoria de produto
router.delete(
  "/categories/:id",
  authenticateJWT,
  roleMiddleware(["owner"]),
  validateCategoryDelete,
  (req, res) => ProductCategoryController.remove(req, res)
);

// --- PRODUTOS ---
// Listar todos os produtos
router.get(
  "/",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  (req, res) => productController.getAllProducts(req, res)
);

// Buscar produto por ID
router.get(
  "/:id",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateGetProductById,
  (req, res) => productController.getProductById(req, res)
);

// Criar produto
router.post(
  "/",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateProductCreate,
  (req, res) => productController.addNewProduct(req, res)
);

// Atualizar produto
router.put(
  "/:id",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateProductUpdate,
  (req, res) => productController.updateProduct(req, res)
);

// Remover produto
router.delete(
  "/:id",
  authenticateJWT,
  roleMiddleware(["owner"]),
  validateProductDelete,
  (req, res) => productController.deleteProduct(req, res)
);

// Listar produtos por categoria
router.get(
  "/category/:categoryId",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateGetProductsByCategory,
  (req, res) => productController.getProductsByCategory(req, res)
);

// --- ESTOQUE E MOVIMENTAÇÕES ---
// Listar produtos com baixo estoque
router.get(
  "/low-stock",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  (req, res) => productController.getLowStock(req, res)
);

// Repor estoque de produto
router.post(
  "/:id/restock",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateRestockProduct,
  (req, res) => productController.restockProduct(req, res)
);

// Listar movimentações de estoque de um produto
router.get(
  "/:id/movements",
  authenticateJWT,
  roleMiddleware(["owner", "manager", "employee"]),
  validateProductMovements,
  (req, res) => productController.getProductMovements(req, res)
);

export default router;