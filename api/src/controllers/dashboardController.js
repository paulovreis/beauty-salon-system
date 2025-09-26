class DashboardController {
  async getStats(req, res) {
    const pool = req.pool;
    try {
      // Exemplo: total de clientes, funcionários, serviços, agendamentos
      const [clients, employees, services, appointments] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM clients'),
        pool.query('SELECT COUNT(*) FROM employees'),
        pool.query('SELECT COUNT(*) FROM services'),
        pool.query('SELECT COUNT(*) FROM appointments')
      ]);
      res.json({
        totalClients: Number(clients.rows[0].count),
        totalEmployees: Number(employees.rows[0].count),
        totalServices: Number(services.rows[0].count),
        totalAppointments: Number(appointments.rows[0].count)
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
      const { rows } = await pool.query(`
        SELECT category, SUM(amount) as total
        FROM expenses
        GROUP BY category
        ORDER BY total DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar despesas', error: err.message });
    }
  }
}

export default DashboardController;
