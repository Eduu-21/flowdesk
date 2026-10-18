import { z } from 'zod';
import { optional } from './common';

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Enter the service name').max(120),
  category: z.string().trim().min(2, 'Choose or type a category').max(80),
  description: z.string().trim().max(1000).default(''),
  durationMinutes: z.coerce
    .number({ invalid_type_error: 'Enter the duration in minutes' })
    .int('Duration must be a whole number of minutes')
    .min(5, 'Duration must be at least 5 minutes')
    .max(720, 'Duration cannot exceed 12 hours'),
  price: z.coerce
    .number({ invalid_type_error: 'Enter a price' })
    .min(0, 'Price cannot be negative')
    .max(1_000_000, 'Price is too high'),
  isActive: z.boolean().default(true),
});

export const serviceActiveSchema = z.object({ isActive: z.boolean() });

export const serviceListQuery = z.object({
  search: optional(z.string().trim().max(100)),
  category: optional(z.string().trim().max(80)),
  active: optional(z.enum(['true', 'false'])),
});
