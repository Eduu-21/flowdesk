import { currentUser } from '../middleware/auth';
import { customerListQuery, customerNoteSchema, customerSchema } from '../schemas/customers';
import { uuid } from '../schemas/common';
import * as customers from '../services/customers';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  const q = customerListQuery.parse(req.query);
  res.json(await customers.listCustomers(currentUser(req), q));
});

export const get = asyncHandler(async (req, res) => {
  res.json(await customers.getCustomer(currentUser(req), uuid.parse(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  const input = customerSchema.parse(req.body);
  res.status(201).json({ customer: await customers.createCustomer(currentUser(req), input) });
});

export const update = asyncHandler(async (req, res) => {
  const input = customerSchema.parse(req.body);
  res.json({ customer: await customers.updateCustomer(currentUser(req), uuid.parse(req.params.id), input) });
});

export const remove = asyncHandler(async (req, res) => {
  await customers.deleteCustomer(currentUser(req), uuid.parse(req.params.id));
  res.status(204).end();
});

export const addNote = asyncHandler(async (req, res) => {
  const { body } = customerNoteSchema.parse(req.body);
  const note = await customers.addNote(currentUser(req), uuid.parse(req.params.id), body);
  res.status(201).json({ note });
});

export const deleteNote = asyncHandler(async (req, res) => {
  await customers.deleteNote(currentUser(req), uuid.parse(req.params.id), uuid.parse(req.params.noteId));
  res.status(204).end();
});
