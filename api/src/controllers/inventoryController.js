import pool from '../db/postgre.js';

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

class InventoryController {
  // GET /inventory - Otimizado com paginação e índices
  async list(req, res) {
    const db = getPool(req);
    try {
      const { page = 1, limit = 50, category_id, low_stock_only } = req.query;
      const offset = (page - 1) * limit;
      
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (category_id) {
        whereConditions.push(`p.category_id = $${paramIndex}`);
        queryParams.push(category_id);
        paramIndex++;
      }

      if (low_stock_only === 'true') {
        whereConditions.push(`p.current_stock <= p.min_stock_level`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query otimizada com índices
      const { rows } = await db.query(`
        SELECT 
          p.*,
          c.name as category_name,
          CASE 
            WHEN p.current_stock = 0 THEN 'out_of_stock'
            WHEN p.current_stock <= p.min_stock_level THEN 'low_stock'
            WHEN p.current_stock >= p.max_stock_level THEN 'overstock'
            ELSE 'normal'
          END as stock_status,
          (p.selling_price - p.cost_price) as profit_per_unit
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
      console.error('Erro ao buscar inventário:', err);
      res.status(500).json({ message: 'Erro ao buscar inventário', error: err.message });
    }
  }

  // GET /inventory/low-stock
  async lowStock(req, res) {
    const db = getPool(req);
    try {
      const { rows } = await db.query(`
        SELECT * FROM public.products WHERE current_stock <= min_stock_level ORDER BY current_stock ASC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar produtos com baixo estoque', error: err.message });
    }
  }

  // GET /inventory/movements
  async listMovements(req, res) {
    const db = getPool(req);
    try {
      const { rows } = await db.query(`
        SELECT * FROM public.stock_movements ORDER BY created_at DESC LIMIT 100
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar movimentações', error: err.message });
    }
  }

  // POST /inventory/movements
  async createMovement(req, res) {
    const { product_id, movement_type, quantity, unit_cost, reference_type, notes } = req.body;
    const db = getPool(req);
    try {
      const { rows } = await db.query(
        `INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_cost, reference_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [product_id, movement_type, quantity, unit_cost || null, reference_type || null, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao registrar movimentação', error: err.message });
    }
  }

  // GET /inventory/promotions-suggestions
  async promotionsSuggestions(req, res) {
    const db = getPool(req);
    try {
      // Exemplo: produtos com alto estoque e baixo giro
      const { rows } = await db.query(`
        SELECT p.*, c.name as category_name
        FROM public.products p
        LEFT JOIN public.product_categories c ON p.category_id = c.id
        WHERE p.current_stock > p.max_stock_level
        ORDER BY p.current_stock DESC
        LIMIT 20
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar sugestões de promoção', error: err.message });
    }
  }

  // GET /inventory/:id/history
  async productHistory(req, res) {
    const { id } = req.params;
    const db = getPool(req);
    try {
      const { rows } = await db.query(
        `SELECT * FROM public.stock_movements WHERE product_id = $1 ORDER BY created_at DESC`,
        [id]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar histórico do produto', error: err.message });
    }
  }

  // POST /inventory/bulk-update
  async bulkUpdate(req, res) {
    const { updates } = req.body; // [{ product_id, quantity, unit_cost, notes }]
    const db = getPool(req);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const upd of updates) {
        await client.query(
          `UPDATE public.products SET current_stock = current_stock + $1, last_restocked = NOW() WHERE id = $2`,
          [upd.quantity, upd.product_id]
        );
        await client.query(
          `INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_cost, reference_type, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [upd.product_id, 'bulk_update', upd.quantity, upd.unit_cost || null, 'bulk', upd.notes || null]
        );
      }
      await client.query('COMMIT');
      res.json({ message: 'Atualização em lote realizada com sucesso' });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ message: 'Erro na atualização em lote', error: err.message });
    } finally {
      client.release();
    }
  }
}

export default new InventoryController();
