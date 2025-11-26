import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { truncateTables } from '../helpers/cleanup.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Inventory basic flows', () => {
  const pool = makePool();
  let ownerHeader; let managerHeader; let employeeHeader;
  let ownerUserId; let managerUserId; let employeeUserId;
  let productId;
  let outputId;

  beforeAll(async () => {
    // Função auxiliar que garante id sem violar unique(email)
    async function ensureUser(email, role) {
      const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
      if (existing.rows.length) return existing.rows[0].id;
      const inserted = await pool.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [email, 'hash', role]);
      return inserted.rows[0].id;
    }
    ownerUserId = await ensureUser('inv-owner@test.com','owner');
    managerUserId = await ensureUser('inv-manager@test.com','manager');
    employeeUserId = await ensureUser('inv-employee@test.com','employee');

    ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ id: ownerUserId, role: 'owner' })}` } };
    managerHeader = { headers: { Authorization: `Bearer ${makeToken({ id: managerUserId, role: 'manager' })}` } };
    employeeHeader = { headers: { Authorization: `Bearer ${makeToken({ id: employeeUserId, role: 'employee' })}` } };

    // Seed one product
    const { rows } = await pool.query(`
      INSERT INTO product_categories (name) VALUES ($1) RETURNING id
    `,['TestCatInv']);
    const catId = rows[0].id;
    const prod = await pool.query(`
      INSERT INTO products (category_id, name, sku, current_stock, min_stock_level, max_stock_level, cost_price, selling_price, is_active)
      VALUES ($1,'Produto Teste','SKU1',5,3,50,10,25,true) RETURNING id
    `,[catId]);
    productId = prod.rows[0].id;
  });

  afterAll(async () => {
    // Limpa apenas o que criamos; usuários mantidos para outros testes que possam reutilizar.
    await truncateTables(pool, ['stock_movements','products','product_categories']);
    await pool.end();
  });

  it('lists inventory (employee allowed)', async () => {
    const res = await axios.get(`${API}/inventory?page=1&limit=10`, employeeHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.products)).toBe(true);
  });

  it('retrieves low-stock list (employee allowed)', async () => {
    const res = await axios.get(`${API}/inventory/low-stock`, employeeHeader);
    expect(res.status).toBe(200);
    // Our product stock=5 min=3 may not be low but ensure array shape
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('creates a stock movement IN (manager)', async () => {
    const payload = { product_id: productId, movement_type: 'in', quantity: 3, reference_type: 'manual', notes: 'reposicao teste' };
    const res = await axios.post(`${API}/inventory/movements`, payload, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.product_id).toBe(productId);
    expect(res.data.movement_type).toBe('in');
    expect(res.data.registered_by).toBe(managerUserId);
    expect(res.data.reference_type).toBe('manual');
  });

  it('creates an output (owner)', async () => {
    const payload = { product_id: productId, quantity: 2, output_type: 'other', reason: 'Teste saída' };
    const res = await axios.post(`${API}/inventory/outputs`, payload, ownerHeader);
    expect(res.status).toBe(201);
    expect(res.data.output).toBeDefined();
    expect(res.data.output.registered_by).toBe(ownerUserId);
    outputId = res.data.output.id;
  });

  it('updates output (owner)', async () => {
    const res = await axios.put(`${API}/inventory/outputs/${outputId}`, { quantity: 1, notes: 'ajuste' }, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.output.quantity).toBe(1);
  });

  it('deletes output (owner)', async () => {
    const res = await axios.delete(`${API}/inventory/outputs/${outputId}`, ownerHeader);
    expect(res.status).toBe(200);
    outputId = null;
  });

  it('restocks product (manager)', async () => {
    const payload = { quantity: 4 };
    const res = await axios.post(`${API}/inventory/${productId}/restock`, payload, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.movement).toBeDefined();
  });
});
