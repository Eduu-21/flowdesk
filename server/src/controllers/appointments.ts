import { currentUser } from '../middleware/auth';
import {
  appointmentListQuery,
  availabilityQuery,
  createAppointmentSchema,
  paymentListQuery,
  paymentSchema,
  updateAppointmentSchema,
} from '../schemas/appointments';
import { uuid } from '../schemas/common';
import * as appointments from '../services/appointments';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await appointments.listAppointments(currentUser(req), appointmentListQuery.parse(req.query)));
});

export const availability = asyncHandler(async (req, res) => {
  res.json(await appointments.getAvailability(currentUser(req), availabilityQuery.parse(req.query)));
});

export const get = asyncHandler(async (req, res) => {
  res.json(await appointments.getAppointment(currentUser(req), uuid.parse(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  const input = createAppointmentSchema.parse(req.body);
  res.status(201).json({ appointment: await appointments.createAppointment(currentUser(req), input) });
});

export const update = asyncHandler(async (req, res) => {
  const input = updateAppointmentSchema.parse(req.body);
  const appointment = await appointments.updateAppointment(currentUser(req), uuid.parse(req.params.id), input);
  res.json({ appointment });
});

export const remove = asyncHandler(async (req, res) => {
  await appointments.deleteAppointment(currentUser(req), uuid.parse(req.params.id));
  res.status(204).end();
});

export const setPayment = asyncHandler(async (req, res) => {
  const input = paymentSchema.parse(req.body);
  res.json(await appointments.setPayment(currentUser(req), uuid.parse(req.params.id), input));
});

export const listPayments = asyncHandler(async (req, res) => {
  res.json(await appointments.listPayments(currentUser(req), paymentListQuery.parse(req.query)));
});
