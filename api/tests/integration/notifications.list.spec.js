import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Notifications listing includes employees without status', () => {
  const pool = makePool();
  let employeeId;
  const authHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };

  beforeAll(async () => {
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id`,
      ['notify@test.com', 'hash', 'employee']
    );
    const userId = userRows[0].id;
    const { rows: empRows } = await pool.query(
      `INSERT INTO employees (user_id, name, email, phone, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [userId, 'Notificado', 'notify@test.com', '77981365540', null]
    );
    employeeId = empRows[0].id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM employee_notifications WHERE employee_id = $1', [employeeId]);
      await pool.query('DELETE FROM employees WHERE id = $1', [employeeId]);
      await pool.query("DELETE FROM users WHERE email = 'notify@test.com'");
    } catch {}
    await pool.end();
  });

  it('GET /notifications/employees should include this employee with default types created', async () => {
    const res = await axios.get(`${API}/notifications/employees`, authHeader);
    expect(res.status).toBe(200);
    const found = res.data.data.find(e => e.employee_id === employeeId);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.notification_types)).toBe(true);
    expect(found.notification_types.length).toBeGreaterThan(0);
  });

  it('GET /notifications/employee/:id should return default settings when none exist', async () => {
    const res = await axios.get(`${API}/notifications/employee/${employeeId}`, authHeader);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data.notification_types)).toBe(true);
  });
});
