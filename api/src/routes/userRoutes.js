import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import pool from '../db/postgre.js';
import { decryptString } from '../utils/fieldCrypto.js';

const router = express.Router();

// Rota para o owner listar todos os usuários e suas roles
router.get('/', authenticateJWT, roleMiddleware(['owner']), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, email_enc, role FROM users ORDER BY id');
    res.json(rows.map((u) => ({
      id: u.id,
      email: u.email_enc ? decryptString(u.email_enc) : u.email,
      role: u.role,
    })));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar usuários', error: err.message });
  }
});

// Rota para o owner atualizar a role de um usuário
router.put('/:id/role', authenticateJWT, roleMiddleware(['owner']), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const validRoles = ['owner', 'manager', 'employee'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Role inválida' });
  }
  try {
    const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, email_enc, role', [role, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email_enc ? decryptString(u.email_enc) : u.email,
      role: u.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar role', error: err.message });
  }
});

export default router;
