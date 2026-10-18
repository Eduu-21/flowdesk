import { likePattern, query } from '../db/pool';
import type { AuthUser } from '../types';
import { listAppointments } from './appointments';
import { listCustomers } from './customers';

/** Global search across customers, appointments and services. */
export async function search(user: AuthUser, q: string) {
  const customers = await listCustomers(user, {
    search: q,
    sort: 'name',
    order: 'asc',
    page: 1,
    pageSize: 6,
  });
  const appointments = await listAppointments(user, {
    search: q,
    sort: 'date',
    order: 'desc',
    page: 1,
    pageSize: 6,
  });
  const services = await query(
    `SELECT sv.id, sv.name, cat.name AS category, sv.price, sv.duration_minutes AS "durationMinutes"
       FROM services sv JOIN service_categories cat ON cat.id = sv.category_id
      WHERE sv.studio_id = $1 AND (sv.name ILIKE $2 OR cat.name ILIKE $2)
      ORDER BY sv.name LIMIT 6`,
    [user.studioId, likePattern(q)],
  );

  return {
    customers: customers.data.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
    appointments: appointments.data.map((a) => ({
      id: a.id,
      customerName: a.customerName,
      serviceName: a.serviceName,
      staffName: a.staffName,
      date: a.date,
      startTime: a.startTime,
      status: a.status,
    })),
    services: services.rows,
  };
}
