/**
 * modules/auth/auth.service.js
 * Business logic đăng nhập/đổi mật khẩu. Mật khẩu hash bằng bcrypt - KHÔNG BAO GIỜ
 * lưu hoặc trả về plaintext/hash ra ngoài service này.
 */
const bcrypt = require('bcryptjs');
const db = require('../../db/connection');
const { AppError } = require('../../lib/errors');

// Chống brute-force đơn giản: đếm số lần sai liên tiếp theo email, trong bộ nhớ (đủ cho quy mô 1 owner)
const failedAttempts = new Map(); // email -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function toPublicUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

function login(email, password) {
  const attempt = failedAttempts.get(email);
  if (attempt && attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    throw new AppError('LOGIN_LOCKED', 'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ít phút.', 429);
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = row && bcrypt.compareSync(password, row.password_hash);

  if (!ok) {
    const current = failedAttempts.get(email) || { count: 0 };
    current.count += 1;
    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCK_MS;
      current.count = 0;
    }
    failedAttempts.set(email, current);
    throw new AppError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.', 401);
  }

  failedAttempts.delete(email);
  return toPublicUser(row);
}

function getById(id) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return toPublicUser(row);
}

function changePassword(userId, oldPassword, newPassword) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row || !bcrypt.compareSync(oldPassword, row.password_hash)) {
    throw new AppError('INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.', 401);
  }
  if (!newPassword || newPassword.length < 8) {
    throw new AppError('WEAK_PASSWORD', 'Mật khẩu mới phải có ít nhất 8 ký tự.', 422);
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
}

module.exports = { login, getById, changePassword };
