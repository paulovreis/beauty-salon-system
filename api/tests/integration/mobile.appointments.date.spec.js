import axios from 'axios';
import { makePool } from '../helpers/db.js';
import { makeToken } from '../helpers/jwt.js';
import {
  createEmployee,
  ensureServiceCategory,
  createService,
  createClient,
  createAppointment,
} from '../helpers/factories.js';

const API = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Mobile appointments date serialization', () => {
  const pool = makePool();

  let client;
  let employee;
  let serviceCategory;
  let service;
  let appointment;

  afterAll(async () => {
    try {
      if (appointment?.id) await pool.query('DELETE FROM appointments WHERE id = $1', [appointment.id]);
      if (service?.id) await pool.query('DELETE FROM services WHERE id = $1', [service.id]);
      if (serviceCategory?.id) await pool.query('DELETE FROM service_categories WHERE id = $1', [serviceCategory.id]);
      if (employee?.id) await pool.query('DELETE FROM employees WHERE id = $1', [employee.id]);
      if (client?.id) await pool.query('DELETE FROM clients WHERE id = $1', [client.id]);
    } catch {}
    await pool.end();
  });

  it('returns appointment_date as YYYY-MM-DD (no timezone shift)', async () => {
    client = await createClient(pool, { name: 'Mobile Date Client', phone: `11${Date.now().toString().slice(-9)}` });
    employee = await createEmployee(pool, { name: 'Mobile Date Emp', email: `emp_${Date.now()}@test.com` });
    serviceCategory = await ensureServiceCategory(pool, { name: `MobileCat_${Date.now()}`, description: 'Mobile date category' });
    service = await createService(pool, { category_id: serviceCategory.id, name: `MobileService_${Date.now()}` });

    const appointmentDate = '2099-12-31';
    appointment = await createAppointment(pool, {
      client_id: client.id,
      employee_id: employee.id,
      service_id: service.id,
      appointment_date: appointmentDate,
      appointment_time: '10:00',
      duration_minutes: 30,
      status: 'scheduled',
      price: 50,
    });

    const clientHeader = {
      headers: {
        Authorization: `Bearer ${makeToken({ role: 'client', client_id: client.id, id: 9999 })}`,
      },
    };

    const listRes = await axios.get(`${API}/mobile/appointments?scope=all&limit=10&page=1`, clientHeader);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.data.appointments)).toBe(true);
    expect(listRes.data.appointments).toHaveLength(1);

    const appt = listRes.data.appointments[0];
    expect(appt.appointment_date).toBe(appointmentDate);
    expect(appt.appointment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(appt.appointment_date).not.toContain('T');
    expect(appt.appointment_date).not.toContain('Z');

    const dashRes = await axios.get(`${API}/mobile/dashboard`, clientHeader);
    expect(dashRes.status).toBe(200);
    expect(dashRes.data.nextAppointment).toBeTruthy();
    expect(dashRes.data.nextAppointment.appointment_date).toBe(appointmentDate);
    expect(dashRes.data.nextAppointment.appointment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
