import { z } from 'zod';
import { avatarUrl, email, optionalPhone, timezone } from './common';

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email,
  phone: optionalPhone,
  avatarUrl,
});

export const studioSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name').max(150),
  description: z.string().trim().max(1000).default(''),
  phone: optionalPhone,
  email: z.union([z.literal(''), email]).default(''),
  address: z.string().trim().max(300).default(''),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code such as ETB or USD'),
  timezone,
});

export const notificationPrefsSchema = z.object({
  appointment_reminders: z.boolean(),
  email_notifications: z.boolean(),
  booking_notifications: z.boolean(),
  cancellation_notifications: z.boolean(),
});
