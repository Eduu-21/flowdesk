import { currentUser } from '../middleware/auth';
import { uuid } from '../schemas/common';
import { analyticsQuery, assistantSchema, notificationListQuery, searchQuery } from '../schemas/misc';
import { askAssistant, SUGGESTIONS } from '../services/assistant';
import { getAnalytics } from '../services/analytics';
import { getDashboard } from '../services/dashboard';
import * as notifications from '../services/notifications';
import { search } from '../services/search';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboard = asyncHandler(async (req, res) => {
  res.json(await getDashboard(currentUser(req)));
});

export const analytics = asyncHandler(async (req, res) => {
  const { range } = analyticsQuery.parse(req.query);
  res.json(await getAnalytics(currentUser(req), range));
});

export const searchAll = asyncHandler(async (req, res) => {
  const { q } = searchQuery.parse(req.query);
  res.json(await search(currentUser(req), q));
});

export const assistant = asyncHandler(async (req, res) => {
  const { message } = assistantSchema.parse(req.body);
  res.json(await askAssistant(currentUser(req), message));
});

export const assistantSuggestions = asyncHandler(async (_req, res) => {
  res.json({ suggestions: SUGGESTIONS });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const q = notificationListQuery.parse(req.query);
  res.json(
    await notifications.listNotifications(currentUser(req), { unread: q.unread === 'true', limit: q.limit }),
  );
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notifications.markRead(currentUser(req), uuid.parse(req.params.id));
  res.json({ notification, unreadCount: await notifications.unreadCount(currentUser(req)) });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notifications.markAllRead(currentUser(req));
  res.json({ unreadCount: 0 });
});
