// tests/helpers/cleanup.js
// Utility to truncate tables between tests to keep isolation.
// Uses TRUNCATE ... CASCADE to handle FK relationships and resets identities.
export async function truncateTables(pool, tables) {
  if (!Array.isArray(tables) || tables.length === 0) return;
  const joined = tables.map(t => t.includes('.') ? t : `public.${t}`).join(', ');
  await pool.query(`TRUNCATE ${joined} RESTART IDENTITY CASCADE`);
}

// Common tables used across multiple domains.
export const COMMON_TABLES = [
  'sale_items',
  'sales',
  'stock_movements',
  'appointments',
  'employee_notifications',
  'employees',
  'services',
  'service_categories',
  'products',
  'product_categories',
  'expenses',
  'clients',
  'users'
];
