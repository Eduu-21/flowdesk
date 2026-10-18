import type { PoolClient } from 'pg';
import { likePattern, query, withTransaction } from '../db/pool';
import { ACTIVE_STATUSES, STATUS_LABELS, type AuthUser } from '../types';
import { dayOfWeek, formatTime12, fromMinutes, timeIn, todayIn, toMinutes } from '../utils/dates';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { buildSlots } from '../utils/slots';
import { logActivity } from './activity';
import { createNotification, notifyAppointmentEvent } from './notifications';

export const APPOINTMENT_SELECT = `
  SELECT a.id, a.customer_id AS "customerId", c.name AS "customerName", c.phone AS "customerPhone",
         c.email AS "customerEmail", a.service_id AS "serviceId", sv.name AS "serviceName",
         cat.name AS "categoryName", a.staff_id AS "staffId", st.name AS "staffName",
         st.avatar_color AS "staffColor", a.appointment_date AS "date", a.start_time AS "startTime",
         a.end_time AS "endTime", a.duration_minutes AS "durationMinutes", a.price, a.status,
         a.payment_status AS "paymentStatus", a.notes, a.created_at AS "createdAt",
         COALESCE((SELECT SUM(p.amount) FROM payments p
                    WHERE p.appointment_id = a.id AND p.status IN ('paid', 'partial')), 0) AS "amountPaid"
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN services sv ON sv.id = a.service_id
    JOIN service_categories cat ON cat.id = sv.category_id
    JOIN staff st ON st.id = a.staff_id`;

const SORT_COLUMNS: Record<string, string> = {
  date: 'a.appointment_date',
  customer: 'LOWER(c.name)',
  service: 'LOWER(sv.name)',
  staff: 'LOWER(st.name)',
  status: 'a.status',
  price: 'a.price',
};

