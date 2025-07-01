import pool from "../db/postgre.js";

// Permite usar req.pool (injetado via middleware) ou pool padrão
const getPool = (req) => req.pool || pool;

const EmployeeController = {
  async list(req, res) {
    try {
      const db = getPool(req);
      const { rows } = await db.query("SELECT * FROM employees ORDER BY id");
      res.json(rows);
    } catch (err) {
      console.log("Erro ao buscar funcionários:", err);
      res.status(500).json({ message: "Erro ao buscar funcionários", error: err.message });
    }
  },

  async detail(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    if (req.user.role === "employee" && req.user.id !== Number(id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const { rows } = await db.query(
        "SELECT * FROM employees WHERE id = $1",
        [id]
      );
      if (!rows[0]) return res.status(404).json({ message: "Funcionário não encontrado" });
      res.json(rows[0]);
    } catch (err) {
      console.log("Erro ao buscar funcionário:", err);
      res.status(500).json({ message: "Erro ao buscar funcionário", error: err.message });
    }
  },

  async create(req, res) {
    const db = getPool(req);
    const { name, email, phone, hire_date, base_salary } = req.body;
    try {
      // Checa duplicidade de e-mail
      const emailCheck = await db.query("SELECT id FROM employees WHERE email = $1", [email]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ message: "E-mail já cadastrado" });
      }
      const { rows } = await db.query(
        "INSERT INTO employees (name, email, phone, hire_date, base_salary, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [name, email, phone, hire_date, base_salary, "active"]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.log("Erro ao criar funcionário:", err);
      res.status(500).json({ message: "Erro ao criar funcionário", error: err.message });
    }
  },

  async update(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { name, email, phone, hire_date, base_salary, status } = req.body;
    try {
      const { rows } = await db.query(
        "UPDATE employees SET name=$1, email=$2, phone=$3, hire_date=$4, base_salary=$5, status=$6, updated_at=NOW() WHERE id=$7 RETURNING *",
        [name, email, phone, hire_date, base_salary, status, id]
      );
      if (!rows[0]) return res.status(404).json({ message: "Funcionário não encontrado" });
      res.json(rows[0]);
    } catch (err) {
      console.log("Erro ao atualizar funcionário:", err);
      res.status(500).json({ message: "Erro ao atualizar funcionário", error: err.message });
    }
  },

  async remove(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    try {
      const { rowCount } = await db.query(
        "DELETE FROM employees WHERE id = $1",
        [id]
      );
      if (!rowCount) return res.status(404).json({ message: "Funcionário não encontrado" });
      res.json({ message: "Funcionário removido com sucesso" });
    } catch (err) {
      console.log("Erro ao remover funcionário:", err);
      res.status(500).json({ message: "Erro ao remover funcionário", error: err.message });
    }
  },

  async listSpecialties(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    if (req.user.role === "employee" && req.user.id !== Number(id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const { rows } = await db.query(
        "SELECT es.id, s.id as service_id, s.name, es.commission_rate FROM employee_specialties es JOIN services s ON es.service_id = s.id WHERE es.employee_id = $1",
        [id]
      );
      res.json(rows);
    } catch (err) {
      console.log("Erro ao buscar especialidades:", err);
      res.status(500).json({ message: "Erro ao buscar especialidades", error: err.message });
    }
  },

  async addSpecialty(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    const { service_id, commission_rate } = req.body;
    try {
      // Checa duplicidade de especialidade
      const exists = await db.query(
        "SELECT id FROM employee_specialties WHERE employee_id = $1 AND service_id = $2",
        [id, service_id]
      );
      if (exists.rows.length > 0) {
        return res.status(409).json({ message: "Especialidade já cadastrada para este funcionário" });
      }
      const { rows } = await db.query(
        "INSERT INTO employee_specialties (employee_id, service_id, commission_rate) VALUES ($1, $2, $3) RETURNING *",
        [id, service_id, commission_rate]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.log("Erro ao adicionar especialidade:", err);
      res.status(500).json({ message: "Erro ao adicionar especialidade", error: err.message });
    }
  },

  async updateSpecialty(req, res) {
    const db = getPool(req);
    const { id, specialtyId } = req.params;
    const { commission_rate } = req.body;
    try {
      const { rows } = await db.query(
        "UPDATE employee_specialties SET commission_rate=$1 WHERE id=$2 AND employee_id=$3 RETURNING *",
        [commission_rate, specialtyId, id]
      );
      if (!rows[0]) return res.status(404).json({ message: "Especialidade não encontrada" });
      res.json(rows[0]);
    } catch (err) {
      console.log("Erro ao atualizar especialidade:", err);
      res.status(500).json({ message: "Erro ao atualizar especialidade", error: err.message });
    }
  },

  async removeSpecialty(req, res) {
    const db = getPool(req);
    const { id, specialtyId } = req.params;
    try {
      const { rowCount } = await db.query(
        "DELETE FROM employee_specialties WHERE id=$1 AND employee_id=$2",
        [specialtyId, id]
      );
      if (!rowCount) return res.status(404).json({ message: "Especialidade não encontrada" });
      res.json({ message: "Especialidade removida com sucesso" });
    } catch (err) {
      console.log("Erro ao remover especialidade:", err);
      res.status(500).json({ message: "Erro ao remover especialidade", error: err.message });
    }
  },

  async performance(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    if (req.user.role === "employee" && req.user.id !== Number(id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const stats = await db.query(
        `SELECT COUNT(a.id) as total_services, COALESCE(SUM(a.price),0) as total_revenue, COALESCE(SUM(a.commission_amount),0) as total_commission
                 FROM appointments a WHERE a.employee_id = $1 AND a.status IN ('completed', 'confirmed')`,
        [id]
      );
      res.json(stats.rows[0]);
    } catch (err) {
      console.log("Erro ao buscar performance:", err);
      res.status(500).json({ message: "Erro ao buscar performance", error: err.message });
    }
  },

  async commissions(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    if (req.user.role === "employee" && req.user.id !== Number(id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const { rows } = await db.query(
        "SELECT * FROM employee_commissions WHERE employee_id = $1 ORDER BY pay_period_end DESC",
        [id]
      );
      res.json(rows);
    } catch (err) {
      console.log("Erro ao buscar comissões:", err);
      res.status(500).json({ message: "Erro ao buscar comissões", error: err.message });
    }
  },

  async schedule(req, res) {
    const db = getPool(req);
    const { id } = req.params;
    if (req.user.role === "employee" && req.user.id !== Number(id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const { rows } = await db.query(
        "SELECT * FROM appointments WHERE employee_id = $1 ORDER BY appointment_date DESC, appointment_time DESC",
        [id]
      );
      res.json(rows);
    } catch (err) {
      console.log("Erro ao buscar agenda:", err);
      res.status(500).json({ message: "Erro ao buscar agenda", error: err.message });
    }
  },
};

export default EmployeeController;
