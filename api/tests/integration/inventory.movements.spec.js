import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Inventory movements and outputs', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let productId;
  let categoryId;

  beforeAll(async () => {
    // Create category and product
    const cat = await pool.query(
      `INSERT INTO product_categories (name, description) VALUES ($1, $2) RETURNING id`,
      ['Insumos', 'Insumos diversos']
    );
    categoryId = cat.rows[0].id;

    const prod = await pool.query(
      `INSERT INTO products (category_id, name, sku, cost_price, selling_price, current_stock, min_stock_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [categoryId, 'Produto Movimento', 'MOV-001', 10.00, 25.00, 50, 10]
    );
    productId = prod.rows[0].id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM inventory_outputs WHERE product_id = $1', [productId]);
      await pool.query('DELETE FROM inventory_movements WHERE product_id = $1', [productId]);
      await pool.query('DELETE FROM products WHERE id = $1', [productId]);
      await pool.query('DELETE FROM product_categories WHERE id = $1', [categoryId]);
    } catch {}
    await pool.end();
  });

  it('creates stock IN movement (manager)', async () => {
    const res = await axios.post(`${API}/inventory/movements`, {
      product_id: productId,
      movement_type: 'in',
      quantity: 20,
      notes: 'Reposição de estoque'
    }, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.product_id).toBe(productId);
    expect(res.data.movement_type).toBe('in');
    expect(parseInt(res.data.quantity)).toBe(20);
  });

  it('creates stock OUT movement (manager)', async () => {
    const res = await axios.post(`${API}/inventory/movements`, {
      product_id: productId,
      movement_type: 'out',
      quantity: 15,
      notes: 'Uso em serviço'
    }, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.movement_type).toBe('out');
  });

  it('lists inventory movements (owner)', async () => {
    const res = await axios.get(`${API}/inventory/movements`, ownerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('gets product movement history (manager)', async () => {
    const res = await axios.get(`${API}/inventory/${productId}/history`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('records movement even if quantity exceeds current stock (manager)', async () => {
    const res = await axios.post(`${API}/inventory/movements`, {
      product_id: productId,
      movement_type: 'out',
      quantity: 100,
      notes: 'Saída grande registrada'
    }, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.movement_type).toBe('out');
  });

  it('gets promotion suggestions (owner)', async () => {
    // Create overstock situation
    await pool.query(
      `UPDATE products SET current_stock = 100, max_stock_level = 50 WHERE id = $1`,
      [productId]
    );

    const res = await axios.get(`${API}/inventory/promotions-suggestions`, ownerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.some(s => s.id === productId)).toBe(true);
  });

  it('creates inventory output (manager)', async () => {
    const res = await axios.post(`${API}/inventory/outputs`, {
      product_id: productId,
      quantity: 5,
      output_type: 'other',
      notes: 'Usado em atendimento'
    }, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.message).toBeDefined();
    expect(res.data.output).toBeDefined();
  });

  it('lists inventory outputs with filters (owner)', async () => {
    const res = await axios.get(
      `${API}/inventory/outputs?product_id=${productId}&output_type=other`,
      ownerHeader
    );
    expect(res.status).toBe(200);
    expect(res.data.outputs).toBeDefined();
    expect(res.data.pagination).toBeDefined();
  });
});
