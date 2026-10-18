import { z } from 'zod';
import { isValidDate, isValidTimeZone } from '../utils/dates';

export const uuid = z.string().uuid('Invalid identifier');

export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(isValidDate, 'Enter a valid date');

export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM');

const PHONE_RE = /^\+?[0-9][0-9\s\-().]{5,19}$/;
export const phone = z.string().trim().regex(PHONE_RE, 'Enter a valid phone number');
export const optionalPhone = z.union([z.literal(''), phone]).default('');

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(200, 'Email is too long');
export const optionalEmail = z.union([z.literal(''), email]).default('');

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[0-9]/, 'Include at least one number');

export const timezone = z
  .string()
  .trim()
  .min(1, 'Choose a time zone')
  .refine(isValidTimeZone, 'Unknown time zone');

/** Image uploaded in the browser and sent as a small data URL (or an https link). */
export const avatarUrl = z
  .string()
  .max(400_000, 'That image is too large')
  .refine((v) => v === '' || v.startsWith('data:image/') || /^https?:\/\//.test(v), 'Invalid image')
  .nullable()
  .optional();

/** Treats empty query-string values as "not provided". */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(10),
};

export const sortOrder = z.enum(['asc', 'desc']).default('asc');
