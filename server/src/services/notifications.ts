import { query } from '../db/pool';
import type { AuthUser } from '../types';
import { formatTime12 } from '../utils/dates';
import { notFound } from '../utils/errors';
import {
  sendAppointmentCancellation,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
} from './email';

export type NotificationType =
  | 'booking'
  | 'confirmation'
  | 'cancellation'
  | 'reminder'
  | 'payment'
  | 'insight'
  | 'system';

interface NewNotification {
  studioId: string;
  /** null = visible to studio admins */
  userId: string | null;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}

export async function createNotification(n: NewNotification): Promise<void> {
  await query(
    `INSERT INTO notifications (studio_id, user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [n.studioId, n.userId, n.type, n.title, n.message ?? '', n.link ?? null],
  );
}

export interface StudioPrefs {
  appointment_reminders: boolean;
  email_notifications: boolean;
  booking_notifications: boolean;
  cancellation_notifications: boolean;
}

/** Studio-wide preferences are those of the studio owner (first admin account). */
export async function getStudioPrefs(studioId: string): Promise<StudioPrefs> {
  const { rows } = await query(
    `SELECT notification_prefs FROM users
      WHERE studio_id = $1 AND role = 'admin' AND is_active
      ORDER BY created_at LIMIT 1`,
    [studioId],
  );
  return {
    appointment_reminders: true,
    email_notifications: true,
    booking_notifications: true,
    cancellation_notifications: true,
    ...(rows[0]?.notification_prefs ?? {}),
  };
}

export interface AppointmentEventData {
  id: string;
  studioId: string;
  studioName: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  staffName: string;
  staffUserId: string | null;
  date: string;
  startTime: string;
}

export async function loadEventData(appointmentId: string): Promise<AppointmentEventData | null> {
  const { rows } = await query<AppointmentEventData>(
    `SELECT a.id, a.studio_id AS "studioId", s.name AS "studioName", c.name AS "customerName",
            c.email AS "customerEmail", sv.name AS "serviceName", st.name AS "staffName",
            st.user_id AS "staffUserId", a.appointment_date AS "date", a.start_time AS "startTime"
       FROM appointments a
       JOIN studios s ON s.id = a.studio_id
       JOIN customers c ON c.id = a.customer_id
       JOIN services sv ON sv.id = a.service_id
       JOIN staff st ON st.id = a.staff_id
      WHERE a.id = $1`,
    [appointmentId],
  );
  return rows[0] ?? null;
}

const toEmail = (d: AppointmentEventData) => ({
  studioName: d.studioName,
  customerName: d.customerName,
  customerEmail: d.customerEmail,
  serviceName: d.serviceName,
  staffName: d.staffName,
  date: d.date,
  startTime: d.startTime,
});

/** Creates the in-app notifications and emails that follow an appointment event. */
export async function notifyAppointmentEvent(
  kind: 'booked' | 'confirmed' | 'confirmation_email' | 'cancelled',
  appointmentId: string,
): Promise<void> {
  try {
    const d = await loadEventData(appointmentId);
    if (!d) return;
    const prefs = await getStudioPrefs(d.studioId);
    const link = `/appointments/${d.id}`;
    const when = `${d.date} at ${formatTime12(d.startTime)}`;
    const targets: (string | null)[] = [null];
    if (d.staffUserId) targets.push(d.staffUserId);

    // Email only (used when an appointment is created already confirmed).
    if (kind === 'confirmation_email') {
      if (prefs.email_notifications && d.customerEmail) await sendAppointmentConfirmation(toEmail(d));
      return;
    }

    if (kind === 'booked' && prefs.booking_notifications) {
      for (const userId of targets) {
        await createNotification({
          studioId: d.studioId,
          userId,
          type: 'booking',
          title: `New booking: ${d.customerName}`,
          message: `${d.serviceName} with ${d.staffName}, ${when}`,
          link,
        });
      }
    }
    if (kind === 'confirmed') {
      for (const userId of targets) {
        await createNotification({
          studioId: d.studioId,
          userId,
          type: 'confirmation',
          title: `${d.customerName} is confirmed`,
          message: `${d.serviceName}, ${when}`,
          link,
        });
      }
      if (prefs.email_notifications && d.customerEmail) await sendAppointmentConfirmation(toEmail(d));
    }
    if (kind === 'cancelled' && prefs.cancellation_notifications) {
      for (const userId of targets) {
        await createNotification({
          studioId: d.studioId,
          userId,
          type: 'cancellation',
          title: `${d.customerName} cancelled`,
          message: `${d.serviceName}, ${when}`,
          link,
        });
      }
      if (prefs.email_notifications && d.customerEmail) await sendAppointmentCancellation(toEmail(d));
    }
  } catch (err) {
    console.error('Could not create notifications:', (err as Error).message);
  }
}

/**
 * Finds appointments starting within the next hour that have not had a reminder yet,
 * notifies the team and emails the customer. Runs on a timer and when the
 * notification list is opened.
 */
export async function generateReminders(studioId?: string): Promise<number> {
  const params: unknown[] = [];
  let studioFilter = '';
  if (studioId) {
    params.push(studioId);
    studioFilter = 'AND a.studio_id = $1';
  }
  const { rows } = await query<AppointmentEventData>(
    `UPDATE appointments a
        SET reminder_sent_at = now()
       FROM studios s, customers c, services sv, staff st
      WHERE s.id = a.studio_id AND c.id = a.customer_id AND sv.id = a.service_id AND st.id = a.staff_id
        AND a.reminder_sent_at IS NULL
        AND a.status IN ('pending', 'confirmed')
        AND (a.appointment_date + a.start_time)
            BETWEEN (now() AT TIME ZONE s.timezone) AND (now() AT TIME ZONE s.timezone) + interval '60 minutes'
        ${studioFilter}
      RETURNING a.id, a.studio_id AS "studioId", s.name AS "studioName", c.name AS "customerName",
                c.email AS "customerEmail", sv.name AS "serviceName", st.name AS "staffName",
                st.user_id AS "staffUserId", a.appointment_date AS "date", a.start_time AS "startTime"`,
    params,
  );

  for (const d of rows) {
    try {
      const prefs = await getStudioPrefs(d.studioId);
      if (prefs.appointment_reminders) {
        const targets: (string | null)[] = [null];
        if (d.staffUserId) targets.push(d.staffUserId);
        for (const userId of targets) {
          await createNotification({
            studioId: d.studioId,
            userId,
            type: 'reminder',
            title: `Your ${formatTime12(d.startTime)} appointment starts soon`,
            message: `${d.customerName} - ${d.serviceName} with ${d.staffName}`,
            link: `/appointments/${d.id}`,
          });
        }
        if (prefs.email_notifications && d.customerEmail) await sendAppointmentReminder(toEmail(d));
      }
    } catch (err) {
      console.error('Reminder failed:', (err as Error).message);
    }
  }
  return rows.length;
}

/** Notifications visible to a user: their own plus, for admins, studio-wide ones. */
const visibility = (user: AuthUser) =>
  user.role === 'admin' ? '(user_id = $2 OR user_id IS NULL)' : 'user_id = $2';

export async function listNotifications(user: AuthUser, opts: { unread?: boolean; limit: number }) {
  await generateReminders(user.studioId);
  const filter = visibility(user);
  const { rows } = await query(
    `SELECT id, type, title, message, link, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications
      WHERE studio_id = $1 AND ${filter} ${opts.unread ? 'AND NOT is_read' : ''}
      ORDER BY created_at DESC LIMIT $3`,
    [user.studioId, user.id, opts.limit],
  );
  const count = await unreadCount(user);
  return { data: rows, unreadCount: count };
}

export async function unreadCount(user: AuthUser): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*) AS n FROM notifications WHERE studio_id = $1 AND ${visibility(user)} AND NOT is_read`,
    [user.studioId, user.id],
  );
  return rows[0].n;
}

export async function markRead(user: AuthUser, id: string) {
  const { rows } = await query(
    `UPDATE notifications SET is_read = TRUE
      WHERE id = $3 AND studio_id = $1 AND ${visibility(user)}
      RETURNING id, type, title, message, link, is_read AS "isRead", created_at AS "createdAt"`,
    [user.studioId, user.id, id],
  );
  if (!rows[0]) throw notFound('That notification');
  return rows[0];
}

export async function markAllRead(user: AuthUser): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = TRUE
      WHERE studio_id = $1 AND ${visibility(user)} AND NOT is_read`,
    [user.studioId, user.id],
  );
}
