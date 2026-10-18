import { describe, expect, it } from 'vitest';
import { layoutDay } from '@/lib/calendarLayout';
import { addDays, endOfMonth, formatTime, formatTimeRange, startOfMonth, startOfWeek, toMinutes } from '@/lib/dates';
import { formatDuration, formatMoney, initials, plural } from '@/lib/format';
import { changePasswordSchema, customerSchema, loginSchema, timeOffSchema } from '@/schemas';

describe('dates', () => {
  it('formats times in 12-hour clock', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('13:30')).toBe('1:30 PM');
    expect(formatTimeRange('09:00', '10:15')).toBe('9:00 AM – 10:15 AM');
  });

  it('converts to minutes', () => {
    expect(toMinutes('01:30')).toBe(90);
  });

  it('does date arithmetic across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(startOfMonth('2026-10-17')).toBe('2026-10-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });

  it('starts the week on Monday', () => {
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12'); // Wednesday -> Monday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // Sunday -> previous Monday
  });
});

describe('format', () => {
  it('formats money with the currency code', () => {
    expect(formatMoney(1200, 'ETB')).toMatch(/ETB\s1,200/);
  });
  it('formats durations, initials and plurals', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(initials('eden bekele zab')).toBe('EB');
    expect(plural(1, 'service')).toBe('1 service');
    expect(plural(3, 'service')).toBe('3 services');
  });
});

describe('calendar layout', () => {
  it('puts overlapping appointments in separate lanes', () => {
    const placed = layoutDay([
      { id: 'a', startTime: '09:00', endTime: '10:00' },
      { id: 'b', startTime: '09:30', endTime: '10:30' },
      { id: 'c', startTime: '11:00', endTime: '12:00' },
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(byId.a.lane).not.toBe(byId.b.lane);
    expect(byId.a.lanes).toBe(2);
    expect(byId.c.lanes).toBe(1);
    expect(byId.c.lane).toBe(0);
  });
});

describe('form schemas', () => {
  it('validates login', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x', remember: false }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'demo@flowdesk.local', password: 'x', remember: true }).success).toBe(true);
  });

  it('enforces password strength and confirmation', () => {
    const base = { currentPassword: 'old', newPassword: 'Strong123', confirmPassword: 'Strong123' };
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...base, newPassword: 'weak', confirmPassword: 'weak' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...base, confirmPassword: 'Different123' }).success).toBe(false);
  });

  it('validates customers', () => {
    const ok = { name: 'Hana Tesfaye', phone: '+251 91 123 4567', email: '', preferredService: '', preferredStaff: '', schedulingPreference: '', status: 'active' };
    expect(customerSchema.safeParse(ok).success).toBe(true);
    expect(customerSchema.safeParse({ ...ok, phone: 'abc' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...ok, email: 'bad' }).success).toBe(false);
  });

  it('rejects time off that ends before it starts', () => {
    expect(timeOffSchema.safeParse({ startDate: '2026-10-10', endDate: '2026-10-09', reason: '' }).success).toBe(false);
    expect(timeOffSchema.safeParse({ startDate: '2026-10-10', endDate: '2026-10-10', reason: '' }).success).toBe(true);
  });
});
