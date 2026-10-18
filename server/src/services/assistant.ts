import { config } from '../config';
import { query } from '../db/pool';
import type { AuthUser } from '../types';
import { addDays, formatTime12, startOfMonth, startOfWeek, todayIn } from '../utils/dates';
import { APPOINTMENT_SELECT } from './appointments';
import { listCustomers } from './customers';

export interface AssistantItem {
  label: string;
  detail?: string;
  link?: string;
}

export interface AssistantReply {
  reply: string;
  items: AssistantItem[];
  suggestions: string[];
  source: 'built-in' | 'claude';
}

export const SUGGESTIONS = [
  'Which appointments do I have tomorrow?',
  'Show customers who haven’t visited in 30 days.',
  'What is my most popular service this month?',
  'How many appointments were cancelled this week?',
];

async function appointmentsOn(user: AuthUser, date: string) {
  const { rows } = await query(
    `${APPOINTMENT_SELECT}
      WHERE a.studio_id = $1 AND a.appointment_date = $2 AND a.status NOT IN ('cancelled', 'no_show')
      ORDER BY a.start_time`,
    [user.studioId, date],
  );
  return rows;
}

async function topServices(user: AuthUser, from: string, to: string) {
  const { rows } = await query(
    `SELECT sv.name, COUNT(*) AS count
       FROM appointments a JOIN services sv ON sv.id = a.service_id
      WHERE a.studio_id = $1 AND a.appointment_date BETWEEN $2 AND $3
        AND a.status NOT IN ('cancelled', 'no_show')
      GROUP BY sv.name ORDER BY count DESC, sv.name LIMIT 3`,
    [user.studioId, from, to],
  );
  return rows;
}

async function cancelledBetween(user: AuthUser, from: string, to: string) {
  const { rows } = await query(
    `SELECT a.id, c.name AS customer, sv.name AS service, a.appointment_date AS "date", a.start_time AS "startTime"
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       JOIN services sv ON sv.id = a.service_id
      WHERE a.studio_id = $1 AND a.status = 'cancelled' AND a.appointment_date BETWEEN $2 AND $3
      ORDER BY a.appointment_date DESC, a.start_time DESC`,
    [user.studioId, from, to],
  );
  return rows;
}

