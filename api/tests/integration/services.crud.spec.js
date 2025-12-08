import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { ensureServiceCategory } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Services CRUD operations', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  const employeeHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'employee' })}` } };
  let categoryId;
  let serviceId;

  beforeAll(async () => {
    const cat = await ensureServiceCategory(pool, { name: 'Cabelo', description: 'Serviços de cabelo' });
    categoryId = cat.id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM service_specialties WHERE service_id IN (SELECT id FROM services WHERE category_id = $1)', [categoryId]);
      await pool.query('DELETE FROM appointments WHERE service_id IN (SELECT id FROM services WHERE category_id = $1)', [categoryId]);
      await pool.query('DELETE FROM services WHERE category_id = $1', [categoryId]);
      await pool.query('DELETE FROM employees WHERE email LIKE $1', ['%@test.com']);
      await pool.query('DELETE FROM clients WHERE phone LIKE $1', ['119%']);
      await pool.query('DELETE FROM service_categories WHERE id = $1', [categoryId]);
    } catch {}
    await pool.end();
  });

  it('creates a service (owner)', async () => {
    const res = await axios.post(`${API}/services`, {
      category_id: categoryId,
      name: 'Corte Feminino',
      description: 'Corte de cabelo feminino',
      base_cost: 10.00,
      recommended_price: 30.00,
      profit_margin: 200,
      duration_minutes: 45
    }, ownerHeader);
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Corte Feminino');
    expect(res.data.recommended_price).toBeDefined();
    serviceId = res.data.id;
  });

  it('lists all services (employee)', async () => {
    const res = await axios.get(`${API}/services`, employeeHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.some(s => s.id === serviceId)).toBe(true);
  });

  it('gets service by id (manager)', async () => {
    const res = await axios.get(`${API}/services/${serviceId}`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(serviceId);
    expect(res.data.name).toBe('Corte Feminino');
  });

  it('searches services by name (employee)', async () => {
    const res = await axios.get(`${API}/services/search/by-name?name=Corte`, employeeHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.some(s => s.name.includes('Corte'))).toBe(true);
  });

  it('updates service (manager)', async () => {
    // Get current service data first
    const current = await axios.get(`${API}/services/${serviceId}`, managerHeader);
    
    const res = await axios.put(`${API}/services/${serviceId}`, {
      name: 'Corte Feminino Premium',
      description: current.data.description,
      base_cost: 15.00,
      recommended_price: 45.00,
      profit_margin: 250,
      duration_minutes: current.data.duration_minutes,
      // API getServiceById does not return category_id (only category_name).
      // Use the known categoryId to avoid nulling the foreign key on update.
      category_id: categoryId,
      is_active: current.data.is_active
    }, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Corte Feminino Premium');
  });

  it('adds service specialty (owner)', async () => {
    // Create employee first
    const unique = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO employees (name, email, phone, status) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['João Especialista', `joao${unique}@test.com`, '11999999999', 'active']
    );
    const employeeId = rows[0].id;

    const res = await axios.post(`${API}/services/${serviceId}/specialties`, {
      employee_id: employeeId,
      commission_rate: 30
    }, ownerHeader);
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
  });

  it('lists service specialties (manager)', async () => {
    const res = await axios.get(`${API}/services/${serviceId}/specialties`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('prevents deleting service with appointments', async () => {
    // Create client and employee
    const client = await pool.query(
      `INSERT INTO clients (name, phone) VALUES ($1, $2) RETURNING id`,
      ['Cliente Teste', '11988888888']
    );
    const unique = Date.now();
    const emp = await pool.query(
      `INSERT INTO employees (name, email, phone, status) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Funcionário Teste', `func${unique}@test.com`, '11977777777', 'active']
    );

    // Create appointment
    await pool.query(
      `INSERT INTO appointments (client_id, employee_id, service_id, appointment_date, appointment_time, duration_minutes, status, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [client.rows[0].id, emp.rows[0].id, serviceId, '2025-12-15', '10:00', 45, 'scheduled', 50.00]
    );

    try {
      await axios.delete(`${API}/services/${serviceId}`, ownerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(409);
      expect(err.response.data.message).toContain('agendamentos');
    }
  });

  it('inactivates service (owner)', async () => {
    // Try direct fetch by id; fallback to list to locate the service
    let current;
    try {
      const byId = await axios.get(`${API}/services/${serviceId}`, managerHeader);
      current = byId.data;
    } catch (e) {
      const list = await axios.get(`${API}/services`, managerHeader);
      current = list.data.find(s => String(s.id) === String(serviceId));
    }
    expect(current).toBeDefined();

    const res = await axios.put(`${API}/services/${serviceId}`, {
      name: current.name,
      description: current.description,
      base_cost: current.base_cost,
      recommended_price: current.recommended_price,
      duration_minutes: current.duration_minutes,
      profit_margin: current.profit_margin,
      // Ensure we keep the category relation; the list/by-id response doesn't include category_id
      category_id: categoryId,
      is_active: false
    }, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.is_active).toBe(false);
  });
});
