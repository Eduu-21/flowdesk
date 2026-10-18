import { z } from 'zod';
import { avatarUrl, dateStr, email, optional, optionalPhone, password, timeStr } from './common';

export const staffSchema = z.object({
  name: z.string().trim().min(2, 'Enter the staff member name').max(120),
  email,
  phone: optionalPhone,
  roleTitle: z.string().trim().min(2, 'Enter a role, e.g. Stylist').max(80),
  specialties: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
  avatarUrl,
});

export const createStaffSchema = staffSchema.extend({
  /** When supplied, a login (role: staff) is created for this person. */
  password: z.union([z.literal(''), password]).optional(),
});

export const availabilitySchema = z.object({
  days: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          isWorking: z.boolean(),
          startTime: timeStr,
          endTime: timeStr,
        })
        .refine((d) => !d.isWorking || d.endTime > d.startTime, {
          path: ['endTime'],
          message: 'End time must be after start time',
        }),
    )
    .length(7, 'Provide all seven days')
    .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === 7, 'Each weekday must appear once'),
});

export const timeOffSchema = z
  .object({
    startDate: dateStr,
    endDate: dateStr,
    reason: z.string().trim().max(200).default(''),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before the start date',
  });

export const staffListQuery = z.object({
  status: optional(z.enum(['active', 'inactive'])),
  search: optional(z.string().trim().max(100)),
});
