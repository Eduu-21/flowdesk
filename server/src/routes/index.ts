import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isProduction, isTest } from '../config';
import * as appointments from '../controllers/appointments';
import * as auth from '../controllers/auth';
import * as catalog from '../controllers/catalog';
import * as customers from '../controllers/customers';
import * as misc from '../controllers/misc';
import * as settings from '../controllers/settings';
import * as staff from '../controllers/staff';
import { authenticate, requireAdmin } from '../middleware/auth';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 25 : 500,
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' } },
});

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ---------------- authentication ---------------- */
api.post('/auth/register', authLimiter, auth.register);
api.post('/auth/login', authLimiter, auth.login);
api.post('/auth/forgot-password', authLimiter, auth.forgotPassword);
api.post('/auth/reset-password', authLimiter, auth.resetPassword);
api.post('/auth/logout', auth.logout);

/* everything below requires a signed-in user */
api.use(authenticate);

api.get('/auth/me', auth.me);
api.get('/auth/session', auth.session);
api.put('/auth/password', auth.changePassword);
api.post('/auth/logout-all', auth.logoutAll);

/* ---------------- settings ---------------- */
api.get('/settings/studio', settings.getStudio);
api.put('/settings/studio', requireAdmin, settings.updateStudio);
api.put('/settings/profile', settings.updateProfile);
api.put('/settings/notifications', settings.updateNotificationPrefs);

/* ---------------- dashboard, search, assistant ---------------- */
api.get('/dashboard', misc.dashboard);
api.get('/search', misc.searchAll);
api.get('/assistant/suggestions', requireAdmin, misc.assistantSuggestions);
api.post('/assistant', requireAdmin, misc.assistant);

/* ---------------- customers ---------------- */
api.get('/customers', customers.list);
api.post('/customers', requireAdmin, customers.create);
api.get('/customers/:id', customers.get);
api.put('/customers/:id', requireAdmin, customers.update);
api.delete('/customers/:id', requireAdmin, customers.remove);
api.post('/customers/:id/notes', customers.addNote);
api.delete('/customers/:id/notes/:noteId', requireAdmin, customers.deleteNote);

/* ---------------- services ---------------- */
api.get('/services', catalog.list);
api.get('/services/categories', catalog.categories);
api.post('/services', requireAdmin, catalog.create);
api.put('/services/:id', requireAdmin, catalog.update);
api.patch('/services/:id/active', requireAdmin, catalog.setActive);
api.delete('/services/:id', requireAdmin, catalog.remove);

/* ---------------- staff ---------------- */
api.get('/staff', staff.list);
api.post('/staff', requireAdmin, staff.create);
api.get('/staff/:id', staff.get);
api.put('/staff/:id', requireAdmin, staff.update);
api.put('/staff/:id/availability', staff.saveAvailability); // admin or the staff member themselves
api.post('/staff/:id/time-off', staff.addTimeOff);
api.delete('/staff/:id/time-off/:timeOffId', staff.removeTimeOff);

/* ---------------- appointments & payments ---------------- */
api.get('/appointments', appointments.list);
api.get('/appointments/availability', appointments.availability);
api.post('/appointments', requireAdmin, appointments.create);
api.get('/appointments/:id', appointments.get);
api.put('/appointments/:id', appointments.update); // staff may change status/notes only
api.delete('/appointments/:id', requireAdmin, appointments.remove);
api.put('/appointments/:id/payment', requireAdmin, appointments.setPayment);
api.get('/payments', requireAdmin, appointments.listPayments);

/* ---------------- analytics ---------------- */
api.get('/analytics', requireAdmin, misc.analytics);

/* ---------------- notifications ---------------- */
api.get('/notifications', misc.listNotifications);
api.put('/notifications/read-all', misc.markAllNotificationsRead);
api.put('/notifications/:id/read', misc.markNotificationRead);
