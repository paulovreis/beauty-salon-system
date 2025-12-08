import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Auth flows: register, login, refresh, password reset', () => {
  const pool = makePool();
  const testEmail = 'authtest@example.com';
  const testPassword = 'Test@12345';

  afterAll(async () => {
    try {
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    } catch {}
    await pool.end();
  });

  it('registers a new user', async () => {
    const res = await axios.post(`${API}/auth/register`, {
      email: testEmail,
      password: testPassword,
      role: 'employee'
    });
    expect(res.status).toBe(201);
    expect(res.data.user.email).toBe(testEmail);
    expect(res.data.user.role).toBe('employee');
  });

  it('prevents duplicate registration', async () => {
    try {
      await axios.post(`${API}/auth/register`, {
        email: testEmail,
        password: testPassword
      });
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(409);
      expect(err.response.data.message).toContain('already exists');
    }
  });

  it('logs in with valid credentials', async () => {
    const res = await axios.post(`${API}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeDefined();
    expect(res.data.user.email).toBe(testEmail);
  });

  it('rejects login with invalid password', async () => {
    try {
      await axios.post(`${API}/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      });
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  it('rejects login with non-existent email', async () => {
    try {
      await axios.post(`${API}/auth/login`, {
        email: 'nonexistent@example.com',
        password: testPassword
      });
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  it('refreshes token with valid token', async () => {
    const loginRes = await axios.post(`${API}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    const token = loginRes.data.token;

    const res = await axios.post(`${API}/auth/refresh-token`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
    expect(res.data.message).toBe('Token refreshed successfully');
    expect(res.data.token).toBeDefined();
    // API may return the same token; validate presence only
  });

  it('rejects refresh with invalid token', async () => {
    try {
      await axios.post(`${API}/auth/refresh-token`, {}, {
        headers: { Authorization: 'Bearer invalidtoken' }
      });
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(403);
    }
  });

  it('initiates password reset', async () => {
    const res = await axios.post(`${API}/auth/forgot-password`, {
      email: testEmail
    });
    expect(res.status).toBe(200);
    expect(res.data.message).toContain('receberá');
  });

  it('handles forgot password for non-existent email gracefully', async () => {
    // Should not reveal if email exists for security
    const res = await axios.post(`${API}/auth/forgot-password`, {
      email: 'doesnotexist@example.com'
    });
    expect(res.status).toBe(200);
  });

  it('validates reset token', async () => {
    // Create a valid reset token manually
    const { rows } = await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id`,
      ['validtoken123', new Date(Date.now() + 3600000), testEmail]
    );
    expect(rows.length).toBe(1);

    const res = await axios.get(`${API}/auth/validate-reset-token/validtoken123`);
    expect(res.status).toBe(200);
    expect(res.data.message).toBe('Token is valid');
  });

  it('rejects expired reset token', async () => {
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
      ['expiredtoken', new Date(Date.now() - 3600000), testEmail]
    );

    try {
      await axios.get(`${API}/auth/validate-reset-token/expiredtoken`);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(400);
    }
  });

  it('resets password with valid token', async () => {
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
      ['resettoken456', new Date(Date.now() + 3600000), testEmail]
    );

    const newPassword = 'NewPass@123';
    const res = await axios.post(`${API}/auth/reset-password`, {
      token: 'resettoken456',
      newPassword
    });
    expect(res.status).toBe(200);
    expect(res.data.message).toBe('Password reset successfully');

    // Verify can login with new password
    const loginRes = await axios.post(`${API}/auth/login`, {
      email: testEmail,
      password: newPassword
    });
    expect(loginRes.status).toBe(200);
  });
});
