import * as authService from '../services/authService.js';
import { signToken } from '../middleware/auth.js';

export async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const user = await authService.login(req.body);
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: { id: req.userId, email: req.userEmail } });
}