export interface AppointmentListQuery {
  from?: string;
  to?: string;
  status?: string;
  paymentStatus?: string;
  staffId?: string;
  customerId?: string;
  serviceId?: string;
  search?: string;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

/** Staff members only ever see their own appointments. */
function scopeFilter(user: AuthUser, params: unknown[]): string {
  if (user.role === 'admin') return '';
  params.push(user.staffId ?? '00000000-0000-0000-0000-000000000000');
  return ` AND a.staff_id = $${params.length}`;
}

export async function listAppointments(user: AuthUser, q: AppointmentListQuery) {
  const params: unknown[] = [user.studioId];
  let where = 'a.studio_id = $1';
  where += scopeFilter(user, params);

  const add = (sql: string, value: unknown) => {
    params.push(value);
    where += ` AND ${sql.replace('?', `$${params.length}`)}`;
  };
  if (q.from) add('a.appointment_date >= ?', q.from);
  if (q.to) add('a.appointment_date <= ?', q.to);
  if (q.status) {
    const list = q.status.split(',').map((s) => s.trim()).filter(Boolean);
    add('a.status = ANY(?)', list);
  }
  if (q.paymentStatus) add('a.payment_status = ?', q.paymentStatus);
  if (q.staffId) add('a.staff_id = ?', q.staffId);
  if (q.customerId) add('a.customer_id = ?', q.customerId);
  if (q.serviceId) add('a.service_id = ?', q.serviceId);
  if (q.search) {
    params.push(likePattern(q.search));
    const n = params.length;
    where += ` AND (c.name ILIKE $${n} OR sv.name ILIKE $${n} OR st.name ILIKE $${n})`;
  }

  const count = await query(
    `SELECT COUNT(*) AS n
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       JOIN services sv ON sv.id = a.service_id
       JOIN staff st ON st.id = a.staff_id
      WHERE ${where}`,
    params,
  );

  const direction = q.order === 'desc' ? 'DESC' : 'ASC';
  const sortColumn = SORT_COLUMNS[q.sort] ?? SORT_COLUMNS.date;
  const secondary = q.sort === 'date' ? `, a.start_time ${direction}` : ', a.appointment_date DESC, a.start_time';
  const listParams = [...params, q.pageSize, (q.page - 1) * q.pageSize];
  const { rows } = await query(
    `${APPOINTMENT_SELECT}
      WHERE ${where}
      ORDER BY ${sortColumn} ${direction}${secondary}
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  return { data: rows, total: count.rows[0].n, page: q.page, pageSize: q.pageSize };
}

async function loadAppointment(user: AuthUser, id: string) {
  const params: unknown[] = [user.studioId, id];
  const scope = scopeFilter(user, params);
  const { rows } = await query(`${APPOINTMENT_SELECT} WHERE a.studio_id = $1 AND a.id = $2${scope}`, params);
  if (!rows[0]) throw notFound('That appointment');
  return rows[0];
}

export async function getAppointment(user: AuthUser, id: string) {
  const appointment = await loadAppointment(user, id);
  const history = await query(
    `SELECT l.id, l.action, l.description, l.created_at AS "createdAt", u.name AS "userName"
       FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
      WHERE l.appointment_id = $1 ORDER BY l.created_at DESC LIMIT 30`,
    [id],
  );
  let payment = null;
  if (user.role === 'admin') {
    const p = await query(
      `SELECT id, amount, method, status, paid_at AS "paidAt" FROM payments WHERE appointment_id = $1`,
      [id],
    );
    payment = p.rows[0] ?? null;
  }
  return { appointment, payment, history: history.rows };
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

interface AvailabilityCheck {
  studioId: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  excludeId?: string;
  checkWorkingHours: boolean;
}

/** Throws a friendly 409 when the staff member cannot take the appointment. */
async function assertAvailable(client: PoolClient, c: AvailabilityCheck): Promise<void> {
  const staffRow = await client.query('SELECT name, status FROM staff WHERE id = $1', [c.staffId]);
  const staffName: string = staffRow.rows[0]?.name ?? 'This staff member';

  if (c.checkWorkingHours) {
    if (staffRow.rows[0]?.status !== 'active') {
      throw conflict(`${staffName} is not currently taking appointments.`, { staffId: 'Choose an active staff member' });
    }
    const avail = await client.query(
      `SELECT is_working, start_time, end_time FROM staff_availability WHERE staff_id = $1 AND day_of_week = $2`,
      [c.staffId, dayOfWeek(c.date)],
    );
    const day = avail.rows[0];
    if (!day || !day.is_working) {
      throw conflict(`${staffName} does not work on that day.`, { date: 'Choose a day this person works' });
    }
    if (toMinutes(c.start) < toMinutes(day.start_time) || toMinutes(c.end) > toMinutes(day.end_time)) {
      throw conflict(
        `${staffName} works ${day.start_time}–${day.end_time} on that day, and this appointment would fall outside those hours.`,
        { startTime: 'Choose a time within working hours' },
      );
    }
    const off = await client.query(
      `SELECT reason FROM staff_time_off WHERE staff_id = $1 AND $2::date BETWEEN start_date AND end_date`,
      [c.staffId, c.date],
    );
    if (off.rows[0]) {
      const why = off.rows[0].reason ? ` (${off.rows[0].reason})` : '';
      throw conflict(`${staffName} is unavailable on that date${why}.`, { date: 'Staff member is unavailable' });
    }
  }

  const clash = await client.query(
    `SELECT a.start_time, a.end_time, cu.name AS customer
       FROM appointments a JOIN customers cu ON cu.id = a.customer_id
      WHERE a.staff_id = $1 AND a.appointment_date = $2
        AND a.status IN ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed')
        AND ($5::uuid IS NULL OR a.id <> $5)
        AND a.start_time < $4::time AND a.end_time > $3::time
      LIMIT 1`,
    [c.staffId, c.date, c.start, c.end, c.excludeId ?? null],
  );
  if (clash.rows[0]) {
    const r = clash.rows[0];
    throw conflict(
      `${staffName} already has an appointment from ${formatTime12(r.start_time)} to ${formatTime12(r.end_time)} (${r.customer}).`,
      { startTime: 'This time is already taken' },
    );
  }
}

export async function getAvailability(
  user: AuthUser,
  q: { staffId: string; serviceId: string; date: string; excludeId?: string },
) {
  const staff = await query('SELECT name, status FROM staff WHERE id = $1 AND studio_id = $2', [
    q.staffId,
    user.studioId,
  ]);
  const service = await query(
    'SELECT duration_minutes FROM services WHERE id = $1 AND studio_id = $2',
    [q.serviceId, user.studioId],
  );
  if (!staff.rows[0]) throw notFound('That staff member');
  if (!service.rows[0]) throw notFound('That service');

  const empty = (reason: string) => ({ slots: [], reason });
  if (staff.rows[0].status !== 'active') return empty(`${staff.rows[0].name} is not taking appointments.`);

  const today = todayIn(user.timezone);
  if (q.date < today) return empty('That date has already passed.');

  const avail = await query(
    `SELECT is_working, start_time, end_time FROM staff_availability WHERE staff_id = $1 AND day_of_week = $2`,
    [q.staffId, dayOfWeek(q.date)],
  );
  const day = avail.rows[0];
  if (!day || !day.is_working) return empty(`${staff.rows[0].name} has the day off.`);

  const off = await query(
    `SELECT reason FROM staff_time_off WHERE staff_id = $1 AND $2::date BETWEEN start_date AND end_date`,
    [q.staffId, q.date],
  );
  if (off.rows[0]) {
    return empty(`${staff.rows[0].name} is away${off.rows[0].reason ? `: ${off.rows[0].reason}` : '.'}`);
  }

  const busy = await query(
    `SELECT start_time AS start, end_time AS "end" FROM appointments
      WHERE staff_id = $1 AND appointment_date = $2
        AND status IN ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed')
        AND ($3::uuid IS NULL OR id <> $3)`,
    [q.staffId, q.date, q.excludeId ?? null],
  );

  const notBefore =
    q.date === today ? Math.ceil(toMinutes(timeIn(user.timezone)) / 15) * 15 : undefined;
  const slots = buildSlots({
    workStart: day.start_time,
    workEnd: day.end_time,
    durationMinutes: service.rows[0].duration_minutes,
    busy: busy.rows,
    notBefore,
  });
  return { slots, reason: slots.length ? undefined : 'Fully booked for that day.', workStart: day.start_time, workEnd: day.end_time };
}

/* ------------------------------------------------------------------ */
/* Create / update / delete                                            */
/* ------------------------------------------------------------------ */

async function lockStaffDay(client: PoolClient, staffId: string, date: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${staffId}:${date}`]);
}

