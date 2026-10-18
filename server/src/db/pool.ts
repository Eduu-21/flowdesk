import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { config } from '../config';

// Return plain strings/numbers so the API never suffers time-zone surprises:
//   DATE    -> "YYYY-MM-DD"
//   TIME    -> "HH:MM"
//   NUMERIC -> number
//   BIGINT  -> number (counts)
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1083, (v) => v.slice(0, 5));
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

export function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Escapes % and _ so user search text is matched literally by ILIKE. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
