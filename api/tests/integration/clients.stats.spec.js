import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createEmployee, ensureServiceCategory, createService, createAppointment, createClient } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Clients stats and lifecycle', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let clientId; let employeeId; let serviceId; let appointmentId;

  beforeAll(async () => {
    const emp = await createEmployee(pool, { email: 'cli-emp@test.com' });
    employeeId = emp.id;
    const cat = await ensureServiceCategory(pool, { name: 'ClientesCat' });
    const svc = await createService(pool, { category_id: cat.id, recommended_price: 60, duration_minutes: 30 });
    serviceId = svc.id;
    const client = await createClient(pool, { name: 'Cliente Stats', phone: '77981365540' });
    clientId = client.id;
    const appt = await createAppointment(pool, { client_id: clientId, employee_id: employeeId, service_id: serviceId, appointment_time: '14:00' });
    appointmentId = appt.id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM appointments WHERE id = $1', [appointmentId]);
      await pool.query('DELETE FROM clients WHERE id = $1', [clientId]);
      await pool.query('DELETE FROM services WHERE id = $1', [serviceId]);
      await pool.query('DELETE FROM service_categories WHERE name = $1', ['ClientesCat']);
      await pool.query('DELETE FROM employees WHERE id = $1', [employeeId]);
    } catch {}
    await pool.end();
  });

  it('lists clients (manager)', async () => {
    const res = await axios.get(`${API}/clients?page=1&limit=10`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.clients || Array.isArray(res.data)).toBeTruthy();
  });

  it('fetches client stats (manager)', async () => {
    const res = await axios.get(`${API}/clients/stats`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.stats).toBeDefined();
    expect(res.data.top_clients).toBeDefined();
  });

  it('completes appointment to affect client metrics', async () => {
    const completeRes = await axios.post(`${API}/scheduling/${appointmentId}/complete`, {}, ownerHeader);
    expect(completeRes.status).toBe(200);
    expect(completeRes.data.status).toBe('completed');
    const clientRow = await pool.query('SELECT total_visits, total_spent FROM clients WHERE id = $1',[clientId]);
    expect(Number(clientRow.rows[0].total_visits)).toBeGreaterThan(0);
    expect(Number(clientRow.rows[0].total_spent)).toBeGreaterThan(0);
  });
});
