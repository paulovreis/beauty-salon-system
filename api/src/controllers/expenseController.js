import pool from '../db/postgre.js';

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

class ExpenseController {
  // GET /expenses - Listar todas as despesas
  async list(req, res) {
    const db = getPool(req);
    const { page = 1, limit = 50, category, start_date, end_date, search } = req.query;
    const offset = (page - 1) * limit;

    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (category) {
        whereConditions.push(`category = $${paramIndex}`);
        queryParams.push(category);
        paramIndex++;
      }

      if (start_date) {
        whereConditions.push(`expense_date >= $${paramIndex}`);
        queryParams.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`expense_date <= $${paramIndex}`);
        queryParams.push(end_date);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(description ILIKE $${paramIndex} OR receipt_number ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query principal com paginação
      const { rows } = await db.query(`
        SELECT * FROM expenses 
        ${whereClause}
        ORDER BY expense_date DESC, created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Query para contar total
      const { rows: countRows } = await db.query(`
        SELECT COUNT(*) as total FROM expenses ${whereClause}
      `, queryParams);

      const total = parseInt(countRows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        expenses: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });
    } catch (err) {
      console.error('Erro ao buscar despesas:', err);
      res.status(500).json({ message: 'Erro ao buscar despesas', error: err.message });
    }
  }

  // GET /expenses/:id - Buscar despesa por ID
  async getById(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    try {
      const { rows } = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Despesa não encontrada' });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error('Erro ao buscar despesa:', err);
      res.status(500).json({ message: 'Erro ao buscar despesa', error: err.message });
    }
  }

  // POST /expenses - Criar nova despesa
  async create(req, res) {
    const db = getPool(req);
    const { category, description, amount, expense_date, payment_method, receipt_number, notes } = req.body;

    try {
      // Validações básicas
      if (!category || !description || !amount || !expense_date || !payment_method) {
        return res.status(400).json({ 
          message: 'Campos obrigatórios: categoria, descrição, valor, data da despesa e método de pagamento' 
        });
      }

      if (amount <= 0) {
        return res.status(400).json({ message: 'O valor da despesa deve ser maior que zero' });
      }

      const { rows } = await db.query(`
        INSERT INTO expenses (category, description, amount, expense_date, payment_method, receipt_number, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [category, description, amount, expense_date, payment_method, receipt_number || null, notes || null]);

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Erro ao criar despesa:', err);
      res.status(500).json({ message: 'Erro ao criar despesa', error: err.message });
    }
  }

  // PUT /expenses/:id - Atualizar despesa
  async update(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { category, description, amount, expense_date, payment_method, receipt_number, notes } = req.body;

    try {
      // Verificar se a despesa existe
      const { rows: existingRows } = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ message: 'Despesa não encontrada' });
      }

      // Validações
      if (amount && amount <= 0) {
        return res.status(400).json({ message: 'O valor da despesa deve ser maior que zero' });
      }

      const current = existingRows[0];
      const updated = {
        category: category ?? current.category,
        description: description ?? current.description,
        amount: amount ?? current.amount,
        expense_date: expense_date ?? current.expense_date,
        payment_method: payment_method ?? current.payment_method,
        receipt_number: receipt_number ?? current.receipt_number,
        notes: notes ?? current.notes
      };

      const { rows } = await db.query(`
        UPDATE expenses 
        SET category = $1, description = $2, amount = $3, expense_date = $4, 
            payment_method = $5, receipt_number = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `, [updated.category, updated.description, updated.amount, updated.expense_date, 
          updated.payment_method, updated.receipt_number, updated.notes, id]);

