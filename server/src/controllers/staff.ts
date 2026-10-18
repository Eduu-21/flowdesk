import { currentUser } from '../middleware/auth';
import { uuid } from '../schemas/common';
import {
  availabilitySchema,
  createStaffSchema,
  staffListQuery,
  staffSchema,
  timeOffSchema,
} from '../schemas/staff';
import * as staff from '../services/staff';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await staff.listStaff(currentUser(req), staffListQuery.parse(req.query)));
});

export const get = asyncHandler(async (req, res) => {
  res.json(await staff.getStaff(currentUser(req), uuid.parse(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  const input = createStaffSchema.parse(req.body);
  res.status(201).json({ staff: await staff.createStaff(currentUser(req), input) });
});

export const update = asyncHandler(async (req, res) => {
  const input = staffSchema.parse(req.body);
  res.json({ staff: await staff.updateStaff(currentUser(req), uuid.parse(req.params.id), input) });
});

export const saveAvailability = asyncHandler(async (req, res) => {
  const { days } = availabilitySchema.parse(req.body);
  res.json({ staff: await staff.saveAvailability(currentUser(req), uuid.parse(req.params.id), days) });
});

export const addTimeOff = asyncHandler(async (req, res) => {
  const input = timeOffSchema.parse(req.body);
  const timeOff = await staff.addTimeOff(currentUser(req), uuid.parse(req.params.id), input);
  res.status(201).json({ timeOff });
});

export const removeTimeOff = asyncHandler(async (req, res) => {
  await staff.removeTimeOff(currentUser(req), uuid.parse(req.params.id), uuid.parse(req.params.timeOffId));
  res.status(204).end();
});