async function revenueBetween(user: AuthUser, from: string, to: string) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
      WHERE studio_id = $1 AND status IN ('paid', 'partial')
        AND (paid_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date`,
    [user.studioId, user.timezone, from, to],
  );
  return rows[0].total as number;
}

async function unpaidCompleted(user: AuthUser) {
  const { rows } = await query(
    `SELECT a.id, c.name AS customer, sv.name AS service, a.price, a.appointment_date AS "date"
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       JOIN services sv ON sv.id = a.service_id
      WHERE a.studio_id = $1 AND a.status = 'completed' AND a.payment_status IN ('unpaid', 'partial')
      ORDER BY a.appointment_date DESC LIMIT 10`,
    [user.studioId],
  );
  return rows;
}

const money = (n: number, currency = 'ETB') => `${currency} ${Math.round(n).toLocaleString('en-US')}`;

interface BuiltIn {
  reply: string;
  items: AssistantItem[];
  matched: boolean;
}

async function answerBuiltIn(user: AuthUser, message: string, currency: string): Promise<BuiltIn> {
  const text = message.toLowerCase();
  const today = todayIn(user.timezone);
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const listAppointments = (rows: any[]): AssistantItem[] =>
    rows.map((a) => ({
      label: `${formatTime12(a.startTime)} · ${a.customerName}`,
      detail: `${a.serviceName} with ${a.staffName}`,
      link: `/appointments/${a.id}`,
    }));

  if (/tomorrow/.test(text)) {
    const rows = await appointmentsOn(user, addDays(today, 1));
    return {
      matched: true,
      reply: rows.length
        ? `You have ${rows.length} appointment${rows.length === 1 ? '' : 's'} tomorrow.`
        : 'Nothing is booked for tomorrow yet.',
      items: listAppointments(rows),
    };
  }

  if (/(haven.?t|have not|not).*(visit|return|been|back)|inactive|lapsed|30\+? ?days|come back/.test(text)) {
    const res = await listCustomers(user, { lapsed: '1', sort: 'lastVisit', order: 'asc', page: 1, pageSize: 10 });
    return {
      matched: true,
      reply: res.total
        ? `${res.total} customer${res.total === 1 ? '' : 's'} haven’t visited in 30+ days.`
        : 'Every active customer has visited in the last 30 days.',
      items: res.data.map((c: any) => ({
        label: c.name,
        detail: c.lastVisit ? `Last visit ${c.lastVisit}` : 'No visits yet',
        link: `/customers/${c.id}`,
      })),
    };
  }

  if (/cancel/.test(text)) {
    const rows = await cancelledBetween(user, weekStart, addDays(weekStart, 6));
    return {
      matched: true,
      reply: `${rows.length} appointment${rows.length === 1 ? ' was' : 's were'} cancelled this week.`,
      items: rows.map((r) => ({
        label: r.customer,
        detail: `${r.service} · ${r.date} ${formatTime12(r.startTime)}`,
        link: `/appointments/${r.id}`,
      })),
    };
  }

  if (/popular|most booked|top service|best.*service|busiest service/.test(text)) {
    const rows = await topServices(user, monthStart, today);
    return {
      matched: true,
      reply: rows.length
        ? `${rows[0].name} is your most booked service this month with ${rows[0].count} bookings.`
        : 'There are no bookings this month yet.',
      items: rows.map((r) => ({ label: r.name, detail: `${r.count} bookings`, link: '/analytics' })),
    };
  }

  if (/revenue|earn|income|sales|money|made/.test(text)) {
    const [t, w, m] = await Promise.all([
      revenueBetween(user, today, today),
      revenueBetween(user, weekStart, today),
      revenueBetween(user, monthStart, today),
    ]);
    return {
      matched: true,
      reply: `Revenue so far: ${money(t, currency)} today, ${money(w, currency)} this week and ${money(m, currency)} this month.`,
      items: [{ label: 'Open analytics', link: '/analytics' }],
    };
  }

  if (/unpaid|outstanding|owe|owing/.test(text)) {
    const rows = await unpaidCompleted(user);
    return {
      matched: true,
      reply: rows.length
        ? `${rows.length} completed appointment${rows.length === 1 ? ' is' : 's are'} not fully paid.`
        : 'All completed appointments are paid.',
      items: rows.map((r) => ({
        label: r.customer,
        detail: `${r.service} · ${money(r.price, currency)}`,
        link: `/appointments/${r.id}`,
      })),
    };
  }

  if (/no.?show/.test(text)) {
    const { rows } = await query(
      `SELECT COUNT(*) AS n FROM appointments
        WHERE studio_id = $1 AND status = 'no_show' AND appointment_date BETWEEN $2 AND $3`,
      [user.studioId, weekStart, today],
    );
    return { matched: true, reply: `${rows[0].n} no-show${rows[0].n === 1 ? '' : 's'} this week.`, items: [] };
  }

  if (/today|schedule|agenda|appointments/.test(text)) {
    const rows = await appointmentsOn(user, today);
    return {
      matched: true,
      reply: rows.length
        ? `You have ${rows.length} appointment${rows.length === 1 ? '' : 's'} today.`
        : 'There are no appointments today.',
      items: listAppointments(rows),
    };
  }

  return {
    matched: false,
    reply:
      'I can help with your schedule, customers, services, cancellations and revenue. Try one of the questions below.',
    items: [],
  };
}

/** A compact, factual snapshot given to the language model (when configured). */
async function buildSnapshot(user: AuthUser, currency: string) {
  const today = todayIn(user.timezone);
  const weekStart = startOfWeek(today);
  const [todayRows, tomorrowRows, lapsed, top, cancelled, revToday, revWeek, revMonth, unpaid] = await Promise.all([
    appointmentsOn(user, today),
    appointmentsOn(user, addDays(today, 1)),
    listCustomers(user, { lapsed: '1', sort: 'lastVisit', order: 'asc', page: 1, pageSize: 15 }),
    topServices(user, startOfMonth(today), today),
    cancelledBetween(user, weekStart, addDays(weekStart, 6)),
    revenueBetween(user, today, today),
    revenueBetween(user, weekStart, today),
    revenueBetween(user, startOfMonth(today), today),
    unpaidCompleted(user),
  ]);
  const brief = (a: any) => ({
    time: a.startTime,
    customer: a.customerName,
    service: a.serviceName,
    staff: a.staffName,
    status: a.status,
  });
  return {
    today,
    currency,
    appointmentsToday: todayRows.map(brief),
    appointmentsTomorrow: tomorrowRows.map(brief),
    customersNotSeenIn30Days: lapsed.data.map((c: any) => ({ name: c.name, lastVisit: c.lastVisit })),
    topServicesThisMonth: top,
    cancelledThisWeek: cancelled.map((c) => ({ customer: c.customer, service: c.service, date: c.date })),
    revenue: { today: revToday, thisWeek: revWeek, thisMonth: revMonth },
    unpaidCompletedAppointments: unpaid.map((u) => ({ customer: u.customer, service: u.service, price: u.price })),
  };
}

async function answerWithClaude(user: AuthUser, message: string, currency: string): Promise<string> {
  const snapshot = await buildSnapshot(user, currency);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 500,
      system:
        'You are Flow Assistant inside FlowDesk, a management app for a beauty and wellness studio. ' +
        'Answer the owner’s question in two or three short sentences using ONLY the JSON data provided. ' +
        'If the data does not contain the answer, say so plainly. Never invent customers, numbers or dates.',
      messages: [
        { role: 'user', content: `Studio data:\n${JSON.stringify(snapshot)}\n\nQuestion: ${message}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Assistant provider responded with ${response.status}`);
  const body: any = await response.json();
  const text = body?.content?.find((c: any) => c.type === 'text')?.text;
  if (!text) throw new Error('Assistant provider returned no text');
  return String(text).trim();
}

export async function askAssistant(user: AuthUser, message: string): Promise<AssistantReply> {
  const studio = await query('SELECT currency FROM studios WHERE id = $1', [user.studioId]);
  const currency: string = studio.rows[0]?.currency ?? 'ETB';
  const builtIn = await answerBuiltIn(user, message, currency);

  if (config.anthropicApiKey) {
    try {
      const reply = await answerWithClaude(user, message, currency);
      return { reply, items: builtIn.items, suggestions: SUGGESTIONS, source: 'claude' };
    } catch (err) {
      console.error('Flow Assistant model unavailable, using built-in answers:', (err as Error).message);
    }
  }
  return { reply: builtIn.reply, items: builtIn.items, suggestions: SUGGESTIONS, source: 'built-in' };
}
