import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createUser } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('User roles management (owner only)', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let userId1, userId2;

  beforeAll(async () => {
    const user1 = await createUser(pool, { email: 'user1@test.com', role: 'employee' });
    const user2 = await createUser(pool, { email: 'user2@test.com', role: 'manager' });
    userId1 = user1.id;
    userId2 = user2.id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userId1, userId2]);
    } catch {}
    await pool.end();
  });

  it('owner lists all users', async () => {
    const res = await axios.get(`${API}/users`, ownerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
    expect(res.data.some(u => u.id === userId1)).toBe(true);
  });

  it('blocks manager from listing users', async () => {
    try {
      await axios.get(`${API}/users`, managerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(403);
    }
  });

  it('owner updates user role to manager', async () => {
    const res = await axios.put(`${API}/users/${userId1}/role`, {
      role: 'manager'
    }, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.role).toBe('manager'); // userRoutes returns user object directly

    // Verify role changed
    const checkRes = await axios.get(`${API}/users`, ownerHeader);
    const user = checkRes.data.find(u => u.id === userId1);
    expect(user.role).toBe('manager');
  });

  it('owner updates user role to owner', async () => {
    const res = await axios.put(`${API}/users/${userId2}/role`, {
      role: 'owner'
    }, ownerHeader);
    expect(res.status).toBe(200);
  });

  it('rejects invalid role', async () => {
    try {
      await axios.put(`${API}/users/${userId1}/role`, {
        role: 'invalid_role'
      }, ownerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(400);
    }
  });

  it('blocks manager from updating roles', async () => {
    try {
      await axios.put(`${API}/users/${userId1}/role`, {
        role: 'employee'
      }, managerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(403);
    }
  });
});
