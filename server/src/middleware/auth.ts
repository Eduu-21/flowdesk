import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db/pool';
import type { AuthUser, Role } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { forbidden, unauthorized } from '../utils/errors';

interface TokenPayload {
  sub: string;
  tv: number;
  iat: number;
  exp: number;
}

/** Verifies the Bearer token and loads the current user (and their studio time zone). */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw unauthorized();

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret) as unknown as TokenPayload;
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const { rows } = await query(
    `SELECT u.id, u.studio_id AS "studioId", u.name, u.email, u.role, u.is_active AS "isActive",
            u.token_version AS "tokenVersion", s.timezone, st.id AS "staffId"
       FROM users u
       JOIN studios s ON s.id = u.studio_id
       LEFT JOIN staff st ON st.user_id = u.id
      WHERE u.id = $1`,
    [payload.sub],
  );
  const row = rows[0];
  if (!row || !row.isActive || row.tokenVersion !== payload.tv) {
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const user: AuthUser = {
    id: row.id,
    studioId: row.studioId,
    name: row.name,
    email: row.email,
    role: row.role,
    staffId: row.staffId ?? null,
    timezone: row.timezone,
    tokenTtl: payload.exp - payload.iat,
  };
  req.user = user;
  next();
});

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden('Only studio admins can do that.'));
    }
    next();
  };

export const requireAdmin = requireRole('admin');

/** Returns the authenticated user or throws (for use inside controllers). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
