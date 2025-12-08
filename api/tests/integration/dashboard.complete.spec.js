import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createClient, createEmployee, ensureServiceCategory, createService, createAppointment, createExpense } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Dashboard complete statistics', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  const employeeHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'employee' })}` } };
  let clientId, employeeId, serviceId, categoryId, expenseId;

  beforeAll(async () => {
    const client = await createClient(pool);
    const emp = await createEmployee(pool);
    const cat = await ensureServiceCategory(pool);
    const svc = await createService(pool, { category_id: cat.id });
    
    clientId = client.id;
    employeeId = emp.id;
    serviceId = svc.id;
    categoryId = cat.id;

    // Create some appointments
    await createAppointment(pool, {
      client_id: clientId,
      employee_id: employeeId,
      service_id: serviceId,
      status: 'completed',
      price: 100.00
    });

    // Create expense
    const expense = await createExpense(pool, { amount: 50.00 });
    expenseId = expense.id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM appointments WHERE client_id = $1', [clientId]);
      await pool.query('DELETE FROM expenses WHERE id = $1', [expenseId]);
      await pool.query('DELETE FROM services WHERE id = $1', [serviceId]);
      await pool.query('DELETE FROM service_categories WHERE id = $1', [categoryId]);
      await pool.query('DELETE FROM employees WHERE id = $1', [employeeId]);
      await pool.query('DELETE FROM clients WHERE id = $1', [clientId]);
    } catch {}
    await pool.end();
  });

  it('gets dashboard stats (employee can access)', async () => {
    const res = await axios.get(`${API}/dashboard/stats`, employeeHeader);
    expect(res.status).toBe(200);
    expect(res.data.totalClients).toBeDefined();
    expect(res.data.totalEmployees).toBeDefined();
    expect(res.data.totalServices).toBeDefined();
    expect(res.data.totalAppointments).toBeDefined();
    expect(res.data.totalProducts).toBeDefined();
    expect(res.data.totalRevenue).toBeDefined();
    expect(res.data.monthlyStats).toBeDefined();
    expect(res.data.monthlyStats.completedAppointments).toBeDefined();
    expect(res.data.inventoryStats).toBeDefined();
  });

  it('gets recent appointments (manager)', async () => {
    const res = await axios.get(`${API}/dashboard/recent-appointments?limit=10`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('gets top employees (manager)', async () => {
    const res = await axios.get(`${API}/dashboard/top-employees?limit=5`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('blocks employee from top employees', async () => {
    try {
      await axios.get(`${API}/dashboard/top-employees`, employeeHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(403);
    }
  });

  it('gets revenue analysis (owner)', async () => {
    const res = await axios.get(`${API}/dashboard/revenue-analysis?period=month`, ownerHeader);
    expect(res.status).toBe(200);
    // API returns breakdown fields instead of total_revenue
    expect(res.data.monthlyRevenue).toBeDefined();
    expect(res.data.revenueByCategory).toBeDefined();
    expect(res.data.revenueByEmployee).toBeDefined();
  });

  it('gets service analysis (manager)', async () => {
    const res = await axios.get(`${API}/dashboard/service-analysis`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });

  it('gets customer analysis (owner)', async () => {
    const res = await axios.get(`${API}/dashboard/customer-analysis`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });

  it('gets financial analysis (manager)', async () => {
    const res = await axios.get(`${API}/dashboard/financial-analysis`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
  });
});
