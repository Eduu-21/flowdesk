import { z } from 'zod';

const PHONE_RE = /^\+?[0-9][0-9\s\-().]{5,19}$/;

const email = z.string().trim().min(1, 'Enter your email').email('Enter a valid email address');
const phone = z.string().trim().regex(PHONE_RE, 'Enter a valid phone number, e.g. +251 91 123 4567');
const optionalPhone = z.union([z.literal(''), phone]);
const optionalEmail = z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]);

export const passwordRules = z
  .string()
  .min(8, 'Use at least 8 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

const money = z
  .number({ invalid_type_error: 'Enter an amount' })
  .min(0, 'Cannot be negative')
  .max(1_000_000, 'That amount is too high');

/* -------------------------------- auth -------------------------------- */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    studioName: z.string().trim().min(2, 'Enter your studio or business name'),
    email,
    password: passwordRules,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ password: passwordRules, confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ResetValues = z.infer<typeof resetSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordRules,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/* ------------------------------ customers ------------------------------ */
export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer’s name'),
  phone,
  email: optionalEmail,
  preferredService: z.string().trim().max(120),
  preferredStaff: z.string().trim().max(120),
  schedulingPreference: z.string().trim().max(200),
  status: z.enum(['active', 'inactive']),
});
export type CustomerValues = z.infer<typeof customerSchema>;

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write a note first').max(1000, 'Keep notes under 1000 characters'),
});
export type NoteValues = z.infer<typeof noteSchema>;

/* ------------------------------- services ------------------------------- */
export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Enter the service name'),
  category: z.string().trim().min(2, 'Choose or type a category'),
  description: z.string().trim().max(1000),
  durationMinutes: z
    .number({ invalid_type_error: 'Enter the duration in minutes' })
    .int('Use whole minutes')
    .min(5, 'At least 5 minutes')
    .max(720, 'No more than 12 hours'),
  price: money,
  isActive: z.boolean(),
});
export type ServiceValues = z.infer<typeof serviceSchema>;

/* --------------------------------- staff --------------------------------- */
export const staffSchema = z.object({
  name: z.string().trim().min(2, 'Enter the staff member’s name'),
  email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email address'),
  phone: optionalPhone,
  roleTitle: z.string().trim().min(2, 'Enter a role, e.g. Stylist'),
  specialties: z.string().trim().max(300),
  status: z.enum(['active', 'inactive']),
  password: z.union([z.literal(''), passwordRules]),
});
export type StaffValues = z.infer<typeof staffSchema>;

export const timeOffSchema = z
  .object({
    startDate: z.string().min(1, 'Choose a start date'),
    endDate: z.string().min(1, 'Choose an end date'),
    reason: z.string().trim().max(200),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before the start date',
  });
export type TimeOffValues = z.infer<typeof timeOffSchema>;

/* ------------------------------ appointments ------------------------------ */
export const appointmentEditSchema = z.object({
  serviceId: z.string().min(1, 'Choose a service'),
  staffId: z.string().min(1, 'Choose a staff member'),
  date: z.string().min(1, 'Choose a date'),
  startTime: z.string().min(1, 'Choose a time'),
  price: money,
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
});
export type AppointmentEditValues = z.infer<typeof appointmentEditSchema>;

export const paymentSchema = z.object({
  status: z.enum(['unpaid', 'partial', 'paid', 'refunded']),
  method: z.enum(['cash', 'bank_transfer', 'telebirr', 'card', 'other']),
  amount: z.number({ invalid_type_error: 'Enter an amount' }).min(0).max(1_000_000).optional().or(z.nan()),
});
export type PaymentValues = z.infer<typeof paymentSchema>;

/* -------------------------------- settings -------------------------------- */
export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  phone: optionalPhone,
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const studioSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name'),
  description: z.string().trim().max(1000),
  phone: optionalPhone,
  email: optionalEmail,
  address: z.string().trim().max(300),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter code such as ETB or USD'),
  timezone: z.string().trim().min(1, 'Choose a time zone'),
});
export type StudioValues = z.infer<typeof studioSchema>;
