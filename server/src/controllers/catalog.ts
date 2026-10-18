import { currentUser } from '../middleware/auth';
import { serviceActiveSchema, serviceListQuery, serviceSchema } from '../schemas/catalog';
import { uuid } from '../schemas/common';
import * as catalog from '../services/catalog';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req, res) => {
  res.json(await catalog.listServices(currentUser(req), serviceListQuery.parse(req.query)));
});

export const categories = asyncHandler(async (req, res) => {
  res.json(await catalog.listCategories(currentUser(req)));
});

export const create = asyncHandler(async (req, res) => {
  const input = serviceSchema.parse(req.body);
  res.status(201).json({ service: await catalog.createService(currentUser(req), input) });
});

export const update = asyncHandler(async (req, res) => {
  const input = serviceSchema.parse(req.body);
  res.json({ service: await catalog.updateService(currentUser(req), uuid.parse(req.params.id), input) });
});

export const setActive = asyncHandler(async (req, res) => {
  const { isActive } = serviceActiveSchema.parse(req.body);
  res.json({ service: await catalog.setServiceActive(currentUser(req), uuid.parse(req.params.id), isActive) });
});

export const remove = asyncHandler(async (req, res) => {
  await catalog.deleteService(currentUser(req), uuid.parse(req.params.id));
  res.status(204).end();
});
