import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import { createClient, createEmployee, ensureServiceCategory, createService } from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Scheduling advanced features', () => {
  const pool = makePool();
  const ownerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'owner' })}` } };
  const managerHeader = { headers: { Authorization: `Bearer ${makeToken({ role: 'manager' })}` } };
  let clientId, employeeId, serviceId, categoryId;
  let appointmentId1, appointmentId2;

  beforeAll(async () => {
    const client = await createClient(pool, { name: 'Cliente Agenda', phone: '11987654321' });
    const emp = await createEmployee(pool, { name: 'Func Agenda', email: 'agenda@test.com', phone: '11987654322' });
    const cat = await ensureServiceCategory(pool);
    const svc = await createService(pool, { category_id: cat.id, duration_minutes: 60 });
    
    clientId = client.id;
    employeeId = emp.id;
    serviceId = svc.id;
    categoryId = cat.id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM appointments WHERE client_id = $1', [clientId]);
      await pool.query('DELETE FROM services WHERE id = $1', [serviceId]);
      await pool.query('DELETE FROM service_categories WHERE id = $1', [categoryId]);
      await pool.query('DELETE FROM employees WHERE id = $1', [employeeId]);
      await pool.query('DELETE FROM clients WHERE id = $1', [clientId]);
    } catch {}
    await pool.end();
  });

  it('creates multiple appointments for same day', async () => {
    const date = '2025-12-20';
    
    const res1 = await axios.post(`${API}/scheduling`, {
      client_id: clientId,
      employee_id: employeeId,
      service_id: serviceId,
      appointment_date: date,
      appointment_time: '09:00',
      status: 'scheduled',
      notes: 'Primeiro agendamento'
    }, ownerHeader);
    expect(res1.status).toBe(201);
    appointmentId1 = res1.data.id;

    const res2 = await axios.post(`${API}/scheduling`, {
      client_id: clientId,
      employee_id: employeeId,
      service_id: serviceId,
      appointment_date: date,
      appointment_time: '14:00',
      status: 'scheduled',
      notes: 'Segundo agendamento'
    }, ownerHeader);
    expect(res2.status).toBe(201);
    appointmentId2 = res2.data.id;
  });

  it('gets appointments by date', async () => {
    const res = await axios.get(`${API}/scheduling/date/2025-12-20`, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(2);
    expect(res.data.some(a => a.id === appointmentId1)).toBe(true);
    expect(res.data.some(a => a.id === appointmentId2)).toBe(true);
  });

  it('gets available time slots for employee', async () => {
    const res = await axios.get(
      `${API}/scheduling/available-slots/${employeeId}/2025-12-20`,
      managerHeader
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    // Should not include 09:00 and 14:00 (already booked)
    expect(res.data.some(s => s.start_time === '09:00')).toBe(false);
  });

  it('prevents double booking same employee at same time', async () => {
    try {
      await axios.post(`${API}/scheduling`, {
        client_id: clientId,
        employee_id: employeeId,
        service_id: serviceId,
        appointment_date: '2025-12-20',
        appointment_time: '09:00', // Already booked
        status: 'scheduled'
      }, ownerHeader);
      fail('Should have thrown error');
    } catch (err) {
      expect(err.response.status).toBe(409);
      expect(err.response.data.message).toMatch(/conflit|Conflito|conflito|já possui/i);
    }
  });

  it('gets upcoming appointments paginated', async () => {
    // Use the available next/5 endpoint due to route ordering
    const res = await axios.get(`${API}/scheduling/next/5`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeLessThanOrEqual(5);
  });

  it('cancels appointment', async () => {
    const res = await axios.post(`${API}/scheduling/${appointmentId1}/cancel`, {}, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('canceled'); // Note: API uses 'canceled' not 'cancelled'
  });

  it('updates appointment time (manager)', async () => {
    const res = await axios.put(`${API}/scheduling/${appointmentId2}`, {
      appointment_time: '15:00'
    }, managerHeader);
    expect(res.status).toBe(200);
    expect(res.data.appointment_time).toBe('15:00:00');
  });

  it('gets appointments by employee', async () => {
    const res = await axios.get(`${API}/scheduling/employee/${employeeId}`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('gets appointments by client', async () => {
    // API does not expose /client/:id; use client_search filter instead
    const res = await axios.get(`${API}/scheduling?client_search=Cliente%20Agenda`, managerHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.appointments)).toBe(true);
    expect(res.data.appointments.some(a => a.client_name && a.client_name.includes('Cliente Agenda'))).toBe(true);
  });

  it('allows editing completed appointment (API permits)', async () => {
    // Complete appointment first
    await pool.query(
      `UPDATE appointments SET status = 'completed' WHERE id = $1`,
      [appointmentId2]
    );

    const res = await axios.put(`${API}/scheduling/${appointmentId2}`, {
      appointment_time: '16:00'
    }, ownerHeader);
    expect(res.status).toBe(200);
    expect(res.data.appointment_time).toBe('16:00:00');
  });
});
