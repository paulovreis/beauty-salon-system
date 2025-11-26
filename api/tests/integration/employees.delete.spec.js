import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Employees deletion behavior', () => {
  const pool = makePool();
  let ids = {};
  const authHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };

  beforeAll(async () => {
    // Ensure base tables exist (server should have run init-db already)
    // Create required entities directly in DB
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id`,
      ['emp@test.com', 'hash', 'employee']
    );
    ids.userId = userRows[0].id;

    const { rows: empRows } = await pool.query(
      `INSERT INTO employees (user_id, name, email, phone, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [ids.userId, 'Funcionario Teste', 'emp@test.com', '77981365540', 'active']
    );
    ids.employeeId = empRows[0].id;

    // Garantir categoria de serviço (tabela não possui UNIQUE em name, então fazemos lookup manual)
    const existingCat = await pool.query(`SELECT id FROM service_categories WHERE name = $1`, ['Cortes']);
    if (existingCat.rows[0]) {
      ids.serviceCategoryId = existingCat.rows[0].id;
    } else {
      const insertedCat = await pool.query(
        `INSERT INTO service_categories (name, description) VALUES ($1,$2) RETURNING id`,
        ['Cortes','Categoria de teste']
      );
      ids.serviceCategoryId = insertedCat.rows[0].id;
    }

    const { rows: serviceRows } = await pool.query(
      `INSERT INTO services (category_id, name, base_cost, recommended_price, duration_minutes, is_active) VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
      [ids.serviceCategoryId, 'Corte', 10, 20, 30]
    );
    ids.serviceId = serviceRows[0].id;

    const { rows: clientRows } = await pool.query(
      `INSERT INTO clients (name, phone) VALUES ($1,$2) RETURNING id`,
      ['Cliente Teste', '11888887777']
    );
    ids.clientId = clientRows[0].id;

    await pool.query(
      `INSERT INTO appointments (client_id, employee_id, service_id, appointment_date, appointment_time, duration_minutes, status, price) 
       VALUES ($1,$2,$3,CURRENT_DATE, CURRENT_TIME, 30, 'scheduled', 20)`,
      [ids.clientId, ids.employeeId, ids.serviceId]
    );
  });

  afterAll(async () => {
    try {
      // Cleanup hard deletes (appointments and employee) if left over
      await pool.query('DELETE FROM appointments WHERE employee_id = $1', [ids.employeeId]);
      await pool.query('DELETE FROM employees WHERE id = $1', [ids.employeeId]);
      await pool.query('DELETE FROM users WHERE id = $1', [ids.userId]);
    } catch {}
    await pool.end();
  });

  it('should block deletion when appointments exist', async () => {
    const res = await axios.delete(`${API}/employees/${ids.employeeId}`, authHeader).catch(e => e.response);
    expect(res.status).toBe(409);
    expect(res.data?.error).toBe('employee_has_appointments');
  });

  it('should allow deletion after removing appointments', async () => {
    await pool.query('DELETE FROM appointments WHERE employee_id = $1', [ids.employeeId]);
    const res = await axios.delete(`${API}/employees/${ids.employeeId}`, authHeader);
    expect(res.status).toBe(200);
    expect(res.data?.message).toMatch(/removido com sucesso/i);
  });
});
