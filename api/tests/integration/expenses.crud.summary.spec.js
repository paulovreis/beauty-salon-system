import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createExpense } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Expenses CRUD + Summary', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let createdId;

  afterAll(async () => {
    try {
      if (createdId) await pool.query('DELETE FROM expenses WHERE id = $1', [createdId]);
    } catch {}
    await pool.end();
  });

  it('creates an expense (owner)', async () => {
    const payload = {
      category: 'Materiais',
      description: 'Compra de produtos',
      amount: 120.75,
      expense_date: new Date().toISOString().slice(0,10),
      payment_method: 'credit',
      notes: 'Teste criação'
    };
    const res = await axios.post(`${API}/expenses`, payload, ownerHeader);
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    createdId = res.data.id;
  });

  it('lists expenses (manager)', async () => {
    const res = await axios.get(`${API}/expenses?page=1&limit=10`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.expenses)).toBe(true);
    expect(res.data.pagination).toBeDefined();
  });

  it('updates expense (owner)', async () => {
    const res = await axios.put(`${API}/expenses/${createdId}`, { notes: 'Atualizado', amount: 130.50 }, ownerHeader);
    expect(res.status).toBe(200);
    expect(Number(res.data.amount)).toBeCloseTo(130.50, 2);
  });

  it('gets expense summary (manager)', async () => {
    const res = await axios.get(`${API}/expenses/summary`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.total).toBeDefined();
    expect(res.data.by_category).toBeDefined();
  });

  it('deletes expense (owner)', async () => {
    const res = await axios.delete(`${API}/expenses/${createdId}`, ownerHeader);
    expect(res.status).toBe(200);
    createdId = null;
  });
});
