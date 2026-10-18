import { query } from '../db/pool';
import type { AuthUser } from '../types';
import { addDays, addMonths, startOfMonth, startOfWeek, todayIn } from '../utils/dates';

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`),
  );
const shortMonth = (date: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(new Date(`${date}T00:00:00Z`));

export async function getAnalytics(user: AuthUser, range: number) {
  const tz = user.timezone;
  const studioId = user.studioId;
  const today = todayIn(tz);
  const from = addDays(today, -(range - 1));

  /* ---------- revenue (from recorded payments) ---------- */
  const weekStarts = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(today), -7 * (7 - i)));
  const monthStarts = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(today), -(5 - i)));
  const since = [from, weekStarts[0], monthStarts[0]].sort()[0];

  const revenueRows = await query(
    `SELECT (p.paid_at AT TIME ZONE $2)::date AS "date", SUM(p.amount) AS revenue
       FROM payments p
      WHERE p.studio_id = $1 AND p.status IN ('paid', 'partial')
        AND (p.paid_at AT TIME ZONE $2)::date >= $3::date
      GROUP BY 1`,
    [studioId, tz, since],
  );
  const byDate = new Map<string, number>(revenueRows.rows.map((r) => [r.date as string, r.revenue as number]));
  const sumBetween = (a: string, b: string) => {
    let total = 0;
    for (const [d, v] of byDate) if (d >= a && d <= b) total += v;
    return total;
  };

  const daily = Array.from({ length: range }, (_, i) => {
    const date = addDays(from, i);
    return { date, label: shortDate(date), revenue: byDate.get(date) ?? 0 };
  });
  const weekly = weekStarts.map((ws) => ({
    label: shortDate(ws),
    revenue: sumBetween(ws, addDays(ws, 6) > today ? today : addDays(ws, 6)),
  }));
  const monthly = monthStarts.map((ms) => ({
    label: shortMonth(ms),
    revenue: sumBetween(ms, addDays(addMonths(ms, 1), -1)),
  }));
  const revenueInRange = daily.reduce((sum, d) => sum + d.revenue, 0);

  /* ---------- appointments ---------- */
  const statusRows = await query(
    `SELECT status, COUNT(*) AS count FROM appointments
      WHERE studio_id = $1 AND appointment_date BETWEEN $2 AND $3 GROUP BY status`,
    [studioId, from, today],
  );
  const statusCount = (s: string) => statusRows.rows.find((r) => r.status === s)?.count ?? 0;
  const upcoming = await query(
    `SELECT COUNT(*) AS n FROM appointments
      WHERE studio_id = $1 AND appointment_date >= $2 AND status IN ('pending', 'confirmed', 'checked_in')`,
    [studioId, today],
  );
  const totalInRange = statusRows.rows.reduce((sum, r) => sum + r.count, 0);
  const completed = statusCount('completed');

  /* ---------- popular services ---------- */
  const popular = await query(
    `SELECT sv.name, COUNT(*) AS count,
            COALESCE(SUM(a.price) FILTER (WHERE a.status = 'completed'), 0) AS revenue
       FROM appointments a JOIN services sv ON sv.id = a.service_id
      WHERE a.studio_id = $1 AND a.appointment_date BETWEEN $2 AND $3
        AND a.status NOT IN ('cancelled', 'no_show')
      GROUP BY sv.name ORDER BY count DESC, sv.name LIMIT 6`,
    [studioId, from, today],
  );

  /* ---------- staff performance ---------- */
  const staff = await query(
    `SELECT st.id, st.name, st.avatar_color AS color,
            COUNT(a.id) FILTER (WHERE a.status <> 'cancelled') AS total,
            COUNT(a.id) FILTER (WHERE a.status = 'completed') AS completed,
            COUNT(a.id) FILTER (WHERE a.status = 'no_show') AS "noShows",
            COALESCE(SUM(a.price) FILTER (WHERE a.status = 'completed'), 0) AS revenue
       FROM staff st
       LEFT JOIN appointments a ON a.staff_id = st.id AND a.appointment_date BETWEEN $2 AND $3
      WHERE st.studio_id = $1 AND st.status = 'active'
      GROUP BY st.id ORDER BY completed DESC, st.name`,
    [studioId, from, today],
  );

  /* ---------- customers ---------- */
  const newCustomers = await query(
    `SELECT COUNT(*) AS n FROM customers
      WHERE studio_id = $1 AND (created_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date`,
    [studioId, tz, from, today],
  );
  const returning = await query(
    `SELECT COUNT(DISTINCT a.customer_id) AS n FROM appointments a
      WHERE a.studio_id = $1 AND a.status = 'completed' AND a.appointment_date BETWEEN $2 AND $3
        AND EXISTS (SELECT 1 FROM appointments b WHERE b.customer_id = a.customer_id
                       AND b.status = 'completed' AND b.appointment_date < $2)`,
    [studioId, from, today],
  );
  const inactive = await query(
    `SELECT COUNT(*) AS n FROM customers c
      WHERE c.studio_id = $1 AND (
        c.status = 'inactive' OR (
          EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status = 'completed')
          AND NOT EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status = 'completed' AND l.appointment_date >= $2)
          AND NOT EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status IN ('pending', 'confirmed') AND l.appointment_date >= $3)))`,
    [studioId, addDays(today, -30), today],
  );

  /* ---------- payments ---------- */
  const methods = await query(
    `SELECT method, SUM(amount) AS amount, COUNT(*) AS count FROM payments
      WHERE studio_id = $1 AND status IN ('paid', 'partial')
        AND (paid_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
      GROUP BY method ORDER BY amount DESC`,
    [studioId, tz, from, today],
  );
  const paymentStatuses = await query(
    `SELECT payment_status AS status, COUNT(*) AS count FROM appointments
      WHERE studio_id = $1 AND appointment_date BETWEEN $2 AND $3 AND status <> 'cancelled'
      GROUP BY payment_status`,
    [studioId, from, today],
  );
  const outstanding = await query(
    `SELECT COALESCE(SUM(a.price - COALESCE((SELECT SUM(p.amount) FROM payments p
              WHERE p.appointment_id = a.id AND p.status IN ('paid', 'partial')), 0)), 0) AS total
       FROM appointments a
      WHERE a.studio_id = $1 AND a.status = 'completed' AND a.payment_status IN ('unpaid', 'partial')`,
    [studioId],
  );
  const recent = await query(
    `SELECT p.id, p.appointment_id AS "appointmentId", p.amount, p.method, p.status, p.paid_at AS "paidAt",
            c.name AS "customerName", sv.name AS "serviceName"
       FROM payments p
       JOIN appointments a ON a.id = p.appointment_id
       JOIN customers c ON c.id = p.customer_id
       JOIN services sv ON sv.id = a.service_id
      WHERE p.studio_id = $1 AND (p.paid_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
      ORDER BY p.paid_at DESC LIMIT 8`,
    [studioId, tz, from, today],
  );

  return {
    range: { days: range, from, to: today },
    totals: {
      revenue: revenueInRange,
      appointments: totalInRange,
      completed,
      cancelled: statusCount('cancelled'),
      noShow: statusCount('no_show'),
      upcoming: upcoming.rows[0].n,
      averageTicket: completed ? Math.round(revenueInRange / completed) : 0,
    },
    revenue: { daily, weekly, monthly },
    appointmentsByStatus: statusRows.rows.map((r) => ({ status: r.status, count: r.count })),
    popularServices: popular.rows,
    staffPerformance: staff.rows,
    customers: {
      new: newCustomers.rows[0].n,
      returning: returning.rows[0].n,
      inactive: inactive.rows[0].n,
    },
    payments: {
      byMethod: methods.rows,
      byStatus: paymentStatuses.rows,
      outstanding: outstanding.rows[0].total,
      recent: recent.rows,
    },
  };
}
