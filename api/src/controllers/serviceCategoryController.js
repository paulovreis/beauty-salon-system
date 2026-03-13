import pool from '../db/postgre.js';
import buildErrorResponse from '../utils/errorResponse.js';

const getPool = (req) => req.pool || pool;

class ServiceCategoryController {
  async list(req, res) {
    const db = getPool(req);
    try {
      const { rows } = await db.query('SELECT * FROM service_categories ORDER BY name');
      res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      res.status(500).json({ message: 'Erro ao buscar categorias', ...buildErrorResponse(err) });
    }
  }

  async create(req, res) {
    const { name, description } = req.body;
    const db = getPool(req);
    try {
      const exists = await db.query('SELECT id FROM service_categories WHERE LOWER(name) = LOWER($1)', [name]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ message: 'Já existe uma categoria com este nome' });
      }
      const { rows } = await db.query('INSERT INTO service_categories (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Erro ao criar categoria:', err);
      res.status(500).json({ message: 'Erro ao criar categoria', ...buildErrorResponse(err) });
    }
  }

  async update(req, res) {
    const { id } = req.params;
    const { name, description } = req.body;
    const db = getPool(req);
    try {
      const current = await db.query('SELECT * FROM service_categories WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({ message: 'Categoria não encontrada' });
      }
      if (name && name !== current.rows[0].name) {
        const exists = await db.query('SELECT id FROM service_categories WHERE LOWER(name) = LOWER($1) AND id <> $2', [name, id]);
        if (exists.rows.length > 0) {
          return res.status(409).json({ message: 'Já existe uma categoria com este nome' });
        }
      }
      const updated = {
        name: name ?? current.rows[0].name,
        description: description ?? current.rows[0].description
      };
      const { rows } = await db.query('UPDATE service_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *', [updated.name, updated.description, id]);
      res.json(rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err);
      res.status(500).json({ message: 'Erro ao atualizar categoria', ...buildErrorResponse(err) });
    }
  }

  async remove(req, res) {
    const { id } = req.params;
    const db = getPool(req);
    try {
      const { rowCount } = await db.query('DELETE FROM service_categories WHERE id = $1', [id]);
      if (rowCount === 0) {
        return res.status(404).json({ message: 'Categoria não encontrada' });
      }
      res.json({ message: 'Categoria removida com sucesso' });
    } catch (err) {
      console.error('Erro ao remover categoria:', err);
      res.status(500).json({ message: 'Erro ao remover categoria', ...buildErrorResponse(err) });
    }
  }
}

export default new ServiceCategoryController();