async function loadRefs(user: AuthUser, refs: { customerId?: string; serviceId?: string; staffId?: string }) {
  const out: { service?: any; staff?: any; customer?: any } = {};
  if (refs.customerId) {
    const r = await query('SELECT id, name, status FROM customers WHERE id = $1 AND studio_id = $2', [
      refs.customerId,
      user.studioId,
    ]);
    if (!r.rows[0]) throw notFound('That customer');
    out.customer = r.rows[0];
  }
  if (refs.serviceId) {
    const r = await query(
      'SELECT id, name, duration_minutes AS "durationMinutes", price, is_active AS "isActive" FROM services WHERE id = $1 AND studio_id = $2',
      [refs.serviceId, user.studioId],
    );
    if (!r.rows[0]) throw notFound('That service');
    out.service = r.rows[0];
  }
  if (refs.staffId) {
    const r = await query('SELECT id, name, status FROM staff WHERE id = $1 AND studio_id = $2', [
      refs.staffId,
      user.studioId,
    ]);
    if (!r.rows[0]) throw notFound('That staff member');
    out.staff = r.rows[0];
  }
  return out;
}

export interface CreateAppointmentInput {
  customerId: string;
  serviceId: string;
  staffId: string;
  date: string;
  startTime: string;
  status: 'pending' | 'confirmed';
  notes: string;
  price?: number;
}

