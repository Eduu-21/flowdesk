/** Date helpers. Dates are "YYYY-MM-DD" strings, times are "HH:MM" strings. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Today in a given IANA time zone, as YYYY-MM-DD. */
export function todayIn(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return toISODate(new Date());
  }
}

/** Minutes since midnight right now in a given time zone. */
export function nowMinutes(timeZone?: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return h * 60 + m;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISODate(d);
}

export function startOfWeek(date: string): string {
  const d = parseDate(date);
  return addDays(date, -((d.getDay() + 6) % 7)); // Monday first
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 8)}01`;
}

export function endOfMonth(date: string): string {
  return addDays(addMonths(date, 1), -1);
}

export function dayOfWeek(date: string): number {
  return parseDate(date).getDay();
}

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (n: number): string => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', options).format(parseDate(date));
}

export const formatDateLong = (date: string) =>
  formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export const formatWeekday = (date: string) => formatDate(date, { weekday: 'short' });

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(toISODate(new Date(iso)));
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
