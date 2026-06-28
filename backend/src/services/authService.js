import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { httpError } from '../middleware/error.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register({ email, password, name }) {
  email = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw httpError(400, 'A valid email is required');
  if (!password || password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    throw httpError(409, 'An account with that email already exists');
  }

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at`,
    [email, name?.trim() || null, hash]
  );
  return rows[0];
}

export async function login({ email, password }) {
  email = (email || '').trim().toLowerCase();
  const { rows } = await query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user) throw httpError(401, 'Invalid email or password');

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) throw httpError(401, 'Invalid email or password');

  return { id: user.id, email: user.email, name: user.name };
}
