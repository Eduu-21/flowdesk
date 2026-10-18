/**
 * Integration tests. They need the database from `npm run db:setup`
 * (the demo account is used for read-only checks; write tests use their own temporary studio).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/pool';
import { addDays, dayOfWeek, todayIn } from '../src/utils/dates';

const app = createApp();
const DEMO = { email: 'demo@flowdesk.local', password: 'DemoPassword123!' };
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let adminToken = '';
let staffToken = '';

beforeAll(async () => {
  adminToken = (await request(app).post('/api/auth/login').send(DEMO)).body.token;
  staffToken = (
    await request(app).post('/api/auth/login').send({ email: 'marta@flowdesk.local', password: DEMO.password })
  ).body.token;
});

afterAll(async () => {
  await pool.end();
});

describe('authentication', () => {
  it('answers the health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('signs in the demo admin', async () => {
    const res = await request(app).post('/api/auth/login').send(DEMO);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password with a friendly message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: DEMO.email, password: 'nope-Nope1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/incorrect email or password/i);
  });

  it('blocks protected routes without a token', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token as an expired session', async () => {
    const res = await request(app).get('/api/customers').set(auth(`${adminToken}x`));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('validates registration input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', studioName: '', email: 'bad', password: 'short', confirmPassword: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.email).toBeTruthy();
    expect(res.body.error.fields.password).toBeTruthy();
  });

  it('runs the forgot / reset password flow', async () => {
    const email = `reset-${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Reset Tester', studioName: 'Reset Studio', email, password: 'OldPassw0rd', confirmPassword: 'OldPassw0rd' });
    expect(reg.status).toBe(201);

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    const token = new URL(forgot.body.devResetUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' });
    expect(reset.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Another1Pass', confirmPassword: 'Another1Pass' });
    expect(reuse.status).toBe(400);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'NewPassw0rd' });
    expect(login.status).toBe(200);

    await pool.query('DELETE FROM studios WHERE id = $1', [reg.body.user.studioId]);
  });

  it('does not reveal whether an email exists', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.devResetUrl).toBeUndefined();
  });
});

describe('role-based access', () => {
  it('stops staff from creating customers, services and staff', async () => {
    const customer = await request(app)
      .post('/api/customers')
      .set(auth(staffToken))
      .send({ name: 'Blocked Person', phone: '+251911000000' });
    expect(customer.status).toBe(403);
    const service = await request(app)
      .post('/api/services')
      .set(auth(staffToken))
      .send({ name: 'Nope', category: 'Hair', durationMinutes: 30, price: 100 });
    expect(service.status).toBe(403);
    const analytics = await request(app).get('/api/analytics').set(auth(staffToken));
    expect(analytics.status).toBe(403);
  });

  it('only shows staff their own appointments', async () => {
    const me = await request(app).get('/api/auth/me').set(auth(staffToken));
    const res = await request(app).get('/api/appointments?pageSize=100').set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const a of res.body.data) expect(a.staffId).toBe(me.body.user.staffId);
  });

  it('lets staff update status and notes but not reschedule', async () => {
    const list = await request(app)
      .get('/api/appointments?status=confirmed&pageSize=5&sort=date&order=desc')
      .set(auth(staffToken));
    const appt = list.body.data[0];
    const notes = await request(app)
      .put(`/api/appointments/${appt.id}`)
      .set(auth(staffToken))
      .send({ notes: 'Customer prefers a quiet chair.' });
    expect(notes.status).toBe(200);
    const move = await request(app)
      .put(`/api/appointments/${appt.id}`)
      .set(auth(staffToken))
      .send({ date: addDays(appt.date, 1) });
    expect(move.status).toBe(403);
  });
});

describe('demo data', () => {
  it('serves the dashboard', async () => {
    const res = await request(app).get('/api/dashboard').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.flow)).toBe(true);
    expect(res.body.insights.length).toBeGreaterThan(0);
  });

  it('serves analytics from real payments', async () => {
    const res = await request(app).get('/api/analytics?range=30').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.revenue.daily).toHaveLength(30);
    expect(res.body.totals.revenue).toBeGreaterThan(0);
    expect(res.body.popularServices.length).toBeGreaterThan(0);
  });

  it('searches, sorts and paginates customers', async () => {
    const res = await request(app)
      .get('/api/customers?search=sara&sort=name&order=asc&page=1&pageSize=5')
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toMatch(/sara/i);
    const page = await request(app).get('/api/customers?pageSize=5&page=2').set(auth(adminToken));
    expect(page.body.data).toHaveLength(5);
    expect(page.body.total).toBeGreaterThanOrEqual(18);
  });

  it('answers the assistant without an external API key', async () => {
    const res = await request(app)
      .post('/api/assistant')
      .set(auth(adminToken))
      .send({ message: 'What is my most popular service this month?' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('built-in');
    expect(res.body.reply.length).toBeGreaterThan(5);
  });

  it('finds things with global search', async () => {
    const res = await request(app).get('/api/search?q=braid').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.services.length).toBeGreaterThan(0);
  });

  it('marks notifications as read', async () => {
    const list = await request(app).get('/api/notifications').set(auth(adminToken));
    expect(list.status).toBe(200);
    const unread = list.body.data.find((n: any) => !n.isRead);
    if (unread) {
      const res = await request(app).put(`/api/notifications/${unread.id}/read`).set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.notification.isRead).toBe(true);
    }
  });
});

describe('booking in a fresh studio', () => {
  let studioId = '';
  let token = '';

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Booking Tester',
        studioName: 'Booking Test Studio',
        email: `book-${Date.now()}@example.com`,
        password: 'Passw0rdTest',
        confirmPassword: 'Passw0rdTest',
      });
    token = reg.body.token;
    studioId = reg.body.user.studioId;
  });

  afterAll(async () => {
    if (studioId) await pool.query('DELETE FROM studios WHERE id = $1', [studioId]);
  });

  it('prevents double booking, respects working hours and frees cancelled slots', async () => {
    const tz = 'Africa/Addis_Ababa';
    let monday = addDays(todayIn(tz), 7);
    while (dayOfWeek(monday) !== 1) monday = addDays(monday, 1);
    const sunday = addDays(monday, -1);

    const customer = await request(app)
      .post('/api/customers')
      .set(auth(token))
      .send({ name: 'Hana Test', phone: '+251 91 000 0000' });
    expect(customer.status).toBe(201);

    const service = await request(app)
      .post('/api/services')
      .set(auth(token))
      .send({ name: 'Test Styling', category: 'Hair', durationMinutes: 60, price: 900 });
    expect(service.status).toBe(201);

    const staff = await request(app).get('/api/staff').set(auth(token));
    const staffId = staff.body.data[0].id;

    const body = (date: string, startTime: string) => ({
      customerId: customer.body.customer.id,
      serviceId: service.body.service.id,
      staffId,
      date,
      startTime,
    });

    const first = await request(app).post('/api/appointments').set(auth(token)).send(body(monday, '10:00'));
    expect(first.status).toBe(201);
    expect(first.body.appointment.endTime).toBe('11:00');
    expect(first.body.appointment.price).toBe(900);

    const clash = await request(app).post('/api/appointments').set(auth(token)).send(body(monday, '10:30'));
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toMatch(/already has an appointment/i);

    const adjacent = await request(app).post('/api/appointments').set(auth(token)).send(body(monday, '11:00'));
    expect(adjacent.status).toBe(201);

    const late = await request(app).post('/api/appointments').set(auth(token)).send(body(monday, '16:30'));
    expect(late.status).toBe(409); // would finish after 17:00

    const dayOff = await request(app).post('/api/appointments').set(auth(token)).send(body(sunday, '10:00'));
    expect(dayOff.status).toBe(409);

    const slots = await request(app)
      .get(`/api/appointments/availability?staffId=${staffId}&serviceId=${service.body.service.id}&date=${monday}`)
      .set(auth(token));
    const starts = slots.body.slots.map((s: any) => s.start);
    expect(starts).toContain('09:00');
    expect(starts).not.toContain('10:00');
    expect(starts).not.toContain('10:30');
    expect(starts).toContain('12:00');

    const cancel = await request(app)
      .put(`/api/appointments/${first.body.appointment.id}`)
      .set(auth(token))
      .send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);

    const reuse = await request(app).post('/api/appointments').set(auth(token)).send(body(monday, '10:00'));
    expect(reuse.status).toBe(201);

    // Payments
    const pay = await request(app)
      .put(`/api/appointments/${adjacent.body.appointment.id}/payment`)
      .set(auth(token))
      .send({ status: 'paid', method: 'telebirr' });
    expect(pay.status).toBe(200);
    expect(pay.body.appointment.paymentStatus).toBe('paid');
    expect(pay.body.payment.amount).toBe(900);

    const badPartial = await request(app)
      .put(`/api/appointments/${reuse.body.appointment.id}/payment`)
      .set(auth(token))
      .send({ status: 'partial', method: 'cash', amount: 5000 });
    expect(badPartial.status).toBe(400);

    // Customers with history cannot be deleted; services with bookings cannot be deleted
    const delService = await request(app).delete(`/api/services/${service.body.service.id}`).set(auth(token));
    expect(delService.status).toBe(409);
    const delCustomer = await request(app).delete(`/api/customers/${customer.body.customer.id}`).set(auth(token));
    expect(delCustomer.status).toBe(409);

    // Staff time off blocks bookings
    const timeOff = await request(app)
      .post(`/api/staff/${staffId}/time-off`)
      .set(auth(token))
      .send({ startDate: addDays(monday, 1), endDate: addDays(monday, 2), reason: 'Holiday' });
    expect(timeOff.status).toBe(201);
    const blocked = await request(app)
      .post('/api/appointments')
      .set(auth(token))
      .send(body(addDays(monday, 1), '10:00'));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/unavailable/i);
  });

  it('validates forms with field-level messages', async () => {
    const res = await request(app).post('/api/services').set(auth(token)).send({
      name: '',
      category: 'Hair',
      durationMinutes: 2,
      price: -5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.durationMinutes).toBeTruthy();
    expect(res.body.error.fields.price).toBeTruthy();
  });

  it('keeps studios isolated from each other', async () => {
    const demoCustomers = await request(app).get('/api/customers?pageSize=1').set(auth(adminToken));
    const id = demoCustomers.body.data[0].id;
    const res = await request(app).get(`/api/customers/${id}`).set(auth(token));
    expect(res.status).toBe(404);
  });
});