export async function createAppointment(user: AuthUser, input: CreateAppointmentInput) {
  const today = todayIn(user.timezone);
  if (input.date < today) {
    throw badRequest('Appointments cannot be booked in the past.', { date: 'Choose today or a future date' });
  }
  const { customer, service } = await loadRefs(user, input);
  if (!service.isActive) {
    throw badRequest('That service is inactive.', { serviceId: 'Choose an active service' });
  }

  const end = fromMinutes(toMinutes(input.startTime) + service.durationMinutes);
  if (toMinutes(end) >= 24 * 60) {
    throw badRequest('The appointment would run past midnight.', { startTime: 'Choose an earlier time' });
  }
  const price = input.price ?? service.price;

  const id = await withTransaction(async (client) => {
    await lockStaffDay(client, input.staffId, input.date);
    await assertAvailable(client, {
      studioId: user.studioId,
      staffId: input.staffId,
      date: input.date,
      start: input.startTime,
      end,
      checkWorkingHours: true,
    });
    const { rows } = await client.query(
      `INSERT INTO appointments
         (studio_id, customer_id, service_id, staff_id, appointment_date, start_time, end_time,
          duration_minutes, price, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        user.studioId,
        input.customerId,
        input.serviceId,
        input.staffId,
        input.date,
        input.startTime,
        end,
        service.durationMinutes,
        price,
        input.status,
        input.notes,
        user.id,
      ],
    );
    await logActivity(
      {
        studioId: user.studioId,
        userId: user.id,
        customerId: input.customerId,
        appointmentId: rows[0].id,
        action: 'appointment_created',
        description: `Booked ${service.name} for ${input.date} at ${formatTime12(input.startTime)}`,
      },
      client,
    );
    return rows[0].id as string;
  });

  await notifyAppointmentEvent('booked', id);
  if (input.status === 'confirmed') await notifyAppointmentEvent('confirmation_email', id);
  void customer;
  return loadAppointment(user, id);
}

export async function updateAppointment(user: AuthUser, id: string, input: Record<string, any>) {
  const existing = await loadAppointment(user, id);

  if (user.role !== 'admin') {
    const extra = Object.keys(input).filter((k) => !['status', 'notes'].includes(k));
    if (extra.length) throw forbidden('Staff can update the status and notes of their appointments.');
  }

  const scheduleKeys = ['serviceId', 'staffId', 'date', 'startTime'] as const;
  const scheduleChanged = scheduleKeys.some((k) => input[k] !== undefined && input[k] !== existing[k]);
  const nextStatus: string = input.status ?? existing.status;
  const reactivating =
    ['cancelled', 'no_show'].includes(existing.status) && !['cancelled', 'no_show'].includes(nextStatus);

  if (scheduleChanged && !['pending', 'confirmed', 'checked_in'].includes(existing.status) && !reactivating) {
    throw conflict('Only upcoming appointments can be rescheduled.');
  }

  const next = {
    customerId: input.customerId ?? existing.customerId,
    serviceId: input.serviceId ?? existing.serviceId,
    staffId: input.staffId ?? existing.staffId,
    date: input.date ?? existing.date,
    startTime: input.startTime ?? existing.startTime,
    notes: input.notes ?? existing.notes,
  };

  const refs = await loadRefs(user, {
    customerId: input.customerId,
    serviceId: input.serviceId,
    staffId: input.staffId,
  });
  let duration: number = existing.durationMinutes;
  let price: number = input.price ?? existing.price;
  if (refs.service) {
    if (input.serviceId !== existing.serviceId && !refs.service.isActive) {
      throw badRequest('That service is inactive.', { serviceId: 'Choose an active service' });
    }
    duration = refs.service.durationMinutes;
    if (input.price === undefined && input.serviceId !== existing.serviceId) price = refs.service.price;
  }
  const end = fromMinutes(toMinutes(next.startTime) + duration);
  if (toMinutes(end) >= 24 * 60) {
    throw badRequest('The appointment would run past midnight.', { startTime: 'Choose an earlier time' });
  }

  if (scheduleChanged && next.date < todayIn(user.timezone)) {
    throw badRequest('Appointments cannot be moved to a past date.', { date: 'Choose today or a future date' });
  }

  await withTransaction(async (client) => {
    if (scheduleChanged || reactivating) {
      await lockStaffDay(client, next.staffId, next.date);
      await assertAvailable(client, {
        studioId: user.studioId,
        staffId: next.staffId,
        date: next.date,
        start: next.startTime,
        end,
        excludeId: id,
        checkWorkingHours: scheduleChanged,
      });
    }
    await client.query(
      `UPDATE appointments
          SET customer_id = $3, service_id = $4, staff_id = $5, appointment_date = $6, start_time = $7,
              end_time = $8, duration_minutes = $9, price = $10, status = $11, notes = $12,
              reminder_sent_at = CASE WHEN $13::boolean THEN NULL ELSE reminder_sent_at END,
              updated_at = now()
        WHERE id = $2 AND studio_id = $1`,
      [
        user.studioId,
        id,
        next.customerId,
        next.serviceId,
        next.staffId,
        next.date,
        next.startTime,
        end,
        duration,
        price,
        nextStatus,
        next.notes,
        scheduleChanged,
      ],
    );
    if (nextStatus !== existing.status) {
      await logActivity(
        {
          studioId: user.studioId,
          userId: user.id,
          customerId: next.customerId,
          appointmentId: id,
          action: nextStatus === 'cancelled' ? 'appointment_cancelled' : 'status_changed',
          description: `${existing.serviceName}: ${STATUS_LABELS[existing.status]} → ${STATUS_LABELS[nextStatus]}`,
        },
        client,
      );
    }
    if (scheduleChanged) {
      await logActivity(
        {
          studioId: user.studioId,
          userId: user.id,
          customerId: next.customerId,
          appointmentId: id,
          action: 'rescheduled',
          description: `Moved to ${next.date} at ${formatTime12(next.startTime)}`,
        },
        client,
      );
    }
  });

  if (nextStatus !== existing.status) {
    if (nextStatus === 'cancelled') await notifyAppointmentEvent('cancelled', id);
    else if (nextStatus === 'confirmed') await notifyAppointmentEvent('confirmed', id);
  }
  return loadAppointment(user, id);
}

export async function deleteAppointment(user: AuthUser, id: string) {
  const existing = await loadAppointment(user, id);
  await query('DELETE FROM appointments WHERE id = $2 AND studio_id = $1', [user.studioId, id]);
  await logActivity({
    studioId: user.studioId,
    userId: user.id,
    customerId: existing.customerId,
    action: 'appointment_deleted',
    description: `${existing.serviceName} on ${existing.date} was deleted`,
  });
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function setPayment(
  user: AuthUser,
  id: string,
  input: { status: string; method?: string; amount?: number },
) {
  const appt = await loadAppointment(user, id);
  const prior = await query('SELECT amount, method FROM payments WHERE appointment_id = $1', [id]);

  await withTransaction(async (client) => {
    if (input.status === 'unpaid') {
      await client.query('DELETE FROM payments WHERE appointment_id = $1', [id]);
    } else {
      const method = input.method ?? prior.rows[0]?.method;
      if (!method) {
        throw badRequest('Choose how the customer paid.', { method: 'Choose a payment method' });
      }
      let amount = input.amount ?? (input.status === 'partial' ? undefined : prior.rows[0]?.amount ?? appt.price);
      if (input.status === 'paid') amount = input.amount ?? appt.price;
      if (input.status === 'partial') {
        if (amount === undefined || amount <= 0 || amount >= appt.price) {
          throw badRequest('A partial payment must be more than 0 and less than the full price.', {
            amount: `Enter an amount between 0 and ${appt.price}`,
          });
        }
      }
      await client.query(
        `INSERT INTO payments (studio_id, appointment_id, customer_id, amount, method, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (appointment_id)
         DO UPDATE SET amount = EXCLUDED.amount, method = EXCLUDED.method, status = EXCLUDED.status, paid_at = now()`,
        [user.studioId, id, appt.customerId, amount, method, input.status],
      );
    }
    await client.query(
      'UPDATE appointments SET payment_status = $3, updated_at = now() WHERE id = $2 AND studio_id = $1',
      [user.studioId, id, input.status],
    );
    await logActivity(
      {
        studioId: user.studioId,
        userId: user.id,
        customerId: appt.customerId,
        appointmentId: id,
        action: 'payment_updated',
        description: `Payment marked ${input.status} for ${appt.serviceName}`,
      },
      client,
    );
  });

  if (input.status === 'paid') {
    await createNotification({
      studioId: user.studioId,
      userId: null,
      type: 'payment',
      title: `Payment received from ${appt.customerName}`,
      message: `${appt.serviceName}`,
      link: `/appointments/${id}`,
    }).catch(() => undefined);
  }
  return getAppointment(user, id);
}

export async function listPayments(
  user: AuthUser,
  q: { from?: string; to?: string; method?: string; status?: string; page: number; pageSize: number },
) {
  const params: unknown[] = [user.studioId, user.timezone];
  let where = 'p.studio_id = $1';
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where += ` AND ${sql.replace('?', `$${params.length}`)}`;
  };
  if (q.from) add("(p.paid_at AT TIME ZONE $2)::date >= ?", q.from);
  if (q.to) add("(p.paid_at AT TIME ZONE $2)::date <= ?", q.to);
  if (q.method) add('p.method = ?', q.method);
  if (q.status) add('p.status = ?', q.status);

  const totals = await query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('paid', 'partial')), 0) AS total
       FROM payments p WHERE ${where}`,
    params,
  );
  const listParams = [...params, q.pageSize, (q.page - 1) * q.pageSize];
  const { rows } = await query(
    `SELECT p.id, p.appointment_id AS "appointmentId", p.amount, p.method, p.status, p.paid_at AS "paidAt",
            c.name AS "customerName", sv.name AS "serviceName"
       FROM payments p
       JOIN appointments a ON a.id = p.appointment_id
       JOIN customers c ON c.id = p.customer_id
       JOIN services sv ON sv.id = a.service_id
      WHERE ${where}
      ORDER BY p.paid_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  return {
    data: rows,
    total: totals.rows[0].n,
    totalAmount: totals.rows[0].total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export { ACTIVE_STATUSES };
