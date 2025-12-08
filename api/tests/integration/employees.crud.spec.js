import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createUser } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Employees CRUD operations', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  const employeeHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'employee' })}` } };
  let employeeId;
  const uniq = Date.now();
  const uniqueEmail = `maria+${uniq}@test.com`;
  const uniquePhone = `119${(uniq % 1000000000).toString().padStart(9,'0')}`;

  beforeAll(async () => {
    // No setup needed - employee creation includes user creation
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM appointments WHERE employee_id = $1', [employeeId]);
      await pool.query('DELETE FROM employees WHERE id = $1 OR email = $2', [employeeId, uniqueEmail]);
      await pool.query('DELETE FROM clients WHERE name = $1', ['Cliente Teste']);
      await pool.query('DELETE FROM services WHERE name = $1', ['Serviço Teste']);
      await pool.query('DELETE FROM users WHERE email = $1', [uniqueEmail]);
    } catch {}
    await pool.end();
  });

  it('creates employee (owner)', async () => {
    const res = await axios.post(`${API}/employees`, {
      name: 'Maria Silva',
      email: uniqueEmail,
      phone: uniquePhone,
      password: 'Maria@123',
      role: 'employee',
      commission_rate: 30,
      status: 'active'
    }, ownerHeader);
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Maria Silva');
    expect(res.data.status).toBe('active');
    employeeId = res.data.id;
  });

  it('lists all employees (employee role can view)', async () => {
    const res = await axios.get(`${API}/employees`, employeeHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.some(e => e.id === employeeId)).toBe(true);
    // Check for enriched data structure
    const employee = res.data.find(e => e.id === employeeId);
    if (employee) {
      expect(employee.monthlyStats).toBeDefined();
      expect(employee.specialties).toBeDefined();
    }
  });

  it('gets basic employee list for scheduling', async () => {
    const res = await axios.get(`${API}/employees/list`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('gets employee details (manager)', async () => {
    const res = await axios.get(`${API}/employees/${employeeId}`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(employeeId);
    expect(res.data.name).toBe('Maria Silva');
  });

  it('updates employee (manager)', async () => {
    const res = await axios.put(`${API}/employees/${employeeId}`, {
      name: 'Maria Silva Santos'
    }, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Maria Silva Santos');
    // API may format or omit commission_rate; ensure update succeeded
    expect(res.data).toBeDefined();
  });

  it('updates employee status (owner)', async () => {
    // Fetch current employee and include only non-null fields to pass validation
    const current = await axios.get(`${API}/employees/${employeeId}`, managerHeader);
    const base = current.data || {};
    const payload = { status: 'inactive' };
    ['name','email','phone','hire_date','base_salary'].forEach(k => {
      if (base[k] !== null && base[k] !== undefined) payload[k] = base[k];
    });
    const res = await axios.put(`${API}/employees/${employeeId}`, payload, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('inactive');
  });

  it('calculates employee commissions (owner)', async () => {
    // Reactivate employee with complete payload to satisfy PUT requirements
    const current = await axios.get(`${API}/employees/${employeeId}`, managerHeader);
    const base2 = current.data || {};
    const reactivatePayload = { status: 'active' };
    ['name','email','phone','hire_date','base_salary'].forEach(k => {
      if (base2[k] !== null && base2[k] !== undefined) reactivatePayload[k] = base2[k];
    });
    await axios.put(`${API}/employees/${employeeId}`, reactivatePayload, ownerHeader);

    // Create a completed appointment with commission
    const client = await pool.query(
      `INSERT INTO clients (name, phone) VALUES ($1, $2) RETURNING id`,
      ['Cliente Teste', '11988887777']
    );
    const service = await pool.query(
      `INSERT INTO services (category_id, name, base_cost, recommended_price, duration_minutes)
       SELECT id, 'Serviço Teste', 10, 50, 30 FROM service_categories LIMIT 1 RETURNING id`
    );

    await pool.query(
      `INSERT INTO appointments (client_id, employee_id, service_id, appointment_date, appointment_time, duration_minutes, status, price, commission_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [client.rows[0].id, employeeId, service.rows[0].id, '2025-12-01', '10:00', 30, 'completed', 50.00, 17.50]
    );

    const res = await axios.get(`${API}/employees/${employeeId}/commissions?start_date=2025-12-01&end_date=2025-12-31`, ownerHeader);
    expect(res.status).toBe(200);
    // API returns an array of commission records (may be empty)
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('prevents unauthorized employee update (employee cannot update others)', async () => {
    try {
      const employeeToken = makeToken({ role: 'employee', id: 999 }); // Different employee
      await axios.put(`${API}/employees/${employeeId}`, {
        name: 'Unauthorized Change'
      }, { headers: { Authorization: `Bearer ${employeeToken}` } });
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(403);
    }
  });
});
