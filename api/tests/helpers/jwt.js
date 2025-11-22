import jwt from 'jsonwebtoken';

export function makeToken(payload = {}, secret = process.env.JWT_SECRET || 'supersecretkey') {
  return jwt.sign(
    {
      id: payload.id || 1,
      email: payload.email || 'owner@example.com',
      role: payload.role || 'owner',
      ...payload,
    },
    secret,
    { expiresIn: '1h' }
  );
}
