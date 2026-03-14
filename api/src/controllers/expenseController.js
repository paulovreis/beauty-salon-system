import pool from '../db/postgre.js';

import whatsappService from '../services/whatsappNotificationService.js';
import buildErrorResponse from '../utils/errorResponse.js';
import { decryptString, encryptString, normalizeText } from '../utils/fieldCrypto.js';

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

function decryptExpenseRow(rows) {
  if (!rows) return rows;
  const arr = Array.isArray(rows) ? rows : [rows];
  const mapped = arr.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };

    if ('receipt_number_enc' in out) {
      out.receipt_number = out.receipt_number_enc ? decryptString(out.receipt_number_enc) : out.receipt_number;
      delete out.receipt_number_enc;
    }
    if ('supplier_name_enc' in out) {
      out.supplier_name = out.supplier_name_enc ? decryptString(out.supplier_name_enc) : out.supplier_name;
      delete out.supplier_name_enc;
    }
    if ('notes_enc' in out) {
      out.notes = out.notes_enc ? decryptString(out.notes_enc) : out.notes;
      delete out.notes_enc;
    }

    return out;
  });
  return Array.isArray(rows) ? mapped : mapped[0];
}

class ExpenseController {
  // GET /expenses - Listar todas as despesas
  async list(req, res) {
    const db = getPool(req);
    const { category, start_date, end_date, search } = req.query;
    const pagination = req.pagination || {
      page: Number.parseInt(req.query.page, 10) || 1,
      limit: Number.parseInt(req.query.limit, 10) || 50,
    };
    const page = pagination.page;
    const limit = pagination.limit;
    const offset = pagination.offset ?? (page - 1) * limit;

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
        // receipt_number passa a ser criptografado; mantemos busca apenas por descrição.
        whereConditions.push(`(description ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query principal com paginação
      const { rows } = await db.query(`
        SELECT 
          e.*
        FROM expenses e
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
        expenses: decryptExpenseRow(rows),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });
    } catch (err) {
      console.error('Erro ao buscar despesas:', err);
      res.status(500).json({ message: 'Erro ao buscar despesas', ...buildErrorResponse(err) });
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

      res.json(decryptExpenseRow(rows[0]));
    } catch (err) {
      console.error('Erro ao buscar despesa:', err);
      res.status(500).json({ message: 'Erro ao buscar despesa', ...buildErrorResponse(err) });
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

      const receiptNumberNorm = normalizeText(receipt_number);
      const notesNorm = normalizeText(notes);

      const { rows } = await db.query(`
        INSERT INTO expenses (category, description, amount, expense_date, payment_method, receipt_number, receipt_number_enc, notes, notes_enc)
        VALUES ($1, $2, $3, $4, $5, NULL, $6, NULL, $7)
        RETURNING *
      `, [category, description, amount, expense_date, payment_method, receiptNumberNorm ? encryptString(receiptNumberNorm) : null, notesNorm ? encryptString(notesNorm) : null]);

      // Enviar notificação de nova despesa
      try {
        await whatsappService.sendSystemChangeNotification(
          'expense_created',
          {
            category,
            description,
            amount,
            expense_date,
            payment_method,
            receipt_number
          },
          `Despesa: ${description}`
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de despesa:', notificationError);
      }

      res.status(201).json(decryptExpenseRow(rows[0]));
    } catch (err) {
      console.error('Erro ao criar despesa:', err);
      res.status(500).json({ message: 'Erro ao criar despesa', ...buildErrorResponse(err) });
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

      const currentReceiptPlain = current.receipt_number;
      const currentNotesPlain = current.notes;

      const finalReceiptPlain = receipt_number !== undefined ? normalizeText(receipt_number) : normalizeText(currentReceiptPlain);
      const finalNotesPlain = notes !== undefined ? normalizeText(notes) : normalizeText(currentNotesPlain);

      const finalReceiptEnc = receipt_number !== undefined
        ? (finalReceiptPlain ? encryptString(finalReceiptPlain) : null)
        : (current.receipt_number_enc || (finalReceiptPlain ? encryptString(finalReceiptPlain) : null));

      const finalNotesEnc = notes !== undefined
        ? (finalNotesPlain ? encryptString(finalNotesPlain) : null)
        : (current.notes_enc || (finalNotesPlain ? encryptString(finalNotesPlain) : null));

      const updated = {
        category: category ?? current.category,
        description: description ?? current.description,
        amount: amount ?? current.amount,
        expense_date: expense_date ?? current.expense_date,
        payment_method: payment_method ?? current.payment_method,
        receipt_number_enc: finalReceiptEnc,
        notes_enc: finalNotesEnc
      };

      const { rows } = await db.query(`
        UPDATE expenses 
        SET category = $1, description = $2, amount = $3, expense_date = $4, 
            payment_method = $5, receipt_number = NULL, receipt_number_enc = $6, notes = NULL, notes_enc = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `, [updated.category, updated.description, updated.amount, updated.expense_date, 
          updated.payment_method, updated.receipt_number_enc, updated.notes_enc, id]);

      res.json(decryptExpenseRow(rows[0]));
    } catch (err) {
      console.error('Erro ao atualizar despesa:', err);
      res.status(500).json({ message: 'Erro ao atualizar despesa', ...buildErrorResponse(err) });
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
      res.status(500).json({ message: 'Erro ao remover despesa', ...buildErrorResponse(err) });
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
      res.status(500).json({ message: 'Erro ao buscar resumo de despesas', ...buildErrorResponse(err) });
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
      res.status(500).json({ message: 'Erro ao buscar categorias', ...buildErrorResponse(err) });
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
      res.status(500).json({ message: 'Erro ao buscar despesas recentes', ...buildErrorResponse(err) });
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
      res.status(500).json({ message: 'Erro ao buscar analytics de despesas', ...buildErrorResponse(err) });
    }
  }
}

export default new ExpenseController();