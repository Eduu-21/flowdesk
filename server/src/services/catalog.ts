import type { PoolClient } from 'pg';
import { likePattern, query, withTransaction } from '../db/pool';
import type { AuthUser } from '../types';
import { conflict, notFound } from '../utils/errors';

const SERVICE_SELECT = `
  SELECT sv.id, sv.name, sv.description, sv.duration_minutes AS "durationMinutes", sv.price,
         sv.is_active AS "isActive", cat.id AS "categoryId", cat.name AS category,
         (SELECT COUNT(*) FROM appointments a
           WHERE a.service_id = sv.id AND a.status NOT IN ('cancelled', 'no_show')) AS "bookingCount"
    FROM services sv
    JOIN service_categories cat ON cat.id = sv.category_id`;

export async function listServices(
  user: AuthUser,
  q: { search?: string; category?: string; active?: string },
) {
  const params: unknown[] = [user.studioId];
  let where = 'sv.studio_id = $1';
  if (q.search) {
    params.push(likePattern(q.search));
    where += ` AND (sv.name ILIKE $${params.length} OR sv.description ILIKE $${params.length})`;
  }
  if (q.category) {
    params.push(q.category);
    where += ` AND cat.name = $${params.length}`;
  }
  if (q.active) {
    params.push(q.active === 'true');
    where += ` AND sv.is_active = $${params.length}`;
  }
  const { rows } = await query(`${SERVICE_SELECT} WHERE ${where} ORDER BY cat.name, sv.name`, params);
  return { data: rows };
}

export async function listCategories(user: AuthUser) {
  const { rows } = await query(
    'SELECT id, name FROM service_categories WHERE studio_id = $1 ORDER BY name',
    [user.studioId],
  );
  return { data: rows };
}

async function findOrCreateCategory(client: PoolClient, studioId: string, name: string): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO service_categories (studio_id, name) VALUES ($1, $2)
     ON CONFLICT (studio_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [studioId, name],
  );
  return rows[0].id;
}

async function loadService(user: AuthUser, id: string) {
  const { rows } = await query(`${SERVICE_SELECT} WHERE sv.id = $2 AND sv.studio_id = $1`, [
    user.studioId,
    id,
  ]);
  if (!rows[0]) throw notFound('That service');
  return rows[0];
}

export interface ServiceInput {
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export async function createService(user: AuthUser, input: ServiceInput) {
  const id = await withTransaction(async (client) => {
    const categoryId = await findOrCreateCategory(client, user.studioId, input.category);
    const { rows } = await client.query(
      `INSERT INTO services (studio_id, category_id, name, description, duration_minutes, price, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user.studioId, categoryId, input.name, input.description, input.durationMinutes, input.price, input.isActive],
    );
    return rows[0].id as string;
  });
  return loadService(user, id);
}

export async function updateService(user: AuthUser, id: string, input: ServiceInput) {
  await loadService(user, id);
  await withTransaction(async (client) => {
    const categoryId = await findOrCreateCategory(client, user.studioId, input.category);
    await client.query(
      `UPDATE services
          SET category_id = $3, name = $4, description = $5, duration_minutes = $6, price = $7,
              is_active = $8, updated_at = now()
        WHERE id = $2 AND studio_id = $1`,
      [user.studioId, id, categoryId, input.name, input.description, input.durationMinutes, input.price, input.isActive],
    );
  });
  return loadService(user, id);
}

export async function setServiceActive(user: AuthUser, id: string, isActive: boolean) {
  const { rowCount } = await query(
    'UPDATE services SET is_active = $3, updated_at = now() WHERE id = $2 AND studio_id = $1',
    [user.studioId, id, isActive],
  );
  if (!rowCount) throw notFound('That service');
  return loadService(user, id);
}

export async function deleteService(user: AuthUser, id: string) {
  await loadService(user, id);
  const used = await query('SELECT COUNT(*) AS n FROM appointments WHERE service_id = $1', [id]);
  if (used.rows[0].n > 0) {
    throw conflict(
      'This service already has appointments, so it cannot be deleted. Deactivate it instead to hide it from new bookings.',
    );
  }
  await query('DELETE FROM services WHERE id = $2 AND studio_id = $1', [user.studioId, id]);
}
