import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createEmployee } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Notification settings defaults + update', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  let emp1; let emp2;

  beforeAll(async () => {
    emp1 = await createEmployee(pool, { email: 'notif1@test.com', name: 'Emp Notif 1' });
    emp2 = await createEmployee(pool, { email: 'notif2@test.com', name: 'Emp Notif 2' });
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM employee_notifications WHERE employee_id IN ($1,$2)', [emp1.id, emp2.id]);
      await pool.query('DELETE FROM employees WHERE id IN ($1,$2)', [emp1.id, emp2.id]);
    } catch {}
    await pool.end();
  });

  it('creates default settings when none exist (emp1)', async () => {
    const res = await axios.get(`${API}/notifications/employee/${emp1.id}`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data.notification_types)).toBe(true);
    expect(res.data.data.notification_types.length).toBeGreaterThan(0);
  });

  it('updates settings with aliases and drops invalid (emp1)', async () => {
    const payload = { notification_types: ['dailyClients','newAppointment','invalidType'], enabled: true };
    const res = await axios.put(`${API}/notifications/employee/${emp1.id}`, payload, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it('lists all employees settings (owner)', async () => {
    // Trigger default creation for second employee automatically
    await axios.get(`${API}/notifications/employee/${emp2.id}`, ownerHeader);
    const res = await axios.get(`${API}/notifications/employees`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    const found1 = res.data.data.find(r => r.employee_id === emp1.id);
    const found2 = res.data.data.find(r => r.employee_id === emp2.id);
    expect(found1).toBeTruthy();
    expect(found2).toBeTruthy();
  });
});
