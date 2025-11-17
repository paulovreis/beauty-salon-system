import pool from "../db/postgre.js";
import whatsappService from "../services/whatsappNotificationService.js";

class ProductController {
  constructor() {}

  async getAllProducts(req, res) {
    const db = req.pool;
    try {
      const { page = 1, limit = 50, category_id, search, include_inactive } = req.query;
      const offset = (page - 1) * limit;
      
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Filtro de status ativo (padrão)
      if (include_inactive !== 'true') {
        whereConditions.push(`p.is_active = true`);
      }

      if (category_id) {
        whereConditions.push(`p.category_id = $${paramIndex}`);
        queryParams.push(category_id);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query otimizada com informações adicionais
      const { rows } = await db.query(`
        SELECT 
          p.id, p.name, p.description, p.sku, p.cost_price, p.selling_price, 
          p.current_stock, p.min_stock_level, p.max_stock_level, p.supplier_name, p.supplier_contact, 
          p.last_restocked, p.is_active, p.created_at, p.updated_at,
          c.name as category_name,
          CASE 
            WHEN p.current_stock = 0 THEN 'out_of_stock'
            WHEN p.current_stock <= p.min_stock_level THEN 'low_stock'
            WHEN p.current_stock >= p.max_stock_level THEN 'overstock'
            ELSE 'normal'
          END as stock_status,
          (p.selling_price - p.cost_price) as profit_margin_value,
          CASE 
            WHEN p.cost_price > 0 THEN ROUND(((p.selling_price - p.cost_price) / p.cost_price * 100)::numeric, 2)
            ELSE 0
          END as profit_percentage
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Count para paginação
      const { rows: countRows } = await db.query(`
        SELECT COUNT(*) as total 
        FROM products p 
        LEFT JOIN product_categories c ON p.category_id = c.id
        ${whereClause}
      `, queryParams);

      res.json({
        products: rows,
        pagination: {
          currentPage: parseInt(page),
          totalItems: parseInt(countRows[0].total),
          itemsPerPage: parseInt(limit),
          totalPages: Math.ceil(countRows[0].total / limit)
        }
      });
    } catch (err) {
      console.log("Erro ao buscar produtos:", err);
      res
        .status(500)
        .json({ message: "Erro ao buscar produtos", error: err.message });
    }
  }

  async getProductById(req, res) {
    const db = req.pool;
    const { id } = req.params;
    try {
      const { rows } = await db.query(
        `
                SELECT p.id, p.name, p.description, p.sku, p.cost_price, p.selling_price, 
                       p.current_stock, p.min_stock_level, p.max_stock_level, p.supplier_name, p.supplier_contact, 
                       p.last_restocked, p.is_active, p.created_at, p.updated_at, 
                       c.name as category_name
                FROM products p
                LEFT JOIN product_categories c ON p.category_id = c.id
                WHERE p.id = $1
            `,
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      res.json(rows[0]);
    } catch (err) {
      console.log("Erro ao buscar produto:", err);
      res
        .status(500)
        .json({ message: "Erro ao buscar produto", error: err.message });
    }
  }

  async addNewProduct(req, res) {
    const db = req.pool;
    const {
      name,
      description,
      sku,
      cost_price,
      selling_price,
      current_stock = 0,
      min_stock_level = 0,
      max_stock_level = 0,
      supplier_name,
      supplier_contact,
      category_id,
    } = req.body;
    try {
      // Checa duplicidade de nome
      const exists = await db.query(
        "SELECT id FROM products WHERE LOWER(name) = LOWER($1)",
        [name]
      );
      if (exists.rows.length > 0) {
        return res
          .status(409)
          .json({ message: "Já existe um produto com este nome" });
      }
      const { rows } = await db.query(
        `
                INSERT INTO products (name, description, sku, cost_price, selling_price, current_stock, min_stock_level, max_stock_level, supplier_name, supplier_contact, category_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
            `,
        [
          name,
          description,
          sku,
          cost_price,
          selling_price,
          current_stock,
          min_stock_level,
          max_stock_level,
          supplier_name,
          supplier_contact,
          category_id,
        ]
      );
      
      // Enviar notificação de novo produto
      try {
        await whatsappService.sendSystemChangeNotification(
          'product_created',
          {
            name,
            description,
            selling_price,
            current_stock,
            category_id
          },
          `Produto: ${name}`
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de novo produto:', notificationError);
      }
      
      res.status(201).json(rows[0]);
    } catch (err) {
      console.log("Erro ao criar produto:", err);
      res
        .status(500)
        .json({ message: "Erro ao criar produto", error: err.message });
    }
  }

  async updateProduct(req, res) {
    const db = req.pool;
    const { id } = req.params;
    const {
      name,
      description,
      sku,
      cost_price,
      selling_price,
      current_stock,
      min_stock_level,
      max_stock_level,
      supplier_name,
      supplier_contact,
      category_id,
      is_active,
    } = req.body;
    try {
      // Verifica se o produto existe
      const current = await db.query(
        "SELECT * FROM products WHERE id = $1",
        [id]
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      // Checa duplicidade de nome
      if (name && name !== current.rows[0].name) {
        const exists = await db.query(
          "SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND id <> $2",
          [name, id]
        );
        if (exists.rows.length > 0) {
          return res
            .status(409)
            .json({ message: "Já existe um produto com este nome" });
        }
      }
      const updated = {
        name: name ?? current.rows[0].name,
        description: description ?? current.rows[0].description,
        sku: sku ?? current.rows[0].sku,
        cost_price: cost_price ?? current.rows[0].cost_price,
        selling_price: selling_price ?? current.rows[0].selling_price,
        current_stock: current_stock ?? current.rows[0].current_stock,
        min_stock_level: min_stock_level ?? current.rows[0].min_stock_level,
        max_stock_level: max_stock_level ?? current.rows[0].max_stock_level,
        supplier_name: supplier_name ?? current.rows[0].supplier_name,
        supplier_contact: supplier_contact ?? current.rows[0].supplier_contact,
        category_id: category_id ?? current.rows[0].category_id,
        is_active:
          typeof is_active === "boolean"
            ? is_active
            : current.rows[0].is_active,
      };
      const { rows } = await db.query(
        `
                UPDATE products 
                SET name = $1, description = $2, sku = $3, cost_price = $4, selling_price = $5, 
                    current_stock = $6, min_stock_level = $7, max_stock_level = $8, 
                    supplier_name = $9, supplier_contact = $10, category_id = $11, is_active = $12, updated_at = NOW() 
                WHERE id = $13 RETURNING *
            `,
        [
          updated.name,
          updated.description,
          updated.sku,
          updated.cost_price,
          updated.selling_price,
          updated.current_stock,
          updated.min_stock_level,
          updated.max_stock_level,
          updated.supplier_name,
          updated.supplier_contact,
          updated.category_id,
          updated.is_active,
          id,
        ]
      );

      // Verificar se houve mudança no estoque e se está baixo
      const oldStock = current.rows[0].current_stock;
      const newStock = rows[0].current_stock;
      const minStock = rows[0].min_stock_level;

      if (oldStock !== newStock) {
        // Notificar sobre alteração de estoque
        try {
          await whatsappService.sendSystemChangeNotification(
            'inventory_update',
            {
              name: rows[0].name,
              old_stock: oldStock,
              new_stock: newStock,
              difference: newStock - oldStock
            },
            `Produto: ${rows[0].name}`
          );

          // Se o estoque ficou baixo, enviar alerta específico
          if (newStock <= minStock && minStock > 0) {
            await whatsappService.sendLowStockNotification([rows[0]]);
          }
        } catch (notificationError) {
          console.error('Erro ao enviar notificação de atualização:', notificationError);
        }
      }

      res.json(rows[0]);
    } catch (err) {
      console.log("Erro ao atualizar produto:", err);
      res
        .status(500)
        .json({ message: "Erro ao atualizar produto", error: err.message });
    }
  }

  async deleteProduct(req, res) {
    const db = req.pool;
    const { id } = req.params;
    try {
      const { rowCount } = await db.query(
        "DELETE FROM products WHERE id = $1",
        [id]
      );
      if (rowCount === 0) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      res.json({ message: "Produto removido com sucesso" });
    } catch (err) {
      console.log("Erro ao remover produto:", err);
      res
        .status(500)
        .json({ message: "Erro ao remover produto", error: err.message });
    }
  }

  async getProductsByCategory(req, res) {
    const db = req.pool;
    const { categoryId } = req.params;
    try {
      const { rows } = await db.query(
        `
                SELECT p.id, p.name, p.description, p.sku, p.cost_price, p.selling_price, 
                       p.current_stock, p.min_stock_level, p.max_stock_level, p.supplier_name, p.supplier_contact, 
                       p.last_restocked, p.is_active, p.created_at, p.updated_at, 
                       c.name as category_name
                FROM products p
                LEFT JOIN product_categories c ON p.category_id = c.id
                WHERE c.id = $1
                ORDER BY p.name
            `,
        [categoryId]
      );
      res.json(rows);
    } catch (err) {
      console.log("Erro ao buscar produtos por categoria:", err);
      res
        .status(500)
        .json({
          message: "Erro ao buscar produtos por categoria",
          error: err.message,
        });
    }
    }


  // PRODUTOS COM BAIXO ESTOQUE
  async getLowStock(req, res) {
    const db = req.pool;
    try {
      const { rows } = await db.query(
        "SELECT * FROM products WHERE current_stock <= min_stock_level ORDER BY current_stock ASC"
      );
      res.json(rows);
    } catch (err) {
      res
        .status(500)
        .json({
          message: "Erro ao buscar produtos com baixo estoque",
          error: err.message,
        });
    }
  }

  // REPOSIÇÃO DE ESTOQUE
  async restockProduct(req, res) {
    const db = req.pool;
    const { id } = req.params;
    const { quantity, unit_cost, notes } = req.body;
    try {
      // Atualiza o estoque
      const { rows } = await db.query(
        "UPDATE products SET current_stock = current_stock + $1, last_restocked = NOW() WHERE id = $2 RETURNING *",
        [quantity, id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      // Registra movimentação
      await db.query(
        "INSERT INTO stock_movements (product_id, movement_type, quantity, unit_cost, reference_type, notes) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, "restock", quantity, unit_cost || null, "manual", notes || null]
      );
      
      // Enviar notificação de reposição de estoque
      try {
        await whatsappService.sendSystemChangeNotification(
          'inventory_restock',
          {
            name: rows[0].name,
            quantity: `+${quantity}`,
            current_stock: rows[0].current_stock,
            notes
          },
          `Produto: ${rows[0].name}`
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de reposição:', notificationError);
      }
      
      res.json(rows[0]);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Erro ao repor estoque", error: err.message });
    }
  }

  // Verificar e notificar sobre estoque baixo
  async checkLowStockAndNotify(db = null) {
    const database = db || pool;
    try {
      const { rows } = await database.query(
        "SELECT * FROM products WHERE current_stock <= min_stock_level AND is_active = true ORDER BY current_stock ASC"
      );
      
      if (rows.length > 0) {
        await whatsappService.sendLowStockNotification(rows);
      }
    } catch (error) {
      console.error('Erro ao verificar estoque baixo:', error);
    }
  }

  // MOVIMENTAÇÕES DE ESTOQUE
  async getProductMovements(req, res) {
    const db = req.pool;
    const { id } = req.params;
    try {
      const { rows } = await db.query(
        "SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC",
        [id]
      );
      res.json(rows);
    } catch (err) {
      res
        .status(500)
        .json({
          message: "Erro ao buscar movimentações do produto",
          error: err.message,
        });
    }
  }
}

export default ProductController;
