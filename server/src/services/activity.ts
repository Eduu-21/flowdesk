import type { PoolClient } from 'pg';
import { pool } from '../db/pool';

interface ActivityInput {
  studioId: string;
  userId?: string | null;
  customerId?: string | null;
  appointmentId?: string | null;
  action: string;
  description: string;
}

/** Writes an entry to the customer/studio activity timeline. */
export async function logActivity(input: ActivityInput, client?: PoolClient): Promise<void> {
  const runner = client ?? pool;
  await runner.query(
    `INSERT INTO activity_logs (studio_id, user_id, customer_id, appointment_id, action, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.studioId,
      input.userId ?? null,
      input.customerId ?? null,
      input.appointmentId ?? null,
      input.action,
      input.description,
    ],
  );
}
