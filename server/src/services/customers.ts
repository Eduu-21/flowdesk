import { likePattern, query } from '../db/pool';
import type { AuthUser } from '../types';
import { addDays, todayIn } from '../utils/dates';
import { conflict, notFound } from '../utils/errors';
import { logActivity } from './activity';

const SORT_COLUMNS: Record<string, string> = {
  name: 'LOWER(c.name)',
  createdAt: 'c.created_at',
  appointmentCount: '"appointmentCount"',
  lastVisit: '"lastVisit"',
  totalSpent: '"totalSpent"',
};

const CUSTOMER_STATS = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE a.status NOT IN ('cancelled', 'no_show')) AS cnt,
           MAX(a.appointment_date) FILTER (WHERE a.status = 'completed') AS last_visit,
           (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
             WHERE p.customer_id = c.id AND p.status IN ('paid', 'partial')) AS spent
      FROM appointments a WHERE a.customer_id = c.id
  ) s ON TRUE`;

const CUSTOMER_COLUMNS = `
  c.id, c.name, c.phone, c.email, c.status, c.created_at AS "createdAt",
  c.preferred_service AS "preferredService", c.preferred_staff AS "preferredStaff",
  c.scheduling_preference AS "schedulingPreference",
  COALESCE(s.cnt, 0) AS "appointmentCount", s.last_visit AS "lastVisit",
  COALESCE(s.spent, 0) AS "totalSpent"`;

/** Staff may only see customers they have worked with. */
function staffScope(user: AuthUser, params: unknown[]): string {
  if (user.role === 'admin') return '';
  params.push(user.staffId ?? '00000000-0000-0000-0000-000000000000');
  return `AND EXISTS (SELECT 1 FROM appointments x WHERE x.customer_id = c.id AND x.staff_id = $${params.length})`;
}

export interface CustomerListQuery {
  search?: string;
  status?: 'active' | 'inactive';
  lapsed?: string;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export async function listCustomers(user: AuthUser, q: CustomerListQuery) {
  const params: unknown[] = [user.studioId];
  let where = 'c.studio_id = $1';
  where += ` ${staffScope(user, params)}`;

  if (q.search) {
    params.push(likePattern(q.search));
    const n = params.length;
    where += ` AND (c.name ILIKE $${n} OR c.phone ILIKE $${n} OR c.email ILIKE $${n})`;
  }
  if (q.status) {
    params.push(q.status);
    where += ` AND c.status = $${params.length}`;
  }
  if (q.lapsed) {
    const today = todayIn(user.timezone);
    params.push(addDays(today, -30), today);
    const cutoff = params.length - 1;
    const now = params.length;
    where += ` AND c.status = 'active'
      AND EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status = 'completed')
      AND NOT EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status = 'completed' AND l.appointment_date >= $${cutoff})
      AND NOT EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status IN ('pending','confirmed') AND l.appointment_date >= $${now})`;
  }

  const total = await query(`SELECT COUNT(*) AS n FROM customers c WHERE ${where}`, params);

  const sortColumn = SORT_COLUMNS[q.sort] ?? SORT_COLUMNS.name;
  const direction = q.order === 'desc' ? 'DESC' : 'ASC';
  const listParams = [...params, q.pageSize, (q.page - 1) * q.pageSize];
  const { rows } = await query(
    `SELECT ${CUSTOMER_COLUMNS}
       FROM customers c ${CUSTOMER_STATS}
      WHERE ${where}
      ORDER BY ${sortColumn} ${direction} NULLS LAST, LOWER(c.name)
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  return { data: rows, total: total.rows[0].n, page: q.page, pageSize: q.pageSize };
}

async function loadCustomer(user: AuthUser, id: string) {
  const params: unknown[] = [user.studioId, id];
  const scope = staffScope(user, params);
  const { rows } = await query(
    `SELECT ${CUSTOMER_COLUMNS}
       FROM customers c ${CUSTOMER_STATS}
      WHERE c.studio_id = $1 AND c.id = $2 ${scope}`,
    params,
  );
  if (!rows[0]) throw notFound('That customer');
  return rows[0];
}

