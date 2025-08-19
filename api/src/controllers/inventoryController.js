import pool from '../db/postgre.js';

class InventoryController {
  // GET /inventory
  async list(req, res) {
    try {
      const { rows } = await pool.query(`
        SELECT p.*, c.name as category_name
        FROM public.products p
        LEFT JOIN public.product_categories c ON p.category_id = c.id
        ORDER BY p.name
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar inventário', error: err.message });
    }
  }

  // GET /inventory/low-stock
  async lowStock(req, res) {
    try {
      const { rows } = await pool.query(`
        SELECT * FROM public.products WHERE current_stock <= min_stock_level ORDER BY current_stock ASC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar produtos com baixo estoque', error: err.message });
    }
  }

  // GET /inventory/movements
  async listMovements(req, res) {
    try {
      const { rows } = await pool.query(`
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
    try {
      const { rows } = await pool.query(
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
    try {
      // Exemplo: produtos com alto estoque e baixo giro
      const { rows } = await pool.query(`
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
    try {
      const { rows } = await pool.query(
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
    const client = await pool.connect();
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
