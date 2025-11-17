import pool from "../db/postgre.js";
import whatsappService from "../services/whatsappNotificationService.js";

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

class ClientController {
  async list(req, res) {
    const db = getPool(req);
    try {
      const { q, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          c.id, c.name, c.email, c.phone, c.address, c.birth_date, 
          c.notes, c.first_visit, c.last_visit, c.total_visits, 
          c.total_spent, c.created_at, c.updated_at,
          COUNT(a.id) as upcoming_appointments
        FROM clients c
        LEFT JOIN appointments a ON c.id = a.client_id AND a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled'
      `;
      let countQuery = 'SELECT COUNT(*) FROM clients c';
      let params = [];
      let whereClause = '';
      
      if (q) {
        whereClause = ' WHERE (unaccent(lower(c.name)) LIKE unaccent(lower($1)) OR c.phone LIKE $2 OR c.email LIKE unaccent(lower($3)))';
        params = [`%${q}%`, `%${q}%`, `%${q}%`];
        countQuery += whereClause;
      }
      
      query += whereClause + ' GROUP BY c.id ORDER BY c.name LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      if (q && limit <= 20) {
        // Para busca rápida, retorna só dados básicos
        const { rows } = await db.query(
          `SELECT id, name, phone, email FROM clients WHERE unaccent(lower(name)) LIKE unaccent(lower($1)) OR phone LIKE $2 ORDER BY name LIMIT 20`,
          [`%${q}%`, `%${q}%`]
        );
        return res.json(rows);
      }
      
      const [clientsResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])
      ]);
      
      res.json({
        clients: clientsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(countResult.rows[0].count / limit)
        }
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao listar clientes', error: err.message });
    }
  }

  async getById(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    try {
      const clientQuery = `
        SELECT 
          c.*, 
          COUNT(DISTINCT a.id) as total_appointments,
          COUNT(DISTINCT CASE WHEN a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled' THEN a.id END) as upcoming_appointments,
          MAX(a.appointment_date) as last_appointment_date,
          AVG(a.price) as average_service_price
        FROM clients c
        LEFT JOIN appointments a ON c.id = a.client_id
        WHERE c.id = $1
        GROUP BY c.id
      `;
      
      const appointmentsQuery = `
        SELECT 
          a.id, a.appointment_date, a.appointment_time, a.status, a.price, a.notes,
          s.name as service_name, e.name as employee_name
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.client_id = $1
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 10
      `;
      
      const [clientResult, appointmentsResult] = await Promise.all([
        db.query(clientQuery, [id]),
        db.query(appointmentsQuery, [id])
      ]);
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      
      res.json({
        ...clientResult.rows[0],
        recent_appointments: appointmentsResult.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar cliente', error: err.message });
    }
  }

  async create(req, res) {
    const db = getPool(req);
    const { name, email, phone, address, birth_date, notes } = req.body;
    
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });
    
    try {
      // Verifica se já existe cliente com o mesmo telefone ou email
      const existing = await db.query(
        `SELECT id, name FROM clients WHERE phone = $1 OR (email IS NOT NULL AND email = $2) LIMIT 1`, 
        [phone, email]
      );
      
      if (existing.rows.length) {
        return res.status(409).json({ 
          message: 'Cliente já existe com este telefone ou email', 
          existing_client: existing.rows[0] 
        });
      }
      
      const { rows } = await db.query(
        `INSERT INTO clients (name, email, phone, address, birth_date, notes, first_visit, last_visit, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [name, email, phone, address, birth_date, notes]
      );
      
      const newClient = rows[0];
      
      // Enviar mensagem de boas-vindas via WhatsApp se o cliente tiver telefone
      if (phone) {
        try {
          const welcomeMessage = `🎉 *Bem-vindo(a), ${name}!*\n\nOlá! É um prazer ter você como nosso cliente!\n\nEstamos aqui para cuidar da sua beleza com todo carinho e profissionalismo.\n\n✨ *Nossos serviços incluem:*\n• Cortes e penteados\n• Coloração e mechas\n• Tratamentos capilares\n• Manicure e pedicure\n• E muito mais!\n\n📅 Para agendamentos, entre em contato conosco!\n\n💖 Obrigada por escolher nosso salão!`;
          
          await whatsappService.sendMessage(phone, welcomeMessage);
          console.log(`Mensagem de boas-vindas enviada para ${name} (${phone})`);
        } catch (whatsappError) {
          console.error('Erro ao enviar mensagem de boas-vindas:', whatsappError);
          // Não falha a criação do cliente se a mensagem falhar
        }
      }
      
      res.status(201).json(newClient);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao criar cliente', error: err.message });
    }
  }

  async update(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { name, email, phone, address, birth_date, notes } = req.body;
    
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });
    
    try {
      // Verifica se existe outro cliente com o mesmo telefone ou email
      const existing = await db.query(
        `SELECT id FROM clients WHERE (phone = $1 OR (email IS NOT NULL AND email = $2)) AND id != $3 LIMIT 1`, 
        [phone, email, id]
      );
      
      if (existing.rows.length) {
        return res.status(409).json({ message: 'Já existe outro cliente com este telefone ou email' });
      }
      
      const { rows } = await db.query(
        `UPDATE clients 
         SET name = $1, email = $2, phone = $3, address = $4, birth_date = $5, notes = $6, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $7 
         RETURNING *`,
        [name, email, phone, address, birth_date, notes, id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao atualizar cliente', error: err.message });
    }
  }

  async delete(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    
    try {
      // Verifica se o cliente tem agendamentos
      const appointmentsCheck = await db.query(
        'SELECT COUNT(*) FROM appointments WHERE client_id = $1', 
        [id]
      );
      
      if (parseInt(appointmentsCheck.rows[0].count) > 0) {
        return res.status(409).json({ 
          message: 'Não é possível excluir cliente com agendamentos associados' 
        });
      }
      
      const result = await db.query('DELETE FROM clients WHERE id = $1 RETURNING name', [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      
      res.json({ message: `Cliente ${result.rows[0].name} excluído com sucesso` });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao excluir cliente', error: err.message });
    }
  }

  async getStats(req, res) {
    const db = getPool(req);
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_clients,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_clients_month,
          COUNT(CASE WHEN last_visit >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_clients_month,
          AVG(total_spent) as average_lifetime_value,
          AVG(total_visits) as average_visits_per_client
        FROM clients
      `;
      
      const topClientsQuery = `
        SELECT name, total_spent, total_visits 
        FROM clients 
        WHERE total_spent > 0 
        ORDER BY total_spent DESC 
        LIMIT 10
      `;
      
      const birthdaysQuery = `
        SELECT id, name, phone, birth_date
        FROM clients 
        WHERE EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM birth_date) >= EXTRACT(DAY FROM CURRENT_DATE)
        ORDER BY EXTRACT(DAY FROM birth_date)
        LIMIT 10
      `;
      
      const [stats, topClients, birthdays] = await Promise.all([
        db.query(statsQuery),
        db.query(topClientsQuery),
        db.query(birthdaysQuery)
      ]);
      
      res.json({
        stats: stats.rows[0],
        top_clients: topClients.rows,
        upcoming_birthdays: birthdays.rows
      });
    } catch (err) {
      res.status(500).json({ message: 'Erro ao buscar estatísticas', error: err.message });
    }
  }
}

export default new ClientController();
