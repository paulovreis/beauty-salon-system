import jwt from 'jsonwebtoken';

export async function buildClaimsForUser(db, { userId, role }) {
  const claims = { id: userId, role };

  const salonSlug = (process.env.SALON_SLUG || '').trim();
  if (salonSlug) claims.salon_slug = salonSlug;

  if (role === 'client') {
    const { rows } = await db.query('SELECT id FROM clients WHERE user_id = $1 LIMIT 1', [userId]);
    if (rows.length) claims.client_id = rows[0].id;
  } else {
    const { rows } = await db.query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
    if (rows.length) claims.employee_id = rows[0].id;
  }

  return claims;
}

export function signAccessToken(claims, { expiresIn = '1h' } = {}) {
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn });
}
