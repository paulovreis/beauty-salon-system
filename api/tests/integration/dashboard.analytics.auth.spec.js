import axios from 'axios';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Dashboard analytics + authorization matrix', () => {
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  const employeeHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'employee' })}` } };

  it('allows owner to access expense-breakdown', async () => {
    const res = await axios.get(`${API}/dashboard/expense-breakdown`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.by_category || res.data.data || res.data).toBeDefined();
  });

  it('blocks employee from expense-breakdown', async () => {
    const res = await axios.get(`${API}/dashboard/expense-breakdown`, employeeHeader).catch(e => e.response);
    expect(res.status).toBe(403);
  });

  it('manager can access revenue-analysis', async () => {
    const res = await axios.get(`${API}/dashboard/revenue-analysis`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.monthlyRevenue).toBeDefined();
  });

  it('employee blocked from inventory-analysis', async () => {
    const res = await axios.get(`${API}/dashboard/inventory-analysis`, employeeHeader).catch(e => e.response);
    expect(res.status).toBe(403);
  });

  it('owner can access customer-analysis', async () => {
    const res = await axios.get(`${API}/dashboard/customer-analysis`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.topCustomers || res.data.top_customers || res.data).toBeDefined();
  });
});
