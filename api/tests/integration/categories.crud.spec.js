import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Product and Service Categories CRUD', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let productCategoryId;
  let serviceCategoryId;

  afterAll(async () => {
    try {
      await pool.query("DELETE FROM product_categories WHERE name LIKE 'Coloração%'");
      await pool.query("DELETE FROM service_categories WHERE name LIKE 'Manicure%'");
    } catch {}
    await pool.end();
  });

  // Product Categories
  it('creates product category (owner)', async () => {
    const res = await axios.post(`${API}/products/categories`, {
      name: 'Coloração',
      description: 'Produtos para coloração'
    }, ownerHeader);
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Coloração');
    productCategoryId = res.data.id;
  });

  it('lists product categories (manager)', async () => {
    const res = await axios.get(`${API}/products/categories`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.some(c => c.id === productCategoryId)).toBe(true);
  });

  it('prevents duplicate product category name', async () => {
    try {
      await axios.post(`${API}/products/categories`, {
        name: 'Coloração', // Same name
        description: 'Outra descrição'
      }, ownerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(409);
      const msg = String(err.response.data.message || '').toLowerCase();
      expect(msg).toContain('já existe');
    }
  });

  it('updates product category (owner)', async () => {
    const res = await axios.put(`${API}/products/categories/${productCategoryId}`, {
      name: 'Coloração Premium',
      description: 'Produtos premium para coloração'
    }, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Coloração Premium');
  });

  it('deletes product category (owner)', async () => {
    const res = await axios.delete(`${API}/products/categories/${productCategoryId}`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.message).toContain('sucesso');
  });

  // Service Categories
  it('creates service category (manager)', async () => {
    const res = await axios.post(`${API}/services/categories`, {
      name: 'Manicure',
      description: 'Serviços de manicure'
    }, managerHeader);
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Manicure');
    serviceCategoryId = res.data.id;
  });

  it('lists service categories (manager)', async () => {
    const res = await axios.get(`${API}/services/categories`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.some(c => c.id === serviceCategoryId)).toBe(true);
  });

  it('prevents duplicate service category name', async () => {
    try {
      await axios.post(`${API}/services/categories`, {
        name: 'manicure', // Case insensitive
        description: 'Outra descrição'
      }, managerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(409);
    }
  });

  it('updates service category (owner)', async () => {
    const res = await axios.put(`${API}/services/categories/${serviceCategoryId}`, {
      name: 'Manicure e Pedicure',
      description: 'Serviços completos'
    }, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Manicure e Pedicure');
  });

  it('deletes service category (owner)', async () => {
    const res = await axios.delete(`${API}/services/categories/${serviceCategoryId}`, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.message).toContain('sucesso');
  });
});
