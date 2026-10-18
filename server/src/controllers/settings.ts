import { currentUser } from '../middleware/auth';
import { notificationPrefsSchema, profileSchema, studioSchema } from '../schemas/settings';
import * as settings from '../services/settings';
import { asyncHandler } from '../utils/asyncHandler';

export const getStudio = asyncHandler(async (req, res) => {
  res.json({ studio: await settings.getStudio(currentUser(req)) });
});

export const updateStudio = asyncHandler(async (req, res) => {
  const input = studioSchema.parse(req.body);
  res.json({ studio: await settings.updateStudio(currentUser(req), input) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const input = profileSchema.parse(req.body);
  res.json({ user: await settings.updateProfile(currentUser(req), input) });
});

export const updateNotificationPrefs = asyncHandler(async (req, res) => {
  const input = notificationPrefsSchema.parse(req.body);
  res.json({ user: await settings.updateNotificationPrefs(currentUser(req), input) });
});