      res.json(rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar despesa:', err);
      res.status(500).json({ message: 'Erro ao atualizar despesa', error: err.message });
    }
  }

  // DELETE /expenses/:id - Deletar despesa
  async delete(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    try {
      const { rowCount } = await db.query('DELETE FROM expenses WHERE id = $1', [id]);
      
      if (rowCount === 0) {
        return res.status(404).json({ message: 'Despesa não encontrada' });
      }

      res.json({ message: 'Despesa removida com sucesso' });
    } catch (err) {
      console.error('Erro ao remover despesa:', err);
      res.status(500).json({ message: 'Erro ao remover despesa', error: err.message });
    }
  }

  // GET /expenses/summary - Resumo das despesas
  async summary(req, res) {
    const db = getPool(req);
    const { start_date, end_date } = req.query;

    try {
      let dateFilter = '';
      let queryParams = [];
      
      if (start_date && end_date) {
        dateFilter = 'WHERE expense_date BETWEEN $1 AND $2';
        queryParams = [start_date, end_date];
      } else if (start_date) {
        dateFilter = 'WHERE expense_date >= $1';
        queryParams = [start_date];
      } else if (end_date) {
        dateFilter = 'WHERE expense_date <= $1';
        queryParams = [end_date];
      }

      // Total de despesas
      const { rows: totalRows } = await db.query(`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM expenses ${dateFilter}
      `, queryParams);

      // Despesas por categoria
      const { rows: categoryRows } = await db.query(`
        SELECT 
          category,
          COUNT(*) as count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM expenses ${dateFilter}
        GROUP BY category
        ORDER BY total_amount DESC
      `, queryParams);

      // Despesas por método de pagamento
      const { rows: paymentRows } = await db.query(`
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM expenses ${dateFilter}
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `, queryParams);

      // Evolução mensal (últimos 12 meses)
      const { rows: monthlyRows } = await db.query(`
        SELECT 
          DATE_TRUNC('month', expense_date) as month,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', expense_date)
        ORDER BY month DESC
      `);

      res.json({
        total: totalRows[0],
        by_category: categoryRows,
        by_payment_method: paymentRows,
        monthly_evolution: monthlyRows
      });
    } catch (err) {
      console.error('Erro ao buscar resumo de despesas:', err);
      res.status(500).json({ message: 'Erro ao buscar resumo de despesas', error: err.message });
    }
  }

  // GET /expenses/categories - Listar categorias únicas
  async getCategories(req, res) {
    const db = getPool(req);

    try {
      const { rows } = await db.query(`
        SELECT DISTINCT category, COUNT(*) as usage_count
        FROM expenses 
        GROUP BY category 
        ORDER BY usage_count DESC, category ASC
      `);

      res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      res.status(500).json({ message: 'Erro ao buscar categorias', error: err.message });
    }
  }

  // GET /expenses/recent - Despesas recentes
  async getRecent(req, res) {
    const db = getPool(req);
    const { limit = 10 } = req.query;

    try {
      const { rows } = await db.query(`
        SELECT * FROM expenses 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);

      res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar despesas recentes:', err);
      res.status(500).json({ message: 'Erro ao buscar despesas recentes', error: err.message });
    }
  }

  // GET /expenses/analytics - Análises avançadas
  async analytics(req, res) {
    const db = getPool(req);
    
    try {
      // Comparação com mês anterior
      const { rows: currentMonthRows } = await db.query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM expenses 
        WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
      `);

      const { rows: previousMonthRows } = await db.query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM expenses 
        WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      `);

      // Maior despesa do mês
      const { rows: topExpenseRows } = await db.query(`
        SELECT * FROM expenses 
        WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
        ORDER BY amount DESC 
        LIMIT 1
      `);

      // Categoria com maior crescimento
      const { rows: growthRows } = await db.query(`
        WITH current_month AS (
          SELECT category, SUM(amount) as current_total
          FROM expenses 
          WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
          GROUP BY category
        ),
        previous_month AS (
          SELECT category, SUM(amount) as previous_total
          FROM expenses 
          WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          GROUP BY category
        )
        SELECT 
          c.category,
          c.current_total,
          COALESCE(p.previous_total, 0) as previous_total,
          CASE 
            WHEN COALESCE(p.previous_total, 0) = 0 THEN 100
            ELSE ROUND(((c.current_total - COALESCE(p.previous_total, 0)) / COALESCE(p.previous_total, 0) * 100)::numeric, 2)
          END as growth_percentage
        FROM current_month c
        LEFT JOIN previous_month p ON c.category = p.category
        ORDER BY growth_percentage DESC
        LIMIT 5
      `);

      const currentMonth = currentMonthRows[0];
      const previousMonth = previousMonthRows[0];
      
      const monthGrowth = previousMonth.total > 0 
        ? ((currentMonth.total - previousMonth.total) / previousMonth.total * 100).toFixed(2)
        : 100;

      res.json({
        current_month: currentMonth,
        previous_month: previousMonth,
        month_growth_percentage: parseFloat(monthGrowth),
        top_expense_this_month: topExpenseRows[0] || null,
        category_growth: growthRows
      });
    } catch (err) {
      console.error('Erro ao buscar analytics de despesas:', err);
      res.status(500).json({ message: 'Erro ao buscar analytics de despesas', error: err.message });
    }
  }
}

export default new ExpenseController();