import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config, isProduction } from '../config';
import { query, withTransaction } from '../db/pool';
import type { AuthUser } from '../types';
import { conflict, HttpError, unauthorized } from '../utils/errors';
import { sendPasswordReset } from './email';

const BCRYPT_ROUNDS = 10;

const USER_SELECT = `
  SELECT u.id, u.studio_id AS "studioId", u.name, u.email, u.role, u.phone,
         u.avatar_url AS "avatarUrl", u.notification_prefs AS "notificationPrefs",
         u.password_hash AS "passwordHash", u.is_active AS "isActive", u.token_version AS "tokenVersion",
         u.last_login_at AS "lastLoginAt", u.last_login_ip AS "lastLoginIp",
         u.last_login_agent AS "lastLoginAgent", u.created_at AS "createdAt",
         s.name AS "studioName", s.timezone, s.currency, st.id AS "staffId"
    FROM users u
    JOIN studios s ON s.id = u.studio_id
    LEFT JOIN staff st ON st.user_id = u.id`;

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  phone: string;
  avatarUrl: string | null;
  studioId: string;
  studioName: string;
  timezone: string;
  currency: string;
  staffId: string | null;
  notificationPrefs: Record<string, boolean>;
}

function toDto(row: any): UserDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    studioId: row.studioId,
    studioName: row.studioName,
    timezone: row.timezone,
    currency: row.currency,
    staffId: row.staffId ?? null,
    notificationPrefs: row.notificationPrefs,
  };
}

export async function loadUserDto(userId: string): Promise<UserDto> {
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  if (!rows[0]) throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  return toDto(rows[0]);
}

function signToken(user: { id: string; tokenVersion: number }, expiresIn: string | number): string {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, config.jwtSecret, {
    expiresIn,
  } as SignOptions);
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export interface RegisterInput {
  name: string;
  studioName: string;
  email: string;
  password: string;
}

export async function register(input: RegisterInput) {
  const existing = await query('SELECT 1 FROM users WHERE lower(email) = $1', [input.email]);
  if (existing.rowCount) {
    throw conflict('An account with this email already exists.', {
      email: 'An account with this email already exists.',
    });
  }
  const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const userId = await withTransaction(async (client) => {
    const studio = await client.query(
      `INSERT INTO studios (name, email) VALUES ($1, $2) RETURNING id`,
      [input.studioName, input.email],
    );
    const studioId = studio.rows[0].id as string;
    const user = await client.query(
      `INSERT INTO users (studio_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
      [studioId, input.name, input.email, hash],
    );
    const id = user.rows[0].id as string;

    for (const category of ['Hair', 'Nails', 'Beauty', 'Bridal']) {
      await client.query('INSERT INTO service_categories (studio_id, name) VALUES ($1, $2)', [
        studioId,
        category,
      ]);
    }
    // The owner is bookable by default so a new studio can take appointments right away.
    const staff = await client.query(
      `INSERT INTO staff (studio_id, user_id, name, email, role_title)
       VALUES ($1, $2, $3, $4, 'Owner') RETURNING id`,
      [studioId, id, input.name, input.email],
    );
    await client.query(
      `INSERT INTO staff_availability (staff_id, day_of_week, is_working, start_time, end_time)
       SELECT $1, d, d <> 0, '09:00', '17:00' FROM generate_series(0, 6) AS d`,
      [staff.rows[0].id],
    );
    await client.query(
      `INSERT INTO notifications (studio_id, user_id, type, title, message, link)
       VALUES ($1, NULL, 'system', 'Welcome to FlowDesk', 'Start by adding your services and team.', '/services')`,
      [studioId],
    );
    return id;
  });

  return finishLogin(userId, false, {});
}

export async function login(
  email: string,
  password: string,
  remember: boolean,
  meta: { ip?: string; agent?: string },
) {
  const { rows } = await query(`${USER_SELECT} WHERE lower(u.email) = $1`, [email]);
  const row = rows[0];
  const ok = row ? await bcrypt.compare(password, row.passwordHash) : false;
  if (!row || !ok) throw new HttpError(401, 'Incorrect email or password.', 'INVALID_CREDENTIALS');
  if (!row.isActive) {
    throw new HttpError(403, 'This account has been deactivated. Please contact your studio admin.', 'ACCOUNT_DISABLED');
  }
  return finishLogin(row.id, remember, meta);
}

async function finishLogin(userId: string, remember: boolean, meta: { ip?: string; agent?: string }) {
  await query(
    `UPDATE users SET last_login_at = now(), last_login_ip = $2, last_login_agent = $3 WHERE id = $1`,
    [userId, (meta.ip ?? '').slice(0, 80) || null, (meta.agent ?? '').slice(0, 300) || null],
  );
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  const row = rows[0];
  const token = signToken(row, remember ? config.jwtRememberExpiresIn : config.jwtExpiresIn);
  return { token, user: toDto(row) };
}

export async function getSessionInfo(userId: string) {
  const { rows } = await query(
    `SELECT last_login_at AS "lastLoginAt", last_login_ip AS "lastLoginIp",
            last_login_agent AS "lastLoginAgent", created_at AS "accountCreatedAt"
       FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0];
}

export async function changePassword(user: AuthUser, currentPassword: string, newPassword: string) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  const ok = rows[0] && (await bcrypt.compare(currentPassword, rows[0].password_hash));
  if (!ok) {
    throw new HttpError(400, 'Your current password is not correct.', 'WRONG_PASSWORD', {
      currentPassword: 'Your current password is not correct.',
    });
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  // Bumping token_version signs out every other device.
  const updated = await query(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now()
      WHERE id = $1 RETURNING id, token_version AS "tokenVersion"`,
    [user.id, hash],
  );
  return { token: signToken(updated.rows[0], user.tokenTtl) };
}

export async function logoutEverywhere(user: AuthUser) {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [user.id]);
}

export async function requestPasswordReset(email: string): Promise<{ devResetUrl?: string }> {
  const { rows } = await query(
    'SELECT id, name, is_active FROM users WHERE lower(email) = $1',
    [email],
  );
  const user = rows[0];
  if (!user || !user.is_active) return {};

  const token = crypto.randomBytes(32).toString('hex');
  await query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [user.id, sha256(token)],
  );
  const url = `${config.clientUrl}/reset-password?token=${token}`;
  await sendPasswordReset(email, user.name, url);

  // In local development without an email provider, hand the link back so the flow can be tried.
  if (!isProduction && !config.emailApiKey) return { devResetUrl: url };
  return {};
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const { rows } = await query(
    `SELECT id, user_id FROM password_reset_tokens
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) {
    throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.', 'INVALID_TOKEN');
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await withTransaction(async (client) => {
    await client.query(
      'UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now() WHERE id = $1',
      [row.user_id, hash],
    );
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [row.id]);
  });
}