export async function getCustomer(user: AuthUser, id: string) {
  const customer = await loadCustomer(user, id);
  const today = todayIn(user.timezone);

  const appointments = await query(
    `SELECT a.id, a.appointment_date AS "date", a.start_time AS "startTime", a.end_time AS "endTime",
            a.status, a.payment_status AS "paymentStatus", a.price,
            sv.name AS "serviceName", st.name AS "staffName", st.avatar_color AS "staffColor"
       FROM appointments a
       JOIN services sv ON sv.id = a.service_id
       JOIN staff st ON st.id = a.staff_id
      WHERE a.customer_id = $1
      ORDER BY a.appointment_date DESC, a.start_time DESC`,
    [id],
  );
  const next = appointments.rows
    .filter((a) => a.date >= today && ['pending', 'confirmed', 'checked_in'].includes(a.status))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];

  const notes = await query(
    `SELECT n.id, n.body, n.created_at AS "createdAt", u.name AS "authorName"
       FROM customer_notes n LEFT JOIN users u ON u.id = n.author_id
      WHERE n.customer_id = $1 ORDER BY n.created_at DESC`,
    [id],
  );
  const activity = await query(
    `SELECT id, action, description, created_at AS "createdAt"
       FROM activity_logs WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 40`,
    [id],
  );

  return {
    customer: {
      ...customer,
      nextAppointment: next
        ? {
            id: next.id,
            date: next.date,
            startTime: next.startTime,
            serviceName: next.serviceName,
            staffName: next.staffName,
          }
        : null,
    },
    appointments: appointments.rows,
    notes: notes.rows,
    activity: activity.rows,
  };
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  preferredService: string;
  preferredStaff: string;
  schedulingPreference: string;
  status: 'active' | 'inactive';
}

export async function createCustomer(user: AuthUser, input: CustomerInput) {
  const { rows } = await query(
    `INSERT INTO customers (studio_id, name, phone, email, preferred_service, preferred_staff, scheduling_preference, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      user.studioId,
      input.name,
      input.phone,
      input.email,
      input.preferredService,
      input.preferredStaff,
      input.schedulingPreference,
      input.status,
    ],
  );
  await logActivity({
    studioId: user.studioId,
    userId: user.id,
    customerId: rows[0].id,
    action: 'customer_created',
    description: 'Customer added',
  });
  return loadCustomer(user, rows[0].id);
}

export async function updateCustomer(user: AuthUser, id: string, input: CustomerInput) {
  const { rowCount } = await query(
    `UPDATE customers
        SET name = $3, phone = $4, email = $5, preferred_service = $6, preferred_staff = $7,
            scheduling_preference = $8, status = $9, updated_at = now()
      WHERE id = $2 AND studio_id = $1`,
    [
      user.studioId,
      id,
      input.name,
      input.phone,
      input.email,
      input.preferredService,
      input.preferredStaff,
      input.schedulingPreference,
      input.status,
    ],
  );
  if (!rowCount) throw notFound('That customer');
  await logActivity({
    studioId: user.studioId,
    userId: user.id,
    customerId: id,
    action: 'customer_updated',
    description: 'Customer details updated',
  });
  return loadCustomer(user, id);
}

export async function deleteCustomer(user: AuthUser, id: string) {
  const exists = await query('SELECT name FROM customers WHERE id = $2 AND studio_id = $1', [
    user.studioId,
    id,
  ]);
  if (!exists.rows[0]) throw notFound('That customer');

  const history = await query(
    `SELECT COUNT(*) AS n FROM appointments a
      WHERE a.customer_id = $1
        AND (a.status = 'completed' OR a.payment_status IN ('paid', 'partial', 'refunded'))`,
    [id],
  );
  if (history.rows[0].n > 0) {
    throw conflict(
      'This customer has visit or payment history, so it cannot be deleted. Mark them as inactive to keep your records.',
    );
  }
  await query('DELETE FROM customers WHERE id = $2 AND studio_id = $1', [user.studioId, id]);
}

export async function addNote(user: AuthUser, customerId: string, body: string) {
  await loadCustomer(user, customerId); // enforces studio + staff scope
  const { rows } = await query(
    `INSERT INTO customer_notes (customer_id, author_id, body) VALUES ($1, $2, $3)
     RETURNING id, body, created_at AS "createdAt"`,
    [customerId, user.id, body],
  );
  await logActivity({
    studioId: user.studioId,
    userId: user.id,
    customerId,
    action: 'note_added',
    description: 'A note was added',
  });
  return { ...rows[0], authorName: user.name };
}

export async function deleteNote(user: AuthUser, customerId: string, noteId: string) {
  await loadCustomer(user, customerId);
  const { rowCount } = await query('DELETE FROM customer_notes WHERE id = $1 AND customer_id = $2', [
    noteId,
    customerId,
  ]);
  if (!rowCount) throw notFound('That note');
}
