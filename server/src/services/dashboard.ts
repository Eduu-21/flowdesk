import { query } from '../db/pool';
import type { AuthUser } from '../types';
import { addDays, dayOfWeek, fromMinutes, startOfMonth, timeIn, todayIn, toMinutes } from '../utils/dates';
import { APPOINTMENT_SELECT } from './appointments';

export interface Insight {
  id: string;
  tone: 'attention' | 'info' | 'positive';
  text: string;
  link?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function getDashboard(user: AuthUser) {
  const tz = user.timezone;
  const today = todayIn(tz);
  const nowMinutes = toMinutes(timeIn(tz));
  const isAdmin = user.role === 'admin';
  const staffId = user.staffId ?? '00000000-0000-0000-0000-000000000000';

  const scopeSql = isAdmin ? '' : ' AND a.staff_id = $3';
  const scopeParams = isAdmin ? [user.studioId, today] : [user.studioId, today, staffId];

  const summaryRes = await query(
    `SELECT COUNT(*) FILTER (WHERE a.status <> 'cancelled') AS total,
            COUNT(*) FILTER (WHERE a.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE a.status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE a.status = 'no_show') AS "noShows",
            COUNT(*) FILTER (WHERE a.status IN ('pending', 'confirmed', 'checked_in', 'in_progress')) AS remaining
       FROM appointments a
      WHERE a.studio_id = $1 AND a.appointment_date = $2${scopeSql}`,
    scopeParams,
  );

  let revenue: number | null = null;
  if (isAdmin) {
    const r = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
        WHERE studio_id = $1 AND status IN ('paid', 'partial')
          AND (paid_at AT TIME ZONE $2)::date = $3::date`,
      [user.studioId, tz, today],
    );
    revenue = r.rows[0].total;
  }

  const flowRes = await query(
    `${APPOINTMENT_SELECT}
      WHERE a.studio_id = $1 AND a.appointment_date = $2 AND a.status <> 'cancelled'${scopeSql}
      ORDER BY a.start_time, st.name`,
    scopeParams,
  );
  const flow = flowRes.rows;

  /* --- open hours: hours where nobody starts an appointment but someone is free --- */
  const workers = await query(
    `SELECT st.id, av.start_time AS "start", av.end_time AS "end"
       FROM staff st
       JOIN staff_availability av ON av.staff_id = st.id AND av.day_of_week = $2 AND av.is_working
      WHERE st.studio_id = $1 AND st.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM staff_time_off t WHERE t.staff_id = st.id AND $3::date BETWEEN t.start_date AND t.end_date)
        ${isAdmin ? '' : 'AND st.id = $4'}`,
    isAdmin ? [user.studioId, dayOfWeek(today), today] : [user.studioId, dayOfWeek(today), today, staffId],
  );
  const availableSlots: { time: string; freeStaff: number }[] = [];
  if (workers.rows.length) {
    const open = Math.min(...workers.rows.map((w) => toMinutes(w.start)));
    const close = Math.max(...workers.rows.map((w) => toMinutes(w.end)));
    const busy = flow.filter((a) => a.status !== 'no_show');
    for (let h = Math.ceil(open / 60) * 60; h + 60 <= close; h += 60) {
      if (h < nowMinutes) continue;
      const startsHere = flow.some((a) => toMinutes(a.startTime) >= h && toMinutes(a.startTime) < h + 60);
      if (startsHere) continue;
      const free = workers.rows.filter((w) => {
        if (toMinutes(w.start) > h || toMinutes(w.end) < h + 60) return false;
        return !busy.some(
          (a) => a.staffId === w.id && toMinutes(a.startTime) < h + 60 && toMinutes(a.endTime) > h,
        );
      }).length;
      if (free > 0) availableSlots.push({ time: fromMinutes(h), freeStaff: free });
    }
  }

  /* --- smart insights --- */
  const insights: Insight[] = [];
  const pendingRes = await query(
    `SELECT COUNT(*) AS n FROM appointments a
      WHERE a.studio_id = $1 AND a.status = 'pending' AND a.appointment_date >= $2${scopeSql}`,
    scopeParams,
  );
  const pendingCount = pendingRes.rows[0].n;
  if (pendingCount > 0) {
    insights.push({
      id: 'unconfirmed',
      tone: 'attention',
      text: `You have ${plural(pendingCount, 'unconfirmed appointment', 'unconfirmed appointments')}.`,
      link: '/appointments?status=pending',
    });
  }

  const topParams: unknown[] = [user.studioId, startOfMonth(today), today];
  if (!isAdmin) topParams.push(staffId);
  const top = await query(
    `SELECT sv.name, COUNT(*) AS n
       FROM appointments a JOIN services sv ON sv.id = a.service_id
      WHERE a.studio_id = $1 AND a.appointment_date BETWEEN $2 AND $3
        AND a.status NOT IN ('cancelled', 'no_show')${isAdmin ? '' : ' AND a.staff_id = $4'}
      GROUP BY sv.name ORDER BY n DESC, sv.name LIMIT 1`,
    topParams,
  );
  if (top.rows[0]) {
    insights.push({
      id: 'top-service',
      tone: 'positive',
      text: `${top.rows[0].name} is your most booked service this month (${top.rows[0].n} bookings).`,
      link: '/analytics',
    });
  }

  if (isAdmin) {
    const lapsed = await query(
      `SELECT COUNT(*) AS n FROM customers c
        WHERE c.studio_id = $1 AND c.status = 'active'
          AND EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status = 'completed')
          AND NOT EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status = 'completed' AND l.appointment_date >= $2)
          AND NOT EXISTS (SELECT 1 FROM appointments l WHERE l.customer_id = c.id AND l.status IN ('pending', 'confirmed') AND l.appointment_date >= $3)`,
      [user.studioId, addDays(today, -30), today],
    );
    if (lapsed.rows[0].n > 0) {
      insights.push({
        id: 'lapsed',
        tone: 'info',
        text: `${plural(lapsed.rows[0].n, 'customer hasn’t', 'customers haven’t')} returned in 30+ days.`,
        link: '/customers?lapsed=1',
      });
    }
    const unpaid = await query(
      `SELECT COUNT(*) AS n FROM appointments
        WHERE studio_id = $1 AND status = 'completed' AND payment_status = 'unpaid' AND appointment_date <= $2`,
      [user.studioId, today],
    );
    if (unpaid.rows[0].n > 0) {
      insights.push({
        id: 'unpaid',
        tone: 'attention',
        text: `${plural(unpaid.rows[0].n, 'completed appointment is', 'completed appointments are')} still unpaid.`,
        link: '/appointments?status=completed&paymentStatus=unpaid',
      });
    }
  }
  if (!insights.length) {
    insights.push({ id: 'clear', tone: 'positive', text: 'Everything is up to date. Nicely done.' });
  }

  const s = summaryRes.rows[0];
  return {
    date: today,
    summary: {
      total: s.total,
      completed: s.completed,
      pending: s.pending,
      noShows: s.noShows,
      remaining: s.remaining,
      revenue,
    },
    flow,
    availableSlots,
    insights,
  };
}
