import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Clients CRUD operations', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let clientId1, clientId2;

  afterAll(async () => {
    try {
      if (clientId1) await pool.query('DELETE FROM clients WHERE id = $1', [clientId1]);
      if (clientId2) await pool.query('DELETE FROM clients WHERE id = $1', [clientId2]);
    } catch {}
    await pool.end();
  });

  it('creates a client with phone and email', async () => {
    const res = await axios.post(`${API}/clients`, {
      name: 'Test Client 1',
      phone: '11987654321',
      email: 'test1@example.com',
      address: 'Rua Teste 123'
    }, managerHeader);
    
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Test Client 1');
    expect(res.data.phone).toBe('11987654321');
    expect(res.data.email).toBe('test1@example.com');
    clientId1 = res.data.id;
  });

  it('prevents creating duplicate client with same phone', async () => {
    try {
      await axios.post(`${API}/clients`, {
        name: 'Test Client Duplicate',
        phone: '11987654321',
        email: 'other@example.com'
      }, managerHeader);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(409);
      expect(error.response.data.message).toContain('já existe');
    }
  });

  it('prevents creating duplicate client with same email', async () => {
    try {
      await axios.post(`${API}/clients`, {
        name: 'Test Client Duplicate Email',
        phone: '11999999999',
        email: 'test1@example.com'
      }, managerHeader);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(409);
      expect(error.response.data.message).toContain('já existe');
    }
  });

  it('updates client name keeping same phone and email', async () => {
    const res = await axios.put(`${API}/clients/${clientId1}`, {
      name: 'Test Client 1 Updated',
      phone: '11987654321',
      email: 'test1@example.com',
      address: 'Rua Teste 456'
    }, managerHeader);
    
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Test Client 1 Updated');
    expect(res.data.phone).toBe('11987654321');
    expect(res.data.email).toBe('test1@example.com');
    expect(res.data.address).toBe('Rua Teste 456');
  });

  it('updates client phone number', async () => {
    const newPhone = `11${Date.now().toString().slice(-8)}`;
    const res = await axios.put(`${API}/clients/${clientId1}`, {
      name: 'Test Client 1 Updated',
      phone: newPhone,
      email: 'test1@example.com',
      address: 'Rua Teste 456'
    }, managerHeader);
    
    expect(res.status).toBe(200);
    expect(res.data.phone).toBe(newPhone);
  });

  it('creates second client', async () => {
    const res = await axios.post(`${API}/clients`, {
      name: 'Test Client 2',
      phone: '11977777777',
      email: 'test2@example.com'
    }, managerHeader);
    
    expect(res.status).toBe(201);
    clientId2 = res.data.id;
  });

  it('prevents updating client with phone of another client', async () => {
    try {
      await axios.put(`${API}/clients/${clientId1}`, {
        name: 'Test Client 1 Updated',
        phone: '11977777777', // Phone from clientId2
        email: 'test1@example.com'
      }, managerHeader);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(409);
      expect(error.response.data.message).toContain('outro cliente');
    }
  });

  it('prevents updating client with email of another client', async () => {
    try {
      await axios.put(`${API}/clients/${clientId1}`, {
        name: 'Test Client 1 Updated',
        phone: '11988888888',
        email: 'test2@example.com' // Email from clientId2
      }, managerHeader);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(409);
      expect(error.response.data.message).toContain('outro cliente');
    }
  });

  it('allows updating client with null email', async () => {
    const phoneNoEmail = `11${(Date.now()+1).toString().slice(-8)}`;
    const res = await axios.put(`${API}/clients/${clientId1}`, {
      name: 'Test Client 1 No Email',
      phone: phoneNoEmail,
      email: null,
      address: 'Rua Teste 789'
    }, managerHeader);
    
    expect(res.status).toBe(200);
    expect(res.data.email).toBeNull();
  });

  it('allows creating client with only name and phone', async () => {
    const res = await axios.post(`${API}/clients`, {
      name: 'Test Client Minimal',
      phone: '11966666666'
    }, managerHeader);
    
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Test Client Minimal');
    expect(res.data.phone).toBe('11966666666');
    
    // Cleanup
    await pool.query('DELETE FROM clients WHERE id = $1', [res.data.id]);
  });

  it('deletes client (owner only)', async () => {
    const res = await axios.delete(`${API}/clients/${clientId2}`, ownerHeader);
    expect(res.status).toBe(200);
    clientId2 = null;
  });
});
