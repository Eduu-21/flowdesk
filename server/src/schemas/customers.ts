import { z } from 'zod';
import { optional, optionalEmail, pagination, phone, sortOrder } from './common';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name').max(120),
  phone,
  email: optionalEmail,
  preferredService: z.string().trim().max(120).default(''),
  preferredStaff: z.string().trim().max(120).default(''),
  schedulingPreference: z.string().trim().max(200).default(''),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const customerNoteSchema = z.object({
  body: z.string().trim().min(1, 'Write a note first').max(1000, 'Notes are limited to 1000 characters'),
});

export const customerListQuery = z.object({
  search: optional(z.string().trim().max(100)),
  status: optional(z.enum(['active', 'inactive'])),
  lapsed: optional(z.enum(['1', 'true'])),
  sort: z
    .enum(['name', 'createdAt', 'appointmentCount', 'lastVisit', 'totalSpent'])
    .default('name'),
  order: sortOrder,
  ...pagination,
});
