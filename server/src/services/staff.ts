import bcrypt from 'bcryptjs';
import { likePattern, query, withTransaction } from '../db/pool';
import type { AuthUser } from '../types';
import { todayIn } from '../utils/dates';
import { conflict, forbidden, notFound } from '../utils/errors';

const STAFF_SELECT = `
  SELECT st.id, st.name, st.email, st.phone, st.role_title AS "roleTitle", st.specialties,
         st.status, st.avatar_url AS "avatarUrl", st.avatar_color AS "avatarColor",
         (st.user_id IS NOT NULL) AS "hasLogin", st.created_at AS "createdAt",
         (SELECT json_agg(json_build_object(
                   'dayOfWeek', av.day_of_week, 'isWorking', av.is_working,
                   'startTime', to_char(av.start_time, 'HH24:MI'), 'endTime', to_char(av.end_time, 'HH24:MI'))
                 ORDER BY av.day_of_week)
            FROM staff_availability av WHERE av.staff_id = st.id) AS availability
    FROM staff st`;

const COLORS = ['#7b3f6e', '#b0707f', '#8a5a83', '#a07a9a', '#9c6b52', '#6d4c7d', '#a9667a'];

function defaultAvailability() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isWorking: dayOfWeek !== 0,
    startTime: '09:00',
    endTime: '17:00',
  }));
}

export async function listStaff(user: AuthUser, q: { status?: string; search?: string }) {
  const params: unknown[] = [user.studioId];
  let where = 'st.studio_id = $1';
  if (q.status) {
    params.push(q.status);
    where += ` AND st.status = $${params.length}`;
  }
  if (q.search) {
    params.push(likePattern(q.search));
    where += ` AND (st.name ILIKE $${params.length} OR st.role_title ILIKE $${params.length})`;
  }
  const { rows } = await query(`${STAFF_SELECT} WHERE ${where} ORDER BY st.status, st.name`, params);
  return { data: rows.map((r) => ({ ...r, availability: r.availability ?? defaultAvailability() })) };
}

async function loadStaff(user: AuthUser, id: string) {
  const { rows } = await query(`${STAFF_SELECT} WHERE st.id = $2 AND st.studio_id = $1`, [
    user.studioId,
    id,
  ]);
  if (!rows[0]) throw notFound('That staff member');
  return { ...rows[0], availability: rows[0].availability ?? defaultAvailability() };
}

export async function getStaff(user: AuthUser, id: string) {
  const staff = await loadStaff(user, id);
  const today = todayIn(user.timezone);

  const timeOff = await query(
    `SELECT id, start_date AS "startDate", end_date AS "endDate", reason
       FROM staff_time_off WHERE staff_id = $1 AND end_date >= $2 ORDER BY start_date`,
    [id, today],
  );
  const stats = await query(
    `SELECT COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'no_show')) AS total,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE appointment_date >= $2 AND status IN ('pending', 'confirmed', 'checked_in')) AS upcoming
       FROM appointments WHERE staff_id = $1`,
    [id, today],
  );
  const upcoming = await query(
    `SELECT a.id, a.appointment_date AS "date", a.start_time AS "startTime", a.end_time AS "endTime",
            a.status, c.name AS "customerName", sv.name AS "serviceName"
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       JOIN services sv ON sv.id = a.service_id
      WHERE a.staff_id = $1 AND a.appointment_date >= $2 AND a.status IN ('pending', 'confirmed', 'checked_in', 'in_progress')
      ORDER BY a.appointment_date, a.start_time LIMIT 8`,
    [id, today],
  );
  return { staff, timeOff: timeOff.rows, stats: stats.rows[0], upcoming: upcoming.rows };
}

export interface StaffInput {
  name: string;
  email: string;
  phone: string;
  roleTitle: string;
  specialties: string[];
  status: 'active' | 'inactive';
  avatarUrl?: string | null;
  password?: string;
}

