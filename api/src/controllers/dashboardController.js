class DashboardController {
  async getStats(req, res) {
    const pool = req.pool;
    try {
      // Estatísticas básicas
      const [clients, employees, services, appointments, products, totalRevenue] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM clients'),
        pool.query('SELECT COUNT(*) FROM employees WHERE status = \'active\''),
        pool.query('SELECT COUNT(*) FROM services WHERE is_active = true'),
        pool.query('SELECT COUNT(*) FROM appointments'),
        pool.query('SELECT COUNT(*) FROM products WHERE is_active = true'),
        pool.query(`
          SELECT 
            COALESCE(SUM(a.price), 0) as appointments_revenue,
            (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE status = 'completed') as sales_revenue
          FROM appointments a WHERE a.status = 'completed'
        `)
      ]);

      // Estatísticas do mês atual
      const currentMonth = await pool.query(`
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_appointments,
          COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_appointments,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) as monthly_revenue
        FROM appointments 
        WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE)
      `);

      // Novos clientes do mês
      const newClients = await pool.query(`
        SELECT COUNT(*) as new_clients
        FROM clients 
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `);

      const totalRevenueData = totalRevenue.rows[0];
      const monthlyData = currentMonth.rows[0];

      res.json({
        totalClients: Number(clients.rows[0].count),
        totalEmployees: Number(employees.rows[0].count),
        totalServices: Number(services.rows[0].count),
        totalAppointments: Number(appointments.rows[0].count),
        totalProducts: Number(products.rows[0].count),
        totalRevenue: Number(totalRevenueData.appointments_revenue) + Number(totalRevenueData.sales_revenue),
        monthlyStats: {
          completedAppointments: Number(monthlyData.completed_appointments),
          scheduledAppointments: Number(monthlyData.scheduled_appointments),
          canceledAppointments: Number(monthlyData.canceled_appointments),
          monthlyRevenue: Number(monthlyData.monthly_revenue),
          newClients: Number(newClients.rows[0].new_clients)
        }
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar estatísticas', error: err.message });
    }
  }

  async getRecentAppointments(req, res) {
    const pool = req.pool;
    try {
      const { rows } = await pool.query(`
        SELECT a.id, a.appointment_date, a.appointment_time, c.name as client_name, e.name as employee_name, s.name as service_name, a.status
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN employees e ON a.employee_id = e.id
        JOIN services s ON a.service_id = s.id
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 10
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar agendamentos recentes', error: err.message });
    }
  }

  async getTopEmployees(req, res) {
    const pool = req.pool;
    try {
      const { rows } = await pool.query(`
        -- Conta apenas serviços realmente concluídos para ranking
        SELECT e.id, e.name, COUNT(a.id) as total_appointments
        FROM employees e
        LEFT JOIN appointments a ON a.employee_id = e.id AND a.status = 'completed'
        GROUP BY e.id, e.name
        ORDER BY total_appointments DESC
        LIMIT 5
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar funcionários destaque', error: err.message });
    }
  }

  async getRevenueSummary(req, res) {
    const pool = req.pool;
    try {
      const { rows } = await pool.query(`
        SELECT 
          COALESCE(SUM(price),0) as total_appointments,
          (SELECT COALESCE(SUM(total_amount),0) FROM sales) as total_sales
        FROM appointments WHERE status = 'completed'
      `);
      res.json({
        totalAppointmentsRevenue: Number(rows[0].total_appointments),
        totalSalesRevenue: Number(rows[0].total_sales)
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar receita', error: err.message });
    }
  }

  async getExpenseBreakdown(req, res) {
    const pool = req.pool;
    try {
      // Despesas por categoria (últimos 30 dias)
      const { rows: categoryBreakdown } = await pool.query(`
        SELECT 
          e.category,
          ec.name as category_name,
          ec.color,
          ec.icon,
          COUNT(*) as count,
          SUM(e.amount) as total,
          AVG(e.amount) as average,
          MIN(e.amount) as min_amount,
          MAX(e.amount) as max_amount
        FROM expenses e
        LEFT JOIN expense_categories ec ON e.category = ec.name
        WHERE e.expense_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY e.category, ec.name, ec.color, ec.icon
        ORDER BY total DESC
      `);

      // Despesas por método de pagamento
      const { rows: paymentBreakdown } = await pool.query(`
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(amount) as total
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY payment_method
        ORDER BY total DESC
      `);

      // Comparação com período anterior
      const { rows: currentPeriod } = await pool.query(`
        SELECT SUM(amount) as total
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '30 days'
      `);

      const { rows: previousPeriod } = await pool.query(`
        SELECT SUM(amount) as total
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '60 days'
        AND expense_date < CURRENT_DATE - INTERVAL '30 days'
      `);

      const currentTotal = parseFloat(currentPeriod[0]?.total || 0);
      const previousTotal = parseFloat(previousPeriod[0]?.total || 0);
      const changePercentage = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;

      res.json({
        by_category: categoryBreakdown,
        by_payment_method: paymentBreakdown,
        period_comparison: {
          current_period: currentTotal,
          previous_period: previousTotal,
          change_percentage: parseFloat(changePercentage.toFixed(2)),
          change_amount: currentTotal - previousTotal
        }
      });
    } catch (err) {
      console.error('Erro ao buscar breakdown de despesas:', err);
      res.status(500).json({ message: 'Erro ao buscar despesas', error: err.message });
    }
  }

  // Novas análises avançadas
  async getRevenueAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Receita por mês (últimos 12 meses)
      const monthlyRevenue = await pool.query(`
        SELECT 
          TO_CHAR(appointment_date, 'YYYY-MM') as month,
          COUNT(*) as appointments_count,
          SUM(price) as revenue
        FROM appointments 
        WHERE status = 'completed' 
          AND appointment_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(appointment_date, 'YYYY-MM')
        ORDER BY month
      `);

      // Receita por categoria de serviço
      const revenueByCategory = await pool.query(`
        SELECT 
          sc.name as category,
          COUNT(a.*) as appointments_count,
          SUM(a.price) as revenue,
          AVG(a.price) as avg_price
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN service_categories sc ON s.category_id = sc.id
        WHERE a.status = 'completed'
        GROUP BY sc.id, sc.name
        ORDER BY revenue DESC
      `);

      // Receita por funcionário
      const revenueByEmployee = await pool.query(`
        SELECT 
          e.name as employee,
          COUNT(a.*) as appointments_count,
          SUM(a.price) as revenue,
          SUM(a.commission_amount) as total_commission
        FROM appointments a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.status = 'completed'
        GROUP BY e.id, e.name
        ORDER BY revenue DESC
      `);

      res.json({
        monthlyRevenue: monthlyRevenue.rows,
        revenueByCategory: revenueByCategory.rows,
        revenueByEmployee: revenueByEmployee.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise de receita', error: err.message });
    }
  }

  async getCustomerAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Clientes mais frequentes
      const topCustomers = await pool.query(`
        SELECT 
          c.name,
          c.phone,
          c.total_visits,
          c.total_spent,
          c.last_visit,
          CASE 
            WHEN c.last_visit >= CURRENT_DATE - INTERVAL '30 days' THEN 'Ativo'
            WHEN c.last_visit >= CURRENT_DATE - INTERVAL '90 days' THEN 'Moderado'
            ELSE 'Inativo'
          END as status
        FROM clients c
        WHERE c.total_visits > 0
        ORDER BY c.total_spent DESC
        LIMIT 20
      `);

      // Segmentação de clientes por frequência
      const customerSegments = await pool.query(`
        SELECT 
          CASE 
            WHEN total_visits >= 10 THEN 'VIP'
            WHEN total_visits >= 5 THEN 'Frequente'
            WHEN total_visits >= 2 THEN 'Regular'
            ELSE 'Novo'
          END as segment,
          COUNT(*) as count,
          AVG(total_spent) as avg_spent
        FROM clients
        GROUP BY segment
        ORDER BY avg_spent DESC
      `);

      // Novos clientes por mês
      const newCustomersByMonth = await pool.query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as new_customers
        FROM clients
        WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month
      `);

      // Taxa de retenção
      const retentionAnalysis = await pool.query(`
        SELECT 
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_last_30,
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '60 days' THEN 1 END) as active_last_60,
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as active_last_90,
          COUNT(*) as total_customers
        FROM clients
        WHERE total_visits > 0
      `);

      res.json({
        topCustomers: topCustomers.rows,
        customerSegments: customerSegments.rows,
        newCustomersByMonth: newCustomersByMonth.rows,
        retentionAnalysis: retentionAnalysis.rows[0]
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise de clientes', error: err.message });
    }
  }

  async getServiceAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Serviços mais populares
      const popularServices = await pool.query(`
        SELECT 
          s.name,
          sc.name as category,
          COUNT(a.*) as bookings_count,
          SUM(a.price) as total_revenue,
          AVG(a.price) as avg_price,
          s.duration_minutes
        FROM services s
        LEFT JOIN service_categories sc ON s.category_id = sc.id
        LEFT JOIN appointments a ON s.id = a.service_id AND a.status = 'completed'
        WHERE s.is_active = true
        GROUP BY s.id, s.name, sc.name, s.duration_minutes
        ORDER BY bookings_count DESC
      `);

      // Performance por hora do dia
      const hourlyPerformance = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM appointment_time) as hour,
          COUNT(*) as appointments_count,
          SUM(price) as revenue
        FROM appointments
        WHERE status = 'completed'
        GROUP BY EXTRACT(HOUR FROM appointment_time)
        ORDER BY hour
      `);

      // Performance por dia da semana
      const weeklyPerformance = await pool.query(`
        SELECT 
          EXTRACT(DOW FROM appointment_date) as day_of_week,
          TO_CHAR(appointment_date, 'Day') as day_name,
          COUNT(*) as appointments_count,
          SUM(price) as revenue
        FROM appointments
        WHERE status = 'completed'
        GROUP BY EXTRACT(DOW FROM appointment_date), TO_CHAR(appointment_date, 'Day')
        ORDER BY day_of_week
      `);

      // Taxa de cancelamento por serviço
      const cancellationRates = await pool.query(`
        SELECT 
          s.name as service,
          COUNT(CASE WHEN a.status = 'canceled' THEN 1 END) as canceled,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
          COUNT(*) as total,
          ROUND(
            (COUNT(CASE WHEN a.status = 'canceled' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2
          ) as cancellation_rate
        FROM services s
        LEFT JOIN appointments a ON s.id = a.service_id
        WHERE s.is_active = true
        GROUP BY s.id, s.name
        ORDER BY cancellation_rate DESC
      `);

      res.json({
        popularServices: popularServices.rows,
        hourlyPerformance: hourlyPerformance.rows,
        weeklyPerformance: weeklyPerformance.rows,
        cancellationRates: cancellationRates.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise de serviços', error: err.message });
    }
  }

  async getEmployeeAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Performance detalhada dos funcionários
      const employeePerformance = await pool.query(`
        SELECT 
          e.name,
          COUNT(a.*) as total_appointments,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN a.status = 'canceled' THEN 1 END) as canceled_appointments,
          SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) as revenue_generated,
          SUM(CASE WHEN a.status = 'completed' THEN a.commission_amount ELSE 0 END) as total_commission,
          AVG(CASE WHEN a.status = 'completed' THEN a.price END) as avg_service_price,
          ROUND(
            (COUNT(CASE WHEN a.status = 'completed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2
          ) as completion_rate
        FROM employees e
        LEFT JOIN appointments a ON e.id = a.employee_id
        WHERE e.status = 'active'
        GROUP BY e.id, e.name
        ORDER BY revenue_generated DESC NULLS LAST
      `);

      // Especialidades mais rentáveis por funcionário
      const employeeSpecialties = await pool.query(`
        SELECT 
          e.name as employee,
          s.name as service,
          es.commission_rate,
          COUNT(a.*) as appointments_count,
          SUM(a.price) as service_revenue,
          SUM(a.commission_amount) as commission_earned
        FROM employee_specialties es
        JOIN employees e ON es.employee_id = e.id
        JOIN services s ON es.service_id = s.id
        LEFT JOIN appointments a ON e.id = a.employee_id AND s.id = a.service_id AND a.status = 'completed'
        WHERE e.status = 'active'
        GROUP BY e.name, s.name, es.commission_rate
        ORDER BY commission_earned DESC NULLS LAST
      `);

      res.json({
        employeePerformance: employeePerformance.rows,
        employeeSpecialties: employeeSpecialties.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise de funcionários', error: err.message });
    }
  }

  async getInventoryAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Status do estoque
      const stockStatus = await pool.query(`
        SELECT 
          p.name,
          pc.name as category,
          p.current_stock,
          p.min_stock_level,
          p.max_stock_level,
          p.cost_price,
          p.selling_price,
          (p.selling_price - p.cost_price) as profit_margin,
          CASE 
            WHEN p.current_stock <= 0 THEN 'Sem Estoque'
            WHEN p.current_stock <= p.min_stock_level THEN 'Estoque Baixo'
            WHEN p.current_stock >= p.max_stock_level THEN 'Estoque Alto'
            ELSE 'Normal'
          END as stock_status
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.is_active = true
        ORDER BY 
          CASE 
            WHEN p.current_stock <= 0 THEN 1
            WHEN p.current_stock <= p.min_stock_level THEN 2
            ELSE 3
          END,
          p.name
      `);

      // Movimentação de estoque
      const stockMovements = await pool.query(`
        SELECT 
          p.name as product,
          sm.movement_type,
          SUM(sm.quantity) as total_quantity,
          COUNT(*) as movement_count
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE sm.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.name, sm.movement_type
        ORDER BY p.name, sm.movement_type
      `);

      // Produtos mais vendidos
      const topSellingProducts = await pool.query(`
        SELECT 
          p.name,
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue,
          COUNT(DISTINCT s.id) as sales_count
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed'
        GROUP BY p.id, p.name
        ORDER BY total_sold DESC
        LIMIT 10
      `);

      res.json({
        stockStatus: stockStatus.rows,
        stockMovements: stockMovements.rows,
        topSellingProducts: topSellingProducts.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise de estoque', error: err.message });
    }
  }

  async getFinancialAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Análise financeira mensal
      const monthlyFinancials = await pool.query(`
        SELECT 
          month,
          appointments_revenue,
          sales_revenue,
          total_revenue,
          total_expenses,
          (total_revenue - total_expenses) as net_profit
        FROM (
          SELECT 
            TO_CHAR(date_month, 'YYYY-MM') as month,
            COALESCE(appointments_revenue, 0) as appointments_revenue,
            COALESCE(sales_revenue, 0) as sales_revenue,
            (COALESCE(appointments_revenue, 0) + COALESCE(sales_revenue, 0)) as total_revenue,
            COALESCE(total_expenses, 0) as total_expenses
          FROM (
            SELECT generate_series(
              DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
              DATE_TRUNC('month', CURRENT_DATE),
              '1 month'::interval
            ) as date_month
          ) months
          LEFT JOIN (
            SELECT 
              DATE_TRUNC('month', appointment_date) as month,
              SUM(price) as appointments_revenue
            FROM appointments
            WHERE status = 'completed'
            GROUP BY DATE_TRUNC('month', appointment_date)
          ) app_rev ON months.date_month = app_rev.month
          LEFT JOIN (
            SELECT 
              DATE_TRUNC('month', sale_date) as month,
              SUM(total_amount) as sales_revenue
            FROM sales
            WHERE status = 'completed'
            GROUP BY DATE_TRUNC('month', sale_date)
          ) sales_rev ON months.date_month = sales_rev.month
          LEFT JOIN (
            SELECT 
              DATE_TRUNC('month', expense_date) as month,
              SUM(amount) as total_expenses
            FROM expenses
            GROUP BY DATE_TRUNC('month', expense_date)
          ) exp ON months.date_month = exp.month
        ) financial_data
        ORDER BY month
      `);

      // Métodos de pagamento
      const paymentMethods = await pool.query(`
        SELECT 
          payment_method,
          COUNT(*) as transaction_count,
          SUM(total_amount) as total_amount
        FROM sales
        WHERE status = 'completed'
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `);

      // Comissões dos funcionários
      const commissionsAnalysis = await pool.query(`
        SELECT 
          e.name as employee,
          SUM(ec.commission_amount) as total_commissions,
          AVG(ec.commission_rate) as avg_commission_rate,
          COUNT(*) as commission_count
        FROM employee_commissions ec
        JOIN employees e ON ec.employee_id = e.id
        WHERE ec.pay_period_start >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY e.id, e.name
        ORDER BY total_commissions DESC
      `);

      res.json({
        monthlyFinancials: monthlyFinancials.rows,
        paymentMethods: paymentMethods.rows,
        commissionsAnalysis: commissionsAnalysis.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise financeira', error: err.message });
    }
  }

  async getPredictiveAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Previsão de demanda baseada em tendências históricas
      const demandForecast = await pool.query(`
        WITH monthly_data AS (
          SELECT 
            DATE_TRUNC('month', appointment_date) as month,
            COUNT(*) as appointments_count,
            SUM(price) as revenue
          FROM appointments
          WHERE status = 'completed' 
            AND appointment_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', appointment_date)
          ORDER BY month
        )
        SELECT 
          month,
          appointments_count,
          revenue,
          AVG(appointments_count) OVER (
            ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
          ) as moving_avg_appointments,
          AVG(revenue) OVER (
            ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
          ) as moving_avg_revenue
        FROM monthly_data
      `);

      // Análise de sazonalidade
      const seasonalityAnalysis = await pool.query(`
        SELECT 
          EXTRACT(MONTH FROM appointment_date) as month,
          TO_CHAR(appointment_date, 'Month') as month_name,
          AVG(daily_appointments) as avg_daily_appointments,
          AVG(daily_revenue) as avg_daily_revenue
        FROM (
          SELECT 
            appointment_date,
            COUNT(*) as daily_appointments,
            SUM(price) as daily_revenue
          FROM appointments
          WHERE status = 'completed'
            AND appointment_date >= CURRENT_DATE - INTERVAL '2 years'
          GROUP BY appointment_date
        ) daily_data
        GROUP BY EXTRACT(MONTH FROM appointment_date), TO_CHAR(appointment_date, 'Month')
        ORDER BY month
      `);

      // Clientes em risco de abandono
      const churnRisk = await pool.query(`
        SELECT 
          c.name,
          c.phone,
          c.last_visit,
          c.total_visits,
          c.total_spent,
          CURRENT_DATE - c.last_visit as days_since_last_visit,
          CASE 
            WHEN CURRENT_DATE - c.last_visit > 180 THEN 'Alto Risco'
            WHEN CURRENT_DATE - c.last_visit > 90 THEN 'Médio Risco'
            WHEN CURRENT_DATE - c.last_visit > 60 THEN 'Baixo Risco'
            ELSE 'Ativo'
          END as churn_risk
        FROM clients c
        WHERE c.total_visits > 0
          AND c.last_visit IS NOT NULL
        ORDER BY days_since_last_visit DESC
        LIMIT 50
      `);

      res.json({
        demandForecast: demandForecast.rows,
        seasonalityAnalysis: seasonalityAnalysis.rows,
        churnRisk: churnRisk.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar análise preditiva', error: err.message });
    }
  }

  // Nova análise específica de despesas
  async getExpenseAnalysis(req, res) {
    const pool = req.pool;
    try {
      // Evolução mensal das despesas (últimos 12 meses)
      const { rows: monthlyTrend } = await pool.query(`
        SELECT 
          DATE_TRUNC('month', expense_date) as month,
          COUNT(*) as count,
          SUM(amount) as total,
          AVG(amount) as average
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', expense_date)
        ORDER BY month ASC
      `);

      // Top 5 maiores despesas do mês atual
      const { rows: topExpenses } = await pool.query(`
        SELECT 
          description,
          category,
          amount,
          expense_date,
          payment_method
        FROM expenses 
        WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
        ORDER BY amount DESC
        LIMIT 5
      `);

      // Despesas recorrentes identificadas
      const { rows: recurringExpenses } = await pool.query(`
        SELECT 
          description,
          category,
          COUNT(*) as frequency,
          AVG(amount) as avg_amount,
          SUM(amount) as total_amount,
          MIN(expense_date) as first_date,
          MAX(expense_date) as last_date
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY description, category
        HAVING COUNT(*) >= 2
        ORDER BY frequency DESC, total_amount DESC
        LIMIT 10
      `);

      // Análise de sazonalidade (por dia da semana)
      const { rows: weekdayAnalysis } = await pool.query(`
        SELECT 
          EXTRACT(DOW FROM expense_date) as day_of_week,
          CASE EXTRACT(DOW FROM expense_date)
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
          END as day_name,
          COUNT(*) as count,
          SUM(amount) as total,
          AVG(amount) as average
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY EXTRACT(DOW FROM expense_date)
        ORDER BY day_of_week
      `);

      // Comparação com receitas (se existir tabela de receitas/vendas)
      const { rows: revenueComparison } = await pool.query(`
        WITH monthly_expenses AS (
          SELECT 
            DATE_TRUNC('month', expense_date) as month,
            SUM(amount) as total_expenses
          FROM expenses 
          WHERE expense_date >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', expense_date)
        ),
        monthly_revenue AS (
          SELECT 
            DATE_TRUNC('month', appointment_date) as month,
            SUM(price) as total_revenue
          FROM appointments 
          WHERE appointment_date >= CURRENT_DATE - INTERVAL '6 months'
          AND status = 'completed'
          GROUP BY DATE_TRUNC('month', appointment_date)
        )
        SELECT 
          COALESCE(e.month, r.month) as month,
          COALESCE(e.total_expenses, 0) as expenses,
          COALESCE(r.total_revenue, 0) as revenue,
          CASE 
            WHEN COALESCE(r.total_revenue, 0) > 0 
            THEN (COALESCE(e.total_expenses, 0) / COALESCE(r.total_revenue, 0) * 100)
            ELSE 0 
          END as expense_ratio
        FROM monthly_expenses e
        FULL OUTER JOIN monthly_revenue r ON e.month = r.month
        ORDER BY month ASC
      `);

      res.json({
        monthly_trend: monthlyTrend,
        top_expenses: topExpenses,
        recurring_expenses: recurringExpenses,
        weekday_analysis: weekdayAnalysis,
        revenue_comparison: revenueComparison
      });
    } catch (err) {
      console.error('Erro ao buscar análise de despesas:', err);
      res.status(500).json({ message: 'Erro ao buscar análise de despesas', error: err.message });
    }
  }

  // Endpoint para gerar relatório completo (para PDF)
  async getCompleteReport(req, res) {
    const pool = req.pool;
    try {
      // Buscar todos os dados necessários para o relatório
      const [
        stats,
        revenueAnalysis,
        customerAnalysis,
        serviceAnalysis,
        employeeAnalysis,
        inventoryAnalysis,
        financialAnalysis,
        predictiveAnalysis
      ] = await Promise.all([
        this.getStatsData(pool),
        this.getRevenueAnalysisData(pool),
        this.getCustomerAnalysisData(pool),
        this.getServiceAnalysisData(pool),
        this.getEmployeeAnalysisData(pool),
        this.getInventoryAnalysisData(pool),
        this.getFinancialAnalysisData(pool),
        this.getPredictiveAnalysisData(pool)
      ]);

      res.json({
        generatedAt: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        stats,
        revenueAnalysis,
        customerAnalysis,
        serviceAnalysis,
        employeeAnalysis,
        inventoryAnalysis,
        financialAnalysis,
        predictiveAnalysis
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao gerar relatório completo', error: err.message });
    }
  }

  // Métodos auxiliares para buscar dados (reutilizáveis)
  async getStatsData(pool) {
    const [clients, employees, services, appointments, products, totalRevenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM clients'),
      pool.query('SELECT COUNT(*) FROM employees WHERE status = \'active\''),
      pool.query('SELECT COUNT(*) FROM services WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM appointments'),
      pool.query('SELECT COUNT(*) FROM products WHERE is_active = true'),
      pool.query(`
        SELECT 
          COALESCE(SUM(a.price), 0) as appointments_revenue,
          (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE status = 'completed') as sales_revenue
        FROM appointments a WHERE a.status = 'completed'
      `)
    ]);

    const currentMonth = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_appointments,
        COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_appointments,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) as monthly_revenue
      FROM appointments 
      WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    const newClients = await pool.query(`
      SELECT COUNT(*) as new_clients
      FROM clients 
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    const totalRevenueData = totalRevenue.rows[0];
    const monthlyData = currentMonth.rows[0];

    return {
      totalClients: Number(clients.rows[0].count),
      totalEmployees: Number(employees.rows[0].count),
      totalServices: Number(services.rows[0].count),
      totalAppointments: Number(appointments.rows[0].count),
      totalProducts: Number(products.rows[0].count),
      totalRevenue: Number(totalRevenueData.appointments_revenue) + Number(totalRevenueData.sales_revenue),
      monthlyStats: {
        completedAppointments: Number(monthlyData.completed_appointments),
        scheduledAppointments: Number(monthlyData.scheduled_appointments),
        canceledAppointments: Number(monthlyData.canceled_appointments),
        monthlyRevenue: Number(monthlyData.monthly_revenue),
        newClients: Number(newClients.rows[0].new_clients)
      }
    };
  }

  async getRevenueAnalysisData(pool) {
    const [monthlyRevenue, revenueByCategory, revenueByEmployee] = await Promise.all([
      pool.query(`
        SELECT 
          TO_CHAR(appointment_date, 'YYYY-MM') as month,
          COUNT(*) as appointments_count,
          SUM(price) as revenue
        FROM appointments 
        WHERE status = 'completed' 
          AND appointment_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(appointment_date, 'YYYY-MM')
        ORDER BY month
      `),
      pool.query(`
        SELECT 
          sc.name as category,
          COUNT(a.*) as appointments_count,
          SUM(a.price) as revenue,
          AVG(a.price) as avg_price
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN service_categories sc ON s.category_id = sc.id
        WHERE a.status = 'completed'
        GROUP BY sc.id, sc.name
        ORDER BY revenue DESC
      `),
      pool.query(`
        SELECT 
          e.name as employee,
          COUNT(a.*) as appointments_count,
          SUM(a.price) as revenue,
          SUM(a.commission_amount) as total_commission
        FROM appointments a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.status = 'completed'
        GROUP BY e.id, e.name
        ORDER BY revenue DESC
      `)
    ]);

    return {
      monthlyRevenue: monthlyRevenue.rows,
      revenueByCategory: revenueByCategory.rows,
      revenueByEmployee: revenueByEmployee.rows
    };
  }

  async getCustomerAnalysisData(pool) {
    const [topCustomers, customerSegments, newCustomersByMonth, retentionAnalysis] = await Promise.all([
      pool.query(`
        SELECT 
          c.name,
          c.phone,
          c.total_visits,
          c.total_spent,
          c.last_visit,
          CASE 
            WHEN c.last_visit >= CURRENT_DATE - INTERVAL '30 days' THEN 'Ativo'
            WHEN c.last_visit >= CURRENT_DATE - INTERVAL '90 days' THEN 'Moderado'
            ELSE 'Inativo'
          END as status
        FROM clients c
        WHERE c.total_visits > 0
        ORDER BY c.total_spent DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT 
          CASE 
            WHEN total_visits >= 10 THEN 'VIP'
            WHEN total_visits >= 5 THEN 'Frequente'
            WHEN total_visits >= 2 THEN 'Regular'
            ELSE 'Novo'
          END as segment,
          COUNT(*) as count,
          AVG(total_spent) as avg_spent
        FROM clients
        GROUP BY segment
        ORDER BY avg_spent DESC
      `),
      pool.query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as new_customers
        FROM clients
        WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month
      `),
      pool.query(`
        SELECT 
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_last_30,
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '60 days' THEN 1 END) as active_last_60,
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as active_last_90,
          COUNT(*) as total_customers
        FROM clients
        WHERE total_visits > 0
      `)
    ]);

    return {
      topCustomers: topCustomers.rows,
      customerSegments: customerSegments.rows,
      newCustomersByMonth: newCustomersByMonth.rows,
      retentionAnalysis: retentionAnalysis.rows[0]
    };
  }

  async getServiceAnalysisData(pool) {
    const [popularServices, hourlyPerformance, weeklyPerformance, cancellationRates] = await Promise.all([
      pool.query(`
        SELECT 
          s.name,
          sc.name as category,
          COUNT(a.*) as bookings_count,
          SUM(a.price) as total_revenue,
          AVG(a.price) as avg_price,
          s.duration_minutes
        FROM services s
        LEFT JOIN service_categories sc ON s.category_id = sc.id
        LEFT JOIN appointments a ON s.id = a.service_id AND a.status = 'completed'
        WHERE s.is_active = true
        GROUP BY s.id, s.name, sc.name, s.duration_minutes
        ORDER BY bookings_count DESC
      `),
      pool.query(`
        SELECT 
          EXTRACT(HOUR FROM appointment_time) as hour,
          COUNT(*) as appointments_count,
          SUM(price) as revenue
        FROM appointments
        WHERE status = 'completed'
        GROUP BY EXTRACT(HOUR FROM appointment_time)
        ORDER BY hour
      `),
      pool.query(`
        SELECT 
          EXTRACT(DOW FROM appointment_date) as day_of_week,
          TO_CHAR(appointment_date, 'Day') as day_name,
          COUNT(*) as appointments_count,
          SUM(price) as revenue
        FROM appointments
        WHERE status = 'completed'
        GROUP BY EXTRACT(DOW FROM appointment_date), TO_CHAR(appointment_date, 'Day')
        ORDER BY day_of_week
      `),
      pool.query(`
        SELECT 
          s.name as service,
          COUNT(CASE WHEN a.status = 'canceled' THEN 1 END) as canceled,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
          COUNT(*) as total,
          ROUND(
            (COUNT(CASE WHEN a.status = 'canceled' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2
          ) as cancellation_rate
        FROM services s
        LEFT JOIN appointments a ON s.id = a.service_id
        WHERE s.is_active = true
        GROUP BY s.id, s.name
        ORDER BY cancellation_rate DESC
      `)
    ]);

    return {
      popularServices: popularServices.rows,
      hourlyPerformance: hourlyPerformance.rows,
      weeklyPerformance: weeklyPerformance.rows,
      cancellationRates: cancellationRates.rows
    };
  }

  async getEmployeeAnalysisData(pool) {
    const [employeePerformance, employeeSpecialties] = await Promise.all([
      pool.query(`
        SELECT 
          e.name,
          COUNT(a.*) as total_appointments,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN a.status = 'canceled' THEN 1 END) as canceled_appointments,
          SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) as revenue_generated,
          SUM(CASE WHEN a.status = 'completed' THEN a.commission_amount ELSE 0 END) as total_commission,
          AVG(CASE WHEN a.status = 'completed' THEN a.price END) as avg_service_price,
          ROUND(
            (COUNT(CASE WHEN a.status = 'completed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2
          ) as completion_rate
        FROM employees e
        LEFT JOIN appointments a ON e.id = a.employee_id
        WHERE e.status = 'active'
        GROUP BY e.id, e.name
        ORDER BY revenue_generated DESC NULLS LAST
      `),
      pool.query(`
        SELECT 
          e.name as employee,
          s.name as service,
          es.commission_rate,
          COUNT(a.*) as appointments_count,
          SUM(a.price) as service_revenue,
          SUM(a.commission_amount) as commission_earned
        FROM employee_specialties es
        JOIN employees e ON es.employee_id = e.id
        JOIN services s ON es.service_id = s.id
        LEFT JOIN appointments a ON e.id = a.employee_id AND s.id = a.service_id AND a.status = 'completed'
        WHERE e.status = 'active'
        GROUP BY e.name, s.name, es.commission_rate
        ORDER BY commission_earned DESC NULLS LAST
      `)
    ]);

    return {
      employeePerformance: employeePerformance.rows,
      employeeSpecialties: employeeSpecialties.rows
    };
  }

  async getInventoryAnalysisData(pool) {
    const [stockStatus, stockMovements, topSellingProducts] = await Promise.all([
      pool.query(`
        SELECT 
          p.name,
          pc.name as category,
          p.current_stock,
          p.min_stock_level,
          p.max_stock_level,
          p.cost_price,
          p.selling_price,
          (p.selling_price - p.cost_price) as profit_margin,
          CASE 
            WHEN p.current_stock <= 0 THEN 'Sem Estoque'
            WHEN p.current_stock <= p.min_stock_level THEN 'Estoque Baixo'
            WHEN p.current_stock >= p.max_stock_level THEN 'Estoque Alto'
            ELSE 'Normal'
          END as stock_status
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.is_active = true
        ORDER BY 
          CASE 
            WHEN p.current_stock <= 0 THEN 1
            WHEN p.current_stock <= p.min_stock_level THEN 2
            ELSE 3
          END,
          p.name
      `),
      pool.query(`
        SELECT 
          p.name as product,
          sm.movement_type,
          SUM(sm.quantity) as total_quantity,
          COUNT(*) as movement_count
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE sm.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.name, sm.movement_type
        ORDER BY p.name, sm.movement_type
      `),
      pool.query(`
        SELECT 
          p.name,
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue,
          COUNT(DISTINCT s.id) as sales_count
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed'
        GROUP BY p.id, p.name
        ORDER BY total_sold DESC
        LIMIT 10
      `)
    ]);

    return {
      stockStatus: stockStatus.rows,
      stockMovements: stockMovements.rows,
      topSellingProducts: topSellingProducts.rows
    };
  }

  async getFinancialAnalysisData(pool) {
    const [monthlyFinancials, paymentMethods, commissionsAnalysis] = await Promise.all([
      pool.query(`
        SELECT 
          month,
          appointments_revenue,
          sales_revenue,
          total_revenue,
          total_expenses,
          (total_revenue - total_expenses) as net_profit
        FROM (
          SELECT 
            TO_CHAR(date_month, 'YYYY-MM') as month,
            COALESCE(appointments_revenue, 0) as appointments_revenue,
            COALESCE(sales_revenue, 0) as sales_revenue,
            (COALESCE(appointments_revenue, 0) + COALESCE(sales_revenue, 0)) as total_revenue,
            COALESCE(total_expenses, 0) as total_expenses
          FROM (
            SELECT generate_series(
              DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
              DATE_TRUNC('month', CURRENT_DATE),
              '1 month'::interval
            ) as date_month
          ) months
          LEFT JOIN (
            SELECT 
              DATE_TRUNC('month', appointment_date) as month,
              SUM(price) as appointments_revenue
            FROM appointments
            WHERE status = 'completed'
            GROUP BY DATE_TRUNC('month', appointment_date)
          ) app_rev ON months.date_month = app_rev.month
          LEFT JOIN (
            SELECT 
              DATE_TRUNC('month', sale_date) as month,
              SUM(total_amount) as sales_revenue
            FROM sales
            WHERE status = 'completed'
            GROUP BY DATE_TRUNC('month', sale_date)
          ) sales_rev ON months.date_month = sales_rev.month
          LEFT JOIN (
            SELECT 
              DATE_TRUNC('month', expense_date) as month,
              SUM(amount) as total_expenses
            FROM expenses
            GROUP BY DATE_TRUNC('month', expense_date)
          ) exp ON months.date_month = exp.month
        ) financial_data
        ORDER BY month
      `),
      pool.query(`
        SELECT 
          payment_method,
          COUNT(*) as transaction_count,
          SUM(total_amount) as total_amount
        FROM sales
        WHERE status = 'completed'
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `),
      pool.query(`
        SELECT 
          e.name as employee,
          SUM(ec.commission_amount) as total_commissions,
          AVG(ec.commission_rate) as avg_commission_rate,
          COUNT(*) as commission_count
        FROM employee_commissions ec
        JOIN employees e ON ec.employee_id = e.id
        WHERE ec.pay_period_start >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY e.id, e.name
        ORDER BY total_commissions DESC
      `)
    ]);

    return {
      monthlyFinancials: monthlyFinancials.rows,
      paymentMethods: paymentMethods.rows,
      commissionsAnalysis: commissionsAnalysis.rows
    };
  }

  async getPredictiveAnalysisData(pool) {
    const [demandForecast, seasonalityAnalysis, churnRisk] = await Promise.all([
      pool.query(`
        WITH monthly_data AS (
          SELECT 
            DATE_TRUNC('month', appointment_date) as month,
            COUNT(*) as appointments_count,
            SUM(price) as revenue
          FROM appointments
          WHERE status = 'completed' 
            AND appointment_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', appointment_date)
          ORDER BY month
        )
        SELECT 
          month,
          appointments_count,
          revenue,
          AVG(appointments_count) OVER (
            ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
          ) as moving_avg_appointments,
          AVG(revenue) OVER (
            ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
          ) as moving_avg_revenue
        FROM monthly_data
      `),
      pool.query(`
        SELECT 
          EXTRACT(MONTH FROM appointment_date) as month,
          TO_CHAR(appointment_date, 'Month') as month_name,
          AVG(daily_appointments) as avg_daily_appointments,
          AVG(daily_revenue) as avg_daily_revenue
        FROM (
          SELECT 
            appointment_date,
            COUNT(*) as daily_appointments,
            SUM(price) as daily_revenue
          FROM appointments
          WHERE status = 'completed'
            AND appointment_date >= CURRENT_DATE - INTERVAL '2 years'
          GROUP BY appointment_date
        ) daily_data
        GROUP BY EXTRACT(MONTH FROM appointment_date), TO_CHAR(appointment_date, 'Month')
        ORDER BY month
      `),
      pool.query(`
        SELECT 
          c.name,
          c.phone,
          c.last_visit,
          c.total_visits,
          c.total_spent,
          CURRENT_DATE - c.last_visit as days_since_last_visit,
          CASE 
            WHEN CURRENT_DATE - c.last_visit > 180 THEN 'Alto Risco'
            WHEN CURRENT_DATE - c.last_visit > 90 THEN 'Médio Risco'
            WHEN CURRENT_DATE - c.last_visit > 60 THEN 'Baixo Risco'
            ELSE 'Ativo'
          END as churn_risk
        FROM clients c
        WHERE c.total_visits > 0
          AND c.last_visit IS NOT NULL
        ORDER BY days_since_last_visit DESC
        LIMIT 50
      `)
    ]);

    return {
      demandForecast: demandForecast.rows,
      seasonalityAnalysis: seasonalityAnalysis.rows,
      churnRisk: churnRisk.rows
    };
  }
}

export default DashboardController;
