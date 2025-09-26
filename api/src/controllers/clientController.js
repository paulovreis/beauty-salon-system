import pool from "../db/postgre.js";

class ClientController {
  async list(req, res) {
    try {
      const { q } = req.query;
      if (q) {
        const { rows } = await pool.query(
          `SELECT id, name, phone FROM clients WHERE unaccent(lower(name)) LIKE unaccent(lower($1)) OR phone LIKE $2 ORDER BY name LIMIT 20`,
          [`%${q}%`, `%${q}%`]
        );
        return res.json(rows);
      }
      const { rows } = await pool.query(`SELECT id, name, phone FROM clients ORDER BY name LIMIT 100`);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao listar clientes', error: err.message });
    }
  }

  async create(req, res) {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });
    try {
      const existing = await pool.query(`SELECT id FROM clients WHERE phone = $1 LIMIT 1`, [phone]);
      if (existing.rows.length) return res.status(409).json({ message: 'Cliente já existe com este telefone', id: existing.rows[0].id });
      const { rows } = await pool.query(`INSERT INTO clients (name, phone, first_visit, last_visit) VALUES ($1,$2,CURRENT_DATE,CURRENT_DATE) RETURNING id, name, phone`, [name, phone]);
      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: 'Erro ao criar cliente', error: err.message });
    }
  }
}

export default new ClientController();