export async function createStaff(user: AuthUser, input: StaffInput) {
  const id = await withTransaction(async (client) => {
    let userId: string | null = null;
    if (input.password) {
      const clash = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [input.email]);
      if (clash.rowCount) {
        throw conflict('A login with this email already exists.', { email: 'A login with this email already exists.' });
      }
      const hash = await bcrypt.hash(input.password, 10);
      const created = await client.query(
        `INSERT INTO users (studio_id, name, email, password_hash, role, phone, avatar_url, is_active)
         VALUES ($1, $2, $3, $4, 'staff', $5, $6, $7) RETURNING id`,
        [user.studioId, input.name, input.email, hash, input.phone, input.avatarUrl ?? null, input.status === 'active'],
      );
      userId = created.rows[0].id;
    }
    const count = await client.query('SELECT COUNT(*) AS n FROM staff WHERE studio_id = $1', [user.studioId]);
    const color = COLORS[count.rows[0].n % COLORS.length];
    const created = await client.query(
      `INSERT INTO staff (studio_id, user_id, name, email, phone, role_title, specialties, status, avatar_url, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        user.studioId,
        userId,
        input.name,
        input.email,
        input.phone,
        input.roleTitle,
        input.specialties,
        input.status,
        input.avatarUrl ?? null,
        color,
      ],
    );
    const staffId = created.rows[0].id as string;
    for (const d of defaultAvailability()) {
      await client.query(
        `INSERT INTO staff_availability (staff_id, day_of_week, is_working, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [staffId, d.dayOfWeek, d.isWorking, d.startTime, d.endTime],
      );
    }
    return staffId;
  });
  return loadStaff(user, id);
}

export async function updateStaff(user: AuthUser, id: string, input: StaffInput) {
  const existing = await query('SELECT user_id FROM staff WHERE id = $2 AND studio_id = $1', [user.studioId, id]);
  if (!existing.rows[0]) throw notFound('That staff member');
  const linkedUserId: string | null = existing.rows[0].user_id;

  if (linkedUserId === user.id && input.status === 'inactive') {
    throw conflict('You cannot deactivate your own account.');
  }

  await withTransaction(async (client) => {
    if (linkedUserId) {
      const clash = await client.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [
        input.email,
        linkedUserId,
      ]);
      if (clash.rowCount) {
        throw conflict('Another login already uses this email.', { email: 'Another login already uses this email.' });
      }
      await client.query(
        `UPDATE users SET name = $2, email = $3, phone = $4, is_active = $5,
                token_version = token_version + CASE WHEN $5 THEN 0 ELSE 1 END, updated_at = now()
          WHERE id = $1`,
        [linkedUserId, input.name, input.email, input.phone, input.status === 'active'],
      );
    }
    await client.query(
      `UPDATE staff SET name = $3, email = $4, phone = $5, role_title = $6, specialties = $7, status = $8,
              avatar_url = CASE WHEN $9::boolean THEN $10 ELSE avatar_url END, updated_at = now()
        WHERE id = $2 AND studio_id = $1`,
      [
        user.studioId,
        id,
        input.name,
        input.email,
        input.phone,
        input.roleTitle,
        input.specialties,
        input.status,
        input.avatarUrl !== undefined,
        input.avatarUrl ?? null,
      ],
    );
  });
  return loadStaff(user, id);
}

/** Admins can edit anyone's schedule; staff can only edit their own. */
function assertCanEditSchedule(user: AuthUser, staffId: string) {
  if (user.role !== 'admin' && user.staffId !== staffId) {
    throw forbidden('You can only change your own availability.');
  }
}

export async function saveAvailability(
  user: AuthUser,
  staffId: string,
  days: { dayOfWeek: number; isWorking: boolean; startTime: string; endTime: string }[],
) {
  assertCanEditSchedule(user, staffId);
  await loadStaff(user, staffId);
  await withTransaction(async (client) => {
    for (const d of days) {
      await client.query(
        `INSERT INTO staff_availability (staff_id, day_of_week, is_working, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (staff_id, day_of_week)
         DO UPDATE SET is_working = EXCLUDED.is_working, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
        [staffId, d.dayOfWeek, d.isWorking, d.startTime, d.endTime],
      );
    }
  });
  return loadStaff(user, staffId);
}

export async function addTimeOff(
  user: AuthUser,
  staffId: string,
  input: { startDate: string; endDate: string; reason: string },
) {
  assertCanEditSchedule(user, staffId);
  await loadStaff(user, staffId);
  const { rows } = await query(
    `INSERT INTO staff_time_off (staff_id, start_date, end_date, reason) VALUES ($1, $2, $3, $4)
     RETURNING id, start_date AS "startDate", end_date AS "endDate", reason`,
    [staffId, input.startDate, input.endDate, input.reason],
  );
  return rows[0];
}

export async function removeTimeOff(user: AuthUser, staffId: string, timeOffId: string) {
  assertCanEditSchedule(user, staffId);
  await loadStaff(user, staffId);
  const { rowCount } = await query('DELETE FROM staff_time_off WHERE id = $1 AND staff_id = $2', [
    timeOffId,
    staffId,
  ]);
  if (!rowCount) throw notFound('That time-off period');
}
