import { z } from 'zod';
import { APPOINTMENT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../types';
import { dateStr, optional, pagination, sortOrder, timeStr, uuid } from './common';

const price = z.coerce
  .number({ invalid_type_error: 'Enter a price' })
  .min(0, 'Price cannot be negative')
  .max(1_000_000, 'Price is too high');

export const createAppointmentSchema = z.object({
  customerId: uuid,
  serviceId: uuid,
  staffId: uuid,
  date: dateStr,
  startTime: timeStr,
  status: z.enum(['pending', 'confirmed']).default('confirmed'),
  notes: z.string().trim().max(1000, 'Notes are limited to 1000 characters').default(''),
  price: price.optional(),
});

export const updateAppointmentSchema = z
  .object({
    customerId: uuid,
    serviceId: uuid,
    staffId: uuid,
    date: dateStr,
    startTime: timeStr,
    status: z.enum(APPOINTMENT_STATUSES),
    notes: z.string().trim().max(1000, 'Notes are limited to 1000 characters'),
    price,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const paymentSchema = z.object({
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(PAYMENT_METHODS).optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative').max(1_000_000).optional(),
});

export const appointmentListQuery = z.object({
  from: optional(dateStr),
  to: optional(dateStr),
  status: optional(z.string().max(120)), // comma separated list
  paymentStatus: optional(z.enum(PAYMENT_STATUSES)),
  staffId: optional(uuid),
  customerId: optional(uuid),
  serviceId: optional(uuid),
  search: optional(z.string().trim().max(100)),
  sort: z.enum(['date', 'customer', 'service', 'staff', 'status', 'price']).default('date'),
  order: sortOrder,
  ...pagination,
});

export const availabilityQuery = z.object({
  staffId: uuid,
  serviceId: uuid,
  date: dateStr,
  excludeId: optional(uuid),
});

export const paymentListQuery = z.object({
  from: optional(dateStr),
  to: optional(dateStr),
  method: optional(z.enum(PAYMENT_METHODS)),
  status: optional(z.enum(PAYMENT_STATUSES)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
});
