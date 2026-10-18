import { query, withTransaction } from '../db/pool';
import type { AuthUser } from '../types';
import { conflict, notFound } from '../utils/errors';
import { loadUserDto } from './auth';

export async function getStudio(user: AuthUser) {
  const { rows } = await query(
    `SELECT id, name, description, phone, email, address, currency, timezone
       FROM studios WHERE id = $1`,
    [user.studioId],
  );
  if (!rows[0]) throw notFound('Your studio');
  return rows[0];
}

export async function updateStudio(
  user: AuthUser,
  input: {
    name: string;
    description: string;
    phone: string;
    email: string;
    address: string;
    currency: string;
    timezone: string;
  },
) {
  const { rows } = await query(
    `UPDATE studios
        SET name = $2, description = $3, phone = $4, email = $5, address = $6,
            currency = $7, timezone = $8, updated_at = now()
      WHERE id = $1
      RETURNING id, name, description, phone, email, address, currency, timezone`,
    [
      user.studioId,
      input.name,
      input.description,
      input.phone,
      input.email,
      input.address,
      input.currency,
      input.timezone,
    ],
  );
  return rows[0];
}

export async function updateProfile(
  user: AuthUser,
  input: { name: string; email: string; phone: string; avatarUrl?: string | null },
) {
  const clash = await query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [
    input.email,
    user.id,
  ]);
  if (clash.rowCount) {
    throw conflict('Another account already uses this email.', {
      email: 'Another account already uses this email.',
    });
  }
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET name = $2, email = $3, phone = $4,
              avatar_url = CASE WHEN $5::boolean THEN $6 ELSE avatar_url END, updated_at = now()
        WHERE id = $1`,
      [user.id, input.name, input.email, input.phone, input.avatarUrl !== undefined, input.avatarUrl ?? null],
    );
    // Keep the linked staff profile in sync.
    await client.query(
      `UPDATE staff SET name = $2, email = $3, phone = $4,
              avatar_url = CASE WHEN $5::boolean THEN $6 ELSE avatar_url END, updated_at = now()
        WHERE user_id = $1`,
      [user.id, input.name, input.email, input.phone, input.avatarUrl !== undefined, input.avatarUrl ?? null],
    );
  });
  return loadUserDto(user.id);
}

export async function updateNotificationPrefs(user: AuthUser, prefs: Record<string, boolean>) {
  await query('UPDATE users SET notification_prefs = $2::jsonb, updated_at = now() WHERE id = $1', [
    user.id,
    JSON.stringify(prefs),
  ]);
  return loadUserDto(user.id);
}
