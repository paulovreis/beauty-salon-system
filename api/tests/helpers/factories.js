// tests/helpers/factories.js
// Simple factory helpers for inserting core entities directly.
// Keep logic minimal to avoid coupling with controllers.
import bcrypt from 'bcryptjs';

export async function createUser(pool, { email = 'user@test.com', password = 'secret123', role = 'owner' } = {}) {
  const hash = bcrypt.hashSync(password, 8);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id, email, role`,
    [email, hash, role]
  );
  return rows[0];
}

export async function createEmployee(pool, { user_id = null, name = 'Emp Test', email = 'emp@test.com', phone = '00000000000', status = 'active' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO employees (user_id, name, email, phone, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [user_id, name, email, phone, status]
  );
  return rows[0];
}

export async function ensureServiceCategory(pool, { name = 'TestCat', description = 'Categoria teste' } = {}) {
  const existing = await pool.query(`SELECT id FROM service_categories WHERE name = $1 LIMIT 1`, [name]);
  if (existing.rows[0]) return existing.rows[0];
  const { rows } = await pool.query(
    `INSERT INTO service_categories (name, description) VALUES ($1,$2) RETURNING id`,
    [name, description]
  );
  return rows[0];
}

export async function createService(pool, { category_id, name = 'Servico Teste', base_cost = 10, recommended_price = 40, duration_minutes = 45, is_active = true } = {}) {
  if (!category_id) throw new Error('category_id required');
  const { rows } = await pool.query(
    `INSERT INTO services (category_id, name, base_cost, recommended_price, duration_minutes, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, recommended_price, duration_minutes`,
    [category_id, name, base_cost, recommended_price, duration_minutes, is_active]
  );
  return rows[0];
}

export async function createClient(pool, { name = 'Cliente Teste', phone = '11888887777' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO clients (name, phone, first_visit, last_visit, total_visits, total_spent) VALUES ($1,$2,CURRENT_DATE,CURRENT_DATE,0,0) RETURNING id`,
    [name, phone]
  );
  return rows[0];
}

export async function createAppointment(pool, { client_id, employee_id, service_id, appointment_date = new Date().toISOString().slice(0,10), appointment_time = '10:00', duration_minutes = 30, status = 'scheduled', price = 50 } = {}) {
  if (!client_id || !employee_id || !service_id) throw new Error('client_id, employee_id, service_id required');
  const { rows } = await pool.query(
    `INSERT INTO appointments (client_id, employee_id, service_id, appointment_date, appointment_time, duration_minutes, status, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, status, price`,
    [client_id, employee_id, service_id, appointment_date, appointment_time, duration_minutes, status, price]
  );
  return rows[0];
}

export async function createExpense(pool, { category='Insumos', description='Compra teste', amount=25.5, expense_date=new Date().toISOString().slice(0,10), payment_method='cash', receipt_number=null, notes=null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO expenses (category, description, amount, expense_date, payment_method, receipt_number, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, category, amount`,
    [category, description, amount, expense_date, payment_method, receipt_number, notes]
  );
  return rows[0];
}
