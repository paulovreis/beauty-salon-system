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
      const refType = reference_type || 'manual'; // garante NOT NULL conforme schema
      const registeredBy = req.user?.id || null; // captura usuário executor se houver
      const { rows } = await db.query(
        `INSERT INTO public.stock_movements (product_id, movement_type, quantity, unit_cost, reference_type, notes, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [product_id, movement_type, quantity, unit_cost || null, refType, notes || null, registeredBy]
      );

      // Buscar dados do produto para notificação
      const productResult = await db.query('SELECT name FROM products WHERE id = $1', [product_id]);
      const productName = productResult.rows[0]?.name;
      
      // Enviar notificação WhatsApp para gerentes/donos sobre movimentação de estoque
      try {
        const whatsappService = (await import('../services/whatsappNotificationService.js')).default;
        const notificationType = movement_type === 'in' ? 'inventory_restock' : 'inventory_output';
        
        await whatsappService.sendSystemChangeNotification(
          notificationType,
          {
            product: productName,
            quantity: quantity,
            movement_type: movement_type === 'in' ? 'Entrada' : 'Saída',
            unit_cost: unit_cost ? `R$ ${parseFloat(unit_cost).toFixed(2)}` : 'Não informado',
            reference_type: reference_type || 'Não informado',
            notes: notes || 'Sem observações'
          },
          `Movimento de Estoque: ${productName}`
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de movimentação:', notificationError);
      }

      // Verificar estoque baixo após movimentações de saída
      if (movement_type === 'out') {
        try {
          const ProductController = (await import('./productController.js')).default;
          await ProductController.checkLowStockAndNotify(db);
        } catch (lowStockError) {
          console.error('Erro ao verificar estoque baixo:', lowStockError);
        }
      }

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

  // GET /inventory/outputs - Listar saídas de estoque com filtros e paginação
  async listOutputs(req, res) {
    const db = getPool(req);
    try {
      const { page = 1, limit = 50, product_id, start_date, end_date, output_type } = req.query;
      const offset = (page - 1) * limit;
      
      let whereConditions = ["sm.movement_type = 'output'"];
      let queryParams = [];
      let paramIndex = 1;

      if (product_id) {
        whereConditions.push(`sm.product_id = $${paramIndex}`);
        queryParams.push(product_id);
        paramIndex++;
      }

      if (start_date) {
        whereConditions.push(`sm.created_at >= $${paramIndex}`);
        queryParams.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`sm.created_at <= $${paramIndex}`);
        queryParams.push(end_date);
        paramIndex++;
      }

      if (output_type) {
        whereConditions.push(`sm.output_type = $${paramIndex}`);
        queryParams.push(output_type);
        paramIndex++;
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      const { rows } = await db.query(`
        SELECT 
          sm.*,
          p.name as product_name,
          p.sku as product_sku,
          p.current_stock as current_product_stock,
          pc.name as category_name,
          u.email as registered_by_email
        FROM stock_movements sm
        INNER JOIN products p ON sm.product_id = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        LEFT JOIN users u ON sm.registered_by = u.id
        ${whereClause}
        ORDER BY sm.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      const { rows: countRows } = await db.query(`
        SELECT COUNT(*) as total 
        FROM stock_movements sm
        ${whereClause}
      `, queryParams);

      res.json({
        outputs: rows,
        pagination: {
          currentPage: parseInt(page),
          totalItems: parseInt(countRows[0].total),
          itemsPerPage: parseInt(limit),
          totalPages: Math.ceil(countRows[0].total / limit)
        }
      });
    } catch (err) {
      console.error('Erro ao listar saídas:', err);
      res.status(500).json({ message: 'Erro ao listar saídas', error: err.message });
    }
  }

  // GET /inventory/outputs/:id - Buscar saída específica
  async getOutputById(req, res) {
    const { id } = req.params;
    const db = getPool(req);
    try {
      const { rows } = await db.query(`
        SELECT 
          sm.*,
          p.name as product_name,
          p.sku as product_sku,
          p.current_stock as current_product_stock,
          pc.name as category_name,
          u.email as registered_by_email
        FROM stock_movements sm
        INNER JOIN products p ON sm.product_id = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        LEFT JOIN users u ON sm.registered_by = u.id
        WHERE sm.id = $1 AND sm.movement_type = 'output'
      `, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Saída não encontrada' });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error('Erro ao buscar saída:', err);
      res.status(500).json({ message: 'Erro ao buscar saída', error: err.message });
    }
  }

  // POST /inventory/outputs - Registrar saída de estoque
  async createOutput(req, res) {
    const { product_id, quantity, output_type, reason, notes } = req.body;
    const db = getPool(req);
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Verificar se o produto existe e tem estoque suficiente
      const { rows: productRows } = await client.query(
        `SELECT id, name, current_stock, selling_price FROM products WHERE id = $1`,
        [product_id]
      );

      if (productRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      const product = productRows[0];

      if (product.current_stock < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Estoque insuficiente',
          available: product.current_stock,
          requested: quantity
        });
      }

      // Atualizar estoque do produto
      await client.query(
        `UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2`,
        [quantity, product_id]
      );

      // Registrar movimentação de saída
      const { rows } = await client.query(`
        INSERT INTO stock_movements (
          product_id, 
          movement_type, 
          quantity, 
          reference_type, 
          output_type,
          reason,
          notes,
          registered_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `, [
        product_id, 
        'output', 
        quantity, 
        'manual_output',
        output_type || 'other',
        reason || null,
        notes || null,
        req.user?.id || null
      ]);

      const stockMovement = rows[0];

      // Se for uma venda, registrar na tabela de vendas (financeiro)
      if (output_type === 'sale') {
        const unitPrice = product.selling_price || 0;
        const subtotal = unitPrice * quantity;
        const totalAmount = subtotal;

        // Buscar employee_id a partir do user_id
        let employeeId = null;
        if (req.user?.id) {
          const { rows: employeeRows } = await client.query(
            `SELECT id FROM employees WHERE user_id = $1`,
            [req.user.id]
          );
          if (employeeRows.length > 0) {
            employeeId = employeeRows[0].id;
          }
        }

        // Inserir registro de venda
        const { rows: saleRows } = await client.query(`
          INSERT INTO sales (
            employee_id,
            sale_date,
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            payment_method,
            status,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          employeeId,
          new Date(),
          subtotal,
          0, // tax_amount
          0, // discount_amount
          totalAmount,
          (req.body?.payment_method && ['cash','credit','debit','pix','transfer','boleto','other'].includes(String(req.body.payment_method).toLowerCase()))
            ? String(req.body.payment_method).toLowerCase()
            : 'cash',
          'completed',
          `Venda via saída de estoque - ${notes || ''}`
        ]);

        const sale = saleRows[0];

        // Inserir item da venda
        await client.query(`
          INSERT INTO sale_items (
            sale_id,
            product_id,
            quantity,
            unit_price,
            total_price
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          sale.id,
          product_id,
          quantity,
          unitPrice,
          totalAmount
        ]);

        // Atualizar stock_movement com referência à venda
        await client.query(`
          UPDATE stock_movements 
          SET reference_type = 'sale', reference_id = $1 
          WHERE id = $2
        `, [sale.id, stockMovement.id]);
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: output_type === 'sale' 
          ? 'Saída registrada e venda contabilizada no financeiro com sucesso' 
          : 'Saída registrada com sucesso',
        output: stockMovement
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao registrar saída:', err);
      res.status(500).json({ message: 'Erro ao registrar saída', error: err.message });
    } finally {
      client.release();
    }
  }

  // PUT /inventory/outputs/:id - Editar saída de estoque
  async updateOutput(req, res) {
    const { id } = req.params;
    const { quantity, output_type, reason, notes } = req.body;
    const db = getPool(req);
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Buscar a movimentação original
      const { rows: originalRows } = await client.query(
        `SELECT sm.*, p.selling_price FROM stock_movements sm
         LEFT JOIN products p ON sm.product_id = p.id
         WHERE sm.id = $1 AND sm.movement_type = 'output'`,
        [id]
      );

      if (originalRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Saída não encontrada' });
      }

      const original = originalRows[0];
      const quantityDiff = quantity - original.quantity;
      const outputTypeChanged = output_type && output_type !== original.output_type;

      // Se a quantidade mudou, atualizar o estoque
      if (quantityDiff !== 0) {
        // Verificar se há estoque suficiente para aumentar a saída
        if (quantityDiff > 0) {
          const { rows: productRows } = await client.query(
            `SELECT current_stock FROM products WHERE id = $1`,
            [original.product_id]
          );

          if (productRows[0].current_stock < quantityDiff) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              message: 'Estoque insuficiente para o ajuste',
              available: productRows[0].current_stock,
              required: quantityDiff
            });
          }
        }

        // Ajustar estoque: se aumentou a saída (diff > 0), diminuir estoque; se diminuiu (diff < 0), aumentar estoque
        await client.query(
          `UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2`,
          [quantityDiff, original.product_id]
        );
      }

      // Lidar com mudanças de tipo de saída
      const wasaSale = original.output_type === 'sale';
      const isNowASale = (output_type || original.output_type) === 'sale';

      // Se era venda e não é mais, deletar registro de venda
      if (wasaSale && !isNowASale && original.reference_id) {
        await client.query(`DELETE FROM sales WHERE id = $1`, [original.reference_id]);
      }

      // Se não era venda e agora é, criar registro de venda
      if (!wasaSale && isNowASale) {
        const unitPrice = original.selling_price || 0;
        const subtotal = unitPrice * quantity;
        const totalAmount = subtotal;

        // Buscar employee_id a partir do registered_by (user_id)
        let employeeId = null;
        if (original.registered_by) {
          const { rows: employeeRows } = await client.query(
            `SELECT id FROM employees WHERE user_id = $1`,
            [original.registered_by]
          );
          if (employeeRows.length > 0) {
            employeeId = employeeRows[0].id;
          }
        }

        const { rows: saleRows } = await client.query(`
          INSERT INTO sales (
            employee_id,
            sale_date,
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            payment_method,
            status,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          employeeId,
          new Date(),
          subtotal,
          0,
          0,
          totalAmount,
          'cash',
          'completed',
          `Venda via saída de estoque - ${notes || reason || ''}`
        ]);

        const sale = saleRows[0];

        await client.query(`
          INSERT INTO sale_items (
            sale_id,
            product_id,
            quantity,
            unit_price,
            total_price
          ) VALUES ($1, $2, $3, $4, $5)
        `, [sale.id, original.product_id, quantity, unitPrice, totalAmount]);

        // Atualizar referência
        await client.query(`
          UPDATE stock_movements 
          SET reference_type = 'sale', reference_id = $1 
          WHERE id = $2
        `, [sale.id, id]);
      }

      // Se já era venda e continua sendo, atualizar valores
      if (wasaSale && isNowASale && original.reference_id) {
        const unitPrice = original.selling_price || 0;
        const subtotal = unitPrice * quantity;
        const totalAmount = subtotal;

        await client.query(`
          UPDATE sales 
          SET subtotal = $1, total_amount = $2, notes = $3, updated_at = NOW()
          WHERE id = $4
        `, [subtotal, totalAmount, `Venda via saída de estoque - ${notes || reason || ''}`, original.reference_id]);

        await client.query(`
          UPDATE sale_items 
          SET quantity = $1, total_price = $2
          WHERE sale_id = $3 AND product_id = $4
        `, [quantity, totalAmount, original.reference_id, original.product_id]);
      }

      // Atualizar a movimentação
      const { rows } = await client.query(`
        UPDATE stock_movements 
        SET 
          quantity = $1,
          output_type = $2,
          reason = $3,
          notes = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [quantity, output_type || original.output_type, reason, notes, id]);

      await client.query('COMMIT');

      res.json({
        message: 'Saída atualizada com sucesso',
        output: rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao atualizar saída:', err);
      res.status(500).json({ message: 'Erro ao atualizar saída', error: err.message });
    } finally {
      client.release();
    }
  }

  // DELETE /inventory/outputs/:id - Deletar saída de estoque (reverte o estoque)
  async deleteOutput(req, res) {
    const { id } = req.params;
    const db = getPool(req);
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Buscar a movimentação
      const { rows: movementRows } = await client.query(
        `SELECT * FROM stock_movements WHERE id = $1 AND movement_type = 'output'`,
        [id]
      );

      if (movementRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Saída não encontrada' });
      }

      const movement = movementRows[0];

      // Se era uma venda, deletar registro de venda associado
      if (movement.output_type === 'sale' && movement.reference_id) {
        await client.query(
          `DELETE FROM sales WHERE id = $1`,
          [movement.reference_id]
        );
      }

      // Reverter o estoque (adicionar de volta a quantidade)
      await client.query(
        `UPDATE products SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2`,
        [movement.quantity, movement.product_id]
      );

      // Deletar a movimentação
      await client.query(
        `DELETE FROM stock_movements WHERE id = $1`,
        [id]
      );

      await client.query('COMMIT');

      res.json({ 
        message: movement.output_type === 'sale' 
          ? 'Saída deletada, estoque revertido e venda removida do financeiro com sucesso' 
          : 'Saída deletada e estoque revertido com sucesso',
        quantity_restored: movement.quantity
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao deletar saída:', err);
      res.status(500).json({ message: 'Erro ao deletar saída', error: err.message });
    } finally {
      client.release();
    }
  }

  // POST /inventory/:id/restock - Reabastecer um produto
  async restockProduct(req, res) {
    const { id } = req.params;
    const { quantity, notes } = req.body;
    const db = getPool(req);
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Verificar se o produto existe
      const { rows: productRows } = await client.query(
        `SELECT id, name, current_stock FROM products WHERE id = $1`,
        [id]
      );

      if (productRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      // Data/hora no timezone de São Paulo
      const saoPauloTime = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const restockDate = new Date(saoPauloTime);

      // Atualizar estoque do produto com horário de São Paulo
      await client.query(
        `UPDATE products SET 
          current_stock = current_stock + $1, 
          last_restocked = $2::timestamp, 
          updated_at = $2::timestamp 
         WHERE id = $3`,
        [quantity, restockDate, id]
      );

      // Registrar movimentação de entrada (restock)
      const { rows } = await client.query(`
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity,
          reference_type,
          notes,
          registered_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp) RETURNING *
      `, [
        id,
        'restock',
        quantity,
        'manual_restock',
        notes || null,
        req.user?.id || null,
        restockDate
      ]);

      await client.query('COMMIT');

      res.status(201).json({ message: 'Produto reabastecido com sucesso', movement: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao reabastecer produto:', err);
      res.status(500).json({ message: 'Erro ao reabastecer produto', error: err.message });
    } finally {
      client.release();
    }
  }
}

export default new InventoryController();
