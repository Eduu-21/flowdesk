import type { AppointmentStatus, PaymentMethod, PaymentStatus } from '@/types';

export function formatMoney(amount: number, currency = 'ETB'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace(/\u00a0/g, ' ');
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
  }
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

/** Badge colours, chosen to stay readable (AA) on ivory. */
export const STATUS_STYLES: Record<AppointmentStatus, { badge: string; dot: string }> = {
  pending: { badge: 'bg-champagne-100 text-champagne-600', dot: 'bg-champagne' },
  confirmed: { badge: 'bg-lavender text-plum-700', dot: 'bg-plum-500' },
  checked_in: { badge: 'bg-mauve-100 text-plum-800', dot: 'bg-mauve' },
  in_progress: { badge: 'bg-berry-100 text-berry', dot: 'bg-berry' },
  completed: { badge: 'bg-sage-100 text-sage', dot: 'bg-sage' },
  cancelled: { badge: 'bg-cream text-ink-mute', dot: 'bg-sand' },
  no_show: { badge: 'bg-rose-100 text-berry', dot: 'bg-rose' },
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  refunded: 'Refunded',
};

export const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  unpaid: 'bg-cream text-ink-soft',
  partial: 'bg-champagne-100 text-champagne-600',
  paid: 'bg-sage-100 text-sage',
  refunded: 'bg-mauve-100 text-plum-800',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  telebirr: 'Telebirr',
  card: 'Card',
  other: 'Other',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};
