import { currentUser } from '../middleware/auth';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/auth';
import * as auth from '../services/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const register = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await auth.register(input);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await auth.login(input.email, input.password, input.remember, {
    ip: req.ip,
    agent: req.get('user-agent'),
  });
  res.json(result);
});

/** Tokens are stateless; the client discards its copy. Kept as an endpoint for symmetry and auditing. */
export const logout = asyncHandler(async (_req, res) => {
  res.status(204).end();
});

export const logoutAll = asyncHandler(async (req, res) => {
  await auth.logoutEverywhere(currentUser(req));
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  const user = await auth.loadUserDto(currentUser(req).id);
  res.json({ user });
});

export const session = asyncHandler(async (req, res) => {
  res.json({ session: await auth.getSessionInfo(currentUser(req).id) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const result = await auth.requestPasswordReset(email);
  res.json({
    message: 'If an account exists for that email, a reset link is on its way.',
    ...result,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await auth.resetPassword(input.token, input.password);
  res.json({ message: 'Your password has been updated. You can sign in now.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const input = changePasswordSchema.parse(req.body);
  const result = await auth.changePassword(currentUser(req), input.currentPassword, input.newPassword);
  res.json({ ...result, message: 'Password updated. Other devices have been signed out.' });
});
