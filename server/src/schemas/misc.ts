import { z } from 'zod';
import { optional } from './common';

export const notificationListQuery = z.object({
  unread: optional(z.enum(['true', 'false'])),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const analyticsQuery = z.object({
  range: z.coerce.number().int().refine((v) => [7, 30, 90].includes(v), 'Range must be 7, 30 or 90').default(30),
});

export const searchQuery = z.object({
  q: z.string().trim().min(1, 'Type something to search').max(100),
});

export const assistantSchema = z.object({
  message: z.string().trim().min(1, 'Ask a question first').max(500, 'Please keep questions under 500 characters'),
});
