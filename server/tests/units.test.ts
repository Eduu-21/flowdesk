import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, formatTime12, startOfWeek, timeIn, todayIn, toMinutes } from '../src/utils/dates';
import { buildSlots } from '../src/utils/slots';
import { createAppointmentSchema } from '../src/schemas/appointments';
import { registerSchema } from '../src/schemas/auth';
import { customerSchema } from '../src/schemas/customers';

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds weekday and Monday of week', () => {
    expect(dayOfWeek('2026-10-06')).toBe(2); // Tuesday
    expect(startOfWeek('2026-10-06')).toBe('2026-10-05');
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28'); // Sunday belongs to the previous Monday
  });

  it('formats times', () => {
    expect(formatTime12('00:15')).toBe('12:15 AM');
    expect(formatTime12('13:30')).toBe('1:30 PM');
    expect(toMinutes('09:45')).toBe(585);
  });

  it('returns today and time in a given zone', () => {
    const instant = new Date('2026-10-06T21:30:00Z'); // already Oct 7 in Addis Ababa (UTC+3)
    expect(todayIn('Africa/Addis_Ababa', instant)).toBe('2026-10-07');
    expect(timeIn('Africa/Addis_Ababa', instant)).toBe('00:30');
  });
});

describe('slot builder', () => {
  it('lists slots that fit and skips busy ranges', () => {
    const slots = buildSlots({
      workStart: '09:00',
      workEnd: '12:00',
      durationMinutes: 60,
      busy: [{ start: '10:00', end: '11:00' }],
    });
    const starts = slots.map((s) => s.start);
    expect(starts).toContain('09:00');
    expect(starts).not.toContain('09:15'); // would overlap the 10:00 appointment
    expect(starts).not.toContain('10:00');
    expect(starts).toContain('11:00');
    expect(starts).not.toContain('11:15'); // would run past closing time
  });

  it('respects the earliest start for today', () => {
    const slots = buildSlots({
      workStart: '09:00',
      workEnd: '12:00',
      durationMinutes: 30,
      busy: [],
      notBefore: 10 * 60 + 15,
    });
    expect(slots[0].start).toBe('10:15');
  });
});

describe('validation schemas', () => {
  it('rejects weak passwords and mismatches', () => {
    const result = registerSchema.safeParse({
      name: 'Eden Bekele',
      studioName: 'Studio',
      email: 'eden@example.com',
      password: 'weakpass',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
  });

  it('validates customer phone numbers', () => {
    expect(customerSchema.safeParse({ name: 'Sara T', phone: 'abc' }).success).toBe(false);
    expect(customerSchema.safeParse({ name: 'Sara T', phone: '+251 91 112 3401' }).success).toBe(true);
  });

  it('validates appointment date and time formats', () => {
    const base = {
      customerId: '3f1c2d3e-0a4b-4c5d-8e6f-7a8b9c0d1e2f',
      serviceId: '3f1c2d3e-0a4b-4c5d-8e6f-7a8b9c0d1e2f',
      staffId: '3f1c2d3e-0a4b-4c5d-8e6f-7a8b9c0d1e2f',
    };
    expect(createAppointmentSchema.safeParse({ ...base, date: '2026-02-30', startTime: '10:00' }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...base, date: '2026-02-20', startTime: '25:00' }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...base, date: '2026-02-20', startTime: '10:00' }).success).toBe(true);
  });
});
