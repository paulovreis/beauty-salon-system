import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createEmployee, ensureServiceCategory, createService, createClient } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Scheduling lifecycle: create -> confirm -> complete -> dashboard stats', () => {
  const pool = makePool();
  const authHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const ids = {};
  let createdAppointment;

  beforeAll(async () => {
    // Core entities
    ids.employee = await createEmployee(pool, {});
    ids.category = await ensureServiceCategory(pool, { name: 'LifecycleCat' });
    ids.service = await createService(pool, { category_id: ids.category.id, recommended_price: 75, duration_minutes: 30 });
    ids.client = await createClient(pool, {});
  });

  afterAll(async () => {
    try {
      if (createdAppointment?.id) {
        await pool.query('DELETE FROM appointments WHERE id = $1', [createdAppointment.id]);
      }
      await pool.query('DELETE FROM clients WHERE id = $1', [ids.client.id]);
      await pool.query('DELETE FROM services WHERE id = $1', [ids.service.id]);
      await pool.query('DELETE FROM service_categories WHERE id = $1', [ids.category.id]);
      await pool.query('DELETE FROM employees WHERE id = $1', [ids.employee.id]);
    } catch {}
    await pool.end();
  });

  it('creates a scheduling', async () => {
    const payload = {
      appointment_date: new Date().toISOString().slice(0,10),
      appointment_time: '11:00',
      client_id: ids.client.id,
      employee_id: ids.employee.id,
      service_id: ids.service.id,
      status: 'scheduled',
      notes: 'Teste ciclo'
    };
    const res = await axios.post(`${API}/scheduling`, payload, authHeader);
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('scheduled');
    createdAppointment = res.data;
  });

  it('confirms the scheduling', async () => {
    const res = await axios.post(`${API}/scheduling/${createdAppointment.id}/confirm`, {}, authHeader);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('confirmed');
  });

  it('completes the scheduling and updates client metrics', async () => {
    const res = await axios.post(`${API}/scheduling/${createdAppointment.id}/complete`, {}, authHeader);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('completed');

    // Check client metrics updated
    const client = await pool.query('SELECT total_visits, total_spent FROM clients WHERE id = $1', [ids.client.id]);
    expect(Number(client.rows[0].total_visits)).toBeGreaterThanOrEqual(1);
    expect(Number(client.rows[0].total_spent)).toBeGreaterThan(0);
  });

  it('reflects in dashboard stats', async () => {
    const res = await axios.get(`${API}/dashboard/stats`, authHeader);
    expect(res.status).toBe(200);
    expect(res.data.monthlyStats.completedAppointments).toBeGreaterThanOrEqual(1);
    expect(res.data.totalRevenue).toBeGreaterThan(0);
  });
});
