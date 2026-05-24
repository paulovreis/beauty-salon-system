import pool from '../db/postgre.js';
import * as bcrypt from 'bcryptjs';
import buildErrorResponse from '../utils/errorResponse.js';
import {
  decryptString,
  encryptString,
  hmacSha256Hex,
  normalizeEmail,
  normalizePhoneBR,
} from '../utils/fieldCrypto.js';

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

function decryptEmployeeRow(row) {
  if (!row) return row;
  const email = row.email_enc ? decryptString(row.email_enc) : row.email;
  const phone = row.phone_enc ? decryptString(row.phone_enc) : row.phone;

  // eslint-disable-next-line no-unused-vars
  const { email_enc, phone_enc, email_hash, phone_hash, ...rest } = row;
  return { ...rest, email, phone };
}

const EmployeeController = {
  async list(req, res) {
    const db = getPool(req);
    try {
      // Busca funcionários
      const { rows: employees } = await db.query('SELECT * FROM employees ORDER BY id');
      if (!employees.length) return res.json([]);

      // Mês atual boundaries
      const { rows: stats } = await db.query(`
        SELECT employee_id,
               COUNT(id) FILTER (WHERE status = 'completed') as services_completed,
               COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0) as total_revenue,
               COALESCE(SUM(commission_amount) FILTER (WHERE status = 'completed'), 0) as total_commission
        FROM appointments
        WHERE appointment_date >= date_trunc('month', CURRENT_DATE)
          AND appointment_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')
        GROUP BY employee_id
      `);
      const statMap = Object.fromEntries(stats.map((s) => [s.employee_id, s]));

      // Especialidades
      const { rows: specs } = await db.query(
        'SELECT employee_id, service_id, commission_rate FROM employee_specialties'
      );
      const specMap = {};
      specs.forEach((s) => {
        if (!specMap[s.employee_id]) specMap[s.employee_id] = [];
        specMap[s.employee_id].push({
          service_id: s.service_id,
          commission_rate: Number(s.commission_rate),
        });
      });

      const enriched = employees.map((employee) => {
        const stat = statMap[employee.id] || {
          services_completed: 0,
          total_revenue: 0,
          total_commission: 0,
        };
        const averageService = stat.services_completed
          ? Number(stat.total_revenue) / Number(stat.services_completed)
          : 0;

        return {
          ...decryptEmployeeRow(employee),
          monthlyStats: {
            servicesCompleted: Number(stat.services_completed),
            totalRevenue: Number(stat.total_revenue),
            totalCommission: Number(stat.total_commission),
            averageService: Number(averageService.toFixed(2)),
          },
          specialties: specMap[employee.id] || [],
        };
      });

      return res.json(enriched);
    } catch (err) {
      console.error('Erro ao buscar funcionários:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao buscar funcionários', ...buildErrorResponse(err) });
    }
  },

  async listBasic(req, res) {
    const db = getPool(req);
    try {
      const { rows } = await db.query('SELECT id, name, email, email_enc, status FROM employees ORDER BY id');
      return res.json((rows || []).map(decryptEmployeeRow));
    } catch (err) {
      console.error('Erro ao buscar lista básica de funcionários:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao buscar funcionários', ...buildErrorResponse(err) });
    }
  },

  async detail(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    if (req.user.role === 'employee' && req.user.id !== Number(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
      const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (!rows[0]) return res.status(404).json({ message: 'Funcionário não encontrado' });
      return res.json(decryptEmployeeRow(rows[0]));
    } catch (err) {
      console.error('Erro ao buscar funcionário:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao buscar funcionário', ...buildErrorResponse(err) });
    }
  },

  async create(req, res) {
    const db = getPool(req);
    const { name, email, phone, hire_date, base_salary, password, role } = req.body;

    try {
      // Checa duplicidade de e-mail
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ message: 'E-mail é obrigatório' });
      }
      const normalizedPhone = normalizePhoneBR(phone);
      const emailHash = hmacSha256Hex(normalizedEmail);
      const phoneHash = normalizedPhone ? hmacSha256Hex(normalizedPhone) : null;
      const emailEnc = encryptString(normalizedEmail);
      const phoneEnc = normalizedPhone ? encryptString(normalizedPhone) : null;

      const emailCheck = await db.query('SELECT id FROM employees WHERE email_hash = $1 LIMIT 1', [emailHash]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ message: 'E-mail já cadastrado' });
      }

      const hashedPassword = bcrypt.hashSync(password, 8);

      const { rows: userRows } = await db.query(
        'INSERT INTO users (email, email_enc, email_hash, password_hash, role) VALUES (NULL, $1, $2, $3, $4) RETURNING id, email, email_enc, role',
        [emailEnc, emailHash, hashedPassword, role || 'employee']
      );
      const user = userRows[0];

      const { rows } = await db.query(
        'INSERT INTO employees (user_id, name, email, phone, email_enc, email_hash, phone_enc, phone_hash, hire_date, base_salary, status) VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [user.id, name, emailEnc, emailHash, phoneEnc, phoneHash, hire_date, base_salary, 'active']
      );

      // Enviar notificação WhatsApp para gerentes/donos
      try {
        const whatsappService = (await import('../services/whatsappNotificationService.js')).default;
        await whatsappService.sendSystemChangeNotification(
          'employee_created',
          {
            name,
            email: normalizedEmail,
            phone: normalizedPhone || 'Não informado',
            role,
            hire_date: hire_date || 'Não informada',
          },
          `Funcionário: ${name}`
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de novo funcionário:', notificationError);
      }

      return res.status(201).json(decryptEmployeeRow(rows[0]));
    } catch (err) {
      console.error('Erro ao criar funcionário:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao criar funcionário', ...buildErrorResponse(err) });
    }
  },

  async update(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { name, email, phone, hire_date, base_salary, status } = req.body;

    try {
      // Buscar dados atuais para comparação
      const currentResult = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
      const currentRow = currentResult.rows[0];
      const currentEmployee = decryptEmployeeRow(currentRow);

      if (!currentEmployee) {
        return res.status(404).json({ message: 'Funcionário não encontrado' });
      }

      const normalizedEmail = normalizeEmail(email) || null;
      const normalizedPhone = normalizePhoneBR(phone) || null;

      const emailHash = normalizedEmail ? hmacSha256Hex(normalizedEmail) : (currentRow?.email_hash || null);
      const phoneHash = normalizedPhone ? hmacSha256Hex(normalizedPhone) : (currentRow?.phone_hash || null);
      const emailEnc = normalizedEmail ? encryptString(normalizedEmail) : (currentRow?.email_enc || null);
      const phoneEnc = normalizedPhone ? encryptString(normalizedPhone) : (currentRow?.phone_enc || null);

      // Se o e-mail mudou, valida duplicidade
      if (emailHash && normalizedEmail && normalizedEmail !== currentEmployee.email) {
        const dup = await db.query('SELECT id FROM employees WHERE email_hash = $1 AND id != $2 LIMIT 1', [emailHash, id]);
        if (dup.rows.length) {
          return res.status(409).json({ message: 'E-mail já cadastrado' });
        }
      }

      const { rows } = await db.query(
        'UPDATE employees SET name=$1, email=NULL, phone=NULL, email_enc=$2, email_hash=$3, phone_enc=$4, phone_hash=$5, hire_date=$6, base_salary=$7, status=$8, updated_at=NOW() WHERE id=$9 RETURNING *',
        [name, emailEnc, emailHash, phoneEnc, phoneHash, hire_date, base_salary, status, id]
      );

      // Mantém tabela users sincronizada para login
      const userId = rows[0]?.user_id;
      if (userId && emailEnc && emailHash) {
        await db.query('UPDATE users SET email=NULL, email_enc=$1, email_hash=$2 WHERE id=$3', [emailEnc, emailHash, userId]);
      }

      const updatedEmployee = decryptEmployeeRow(rows[0]);

      // Enviar notificação WhatsApp para gerentes/donos sobre alterações
      try {
        const whatsappService = (await import('../services/whatsappNotificationService.js')).default;
        const changes = {};
        if (name && name !== currentEmployee.name) changes.name = name;
        if (updatedEmployee.email && updatedEmployee.email !== currentEmployee.email) changes.email = updatedEmployee.email;
        if (updatedEmployee.phone && updatedEmployee.phone !== currentEmployee.phone) changes.phone = updatedEmployee.phone;
        if (base_salary && base_salary !== currentEmployee.base_salary) changes.base_salary = base_salary;
        if (status && status !== currentEmployee.status) changes.status = status;

        if (Object.keys(changes).length > 0) {
          await whatsappService.sendSystemChangeNotification(
            'employee_updated',
            changes,
            `Funcionário: ${updatedEmployee.name}`
          );
        }
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de atualização de funcionário:', notificationError);
      }

      return res.json(updatedEmployee);
    } catch (err) {
      console.error('Erro ao atualizar funcionário:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao atualizar funcionário', ...buildErrorResponse(err) });
    }
  },

  async remove(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    try {
      // Verifica existência do funcionário e busca o usuário vinculado
      const empResult = await db.query('SELECT id, user_id FROM employees WHERE id = $1', [id]);
      const employee = empResult.rows[0];
      if (!employee) {
        return res.status(404).json({ message: 'Funcionário não encontrado' });
      }

      // Verifica referências em appointments para evitar violação de FK
      const { rows: apptCountRows } = await db.query(
        'SELECT COUNT(1) AS cnt FROM appointments WHERE employee_id = $1',
        [id]
      );
      const hasAppointments = Number(apptCountRows[0]?.cnt || 0) > 0;
      if (hasAppointments) {
        return res.status(409).json({
          message: 'Não é possível remover o funcionário: existem agendamentos vinculados',
          error: 'employee_has_appointments',
        });
      }

      // Remove funcionário
      await db.query('DELETE FROM employees WHERE id = $1', [id]);

      // Opcional: remove o usuário vinculado (se existir)
      if (employee.user_id) {
        await db.query('DELETE FROM users WHERE id = $1', [employee.user_id]);
      }

      return res.json({ message: 'Funcionário removido com sucesso' });
    } catch (err) {
      console.error('Erro ao remover funcionário:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao remover funcionário', ...buildErrorResponse(err) });
    }
  },

  async listSpecialties(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    if (req.user.role === 'employee' && req.user.id !== Number(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
      const { rows } = await db.query(
        `
          SELECT es.id, s.id as service_id, s.name, es.commission_rate
          FROM employee_specialties es
          JOIN services s ON es.service_id = s.id
          WHERE es.employee_id = $1
        `,
        [id]
      );
      return res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar especialidades:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao buscar especialidades', ...buildErrorResponse(err) });
    }
  },

  async addSpecialty(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { service_id, commission_rate } = req.body;

    try {
      // Checa duplicidade de especialidade
      const exists = await db.query(
        'SELECT id FROM employee_specialties WHERE employee_id = $1 AND service_id = $2',
        [id, service_id]
      );
      if (exists.rows.length > 0) {
        return res.status(409).json({ message: 'Especialidade já cadastrada para este funcionário' });
      }

      const { rows } = await db.query(
        'INSERT INTO employee_specialties (employee_id, service_id, commission_rate) VALUES ($1, $2, $3) RETURNING *',
        [id, service_id, commission_rate]
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Erro ao adicionar especialidade:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao adicionar especialidade', ...buildErrorResponse(err) });
    }
  },

  async updateSpecialty(req, res) {
    const db = getPool(req);
    const { id, specialtyId } = req.params;
    const { commission_rate } = req.body;

    try {
      const { rows } = await db.query(
        'UPDATE employee_specialties SET commission_rate=$1 WHERE id=$2 AND employee_id=$3 RETURNING *',
        [commission_rate, specialtyId, id]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Especialidade não encontrada' });
      return res.json(rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar especialidade:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao atualizar especialidade', ...buildErrorResponse(err) });
    }
  },

  async removeSpecialty(req, res) {
    const db = getPool(req);
    const { id, specialtyId } = req.params;

    try {
      const { rowCount } = await db.query(
        'DELETE FROM employee_specialties WHERE id=$1 AND employee_id=$2',
        [specialtyId, id]
      );
      if (!rowCount) return res.status(404).json({ message: 'Especialidade não encontrada' });
      return res.json({ message: 'Especialidade removida com sucesso' });
    } catch (err) {
      console.error('Erro ao remover especialidade:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao remover especialidade', ...buildErrorResponse(err) });
    }
  },

  async performance(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    if (req.user.role === 'employee' && req.user.id !== Number(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
      const stats = await db.query(
        `
          SELECT COUNT(a.id) as total_services,
                 COALESCE(SUM(a.price), 0) as total_revenue,
                 COALESCE(SUM(a.commission_amount), 0) as total_commission
          FROM appointments a
          WHERE a.employee_id = $1 AND a.status = 'completed'
        `,
        [id]
      );
      return res.json(stats.rows[0]);
    } catch (err) {
      console.error('Erro ao buscar performance:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao buscar performance', ...buildErrorResponse(err) });
    }
  },

  async commissions(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    if (req.user.role === 'employee' && req.user.id !== Number(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
      const { rows } = await db.query(
        'SELECT * FROM employee_commissions WHERE employee_id = $1 ORDER BY pay_period_end DESC',
        [id]
      );
      return res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar comissões:', err);
      return res
        .status(500)
        .json({ message: 'Erro ao buscar comissões', ...buildErrorResponse(err) });
    }
  },

  async schedule(req, res) {
    const db = getPool(req);
    const { id } = req.params;

    if (req.user.role === 'employee' && req.user.id !== Number(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
      const { rows } = await db.query(
        'SELECT * FROM appointments WHERE employee_id = $1 ORDER BY appointment_date DESC, appointment_time DESC',
        [id]
      );
      return res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar agenda:', err);
      return res.status(500).json({ message: 'Erro ao buscar agenda', ...buildErrorResponse(err) });
    }
  },
};

export default EmployeeController;
