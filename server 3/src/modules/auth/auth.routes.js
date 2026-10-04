const express = require('express');
const authService = require('./auth.service');
const { requireAuth } = require('../../middleware/auth');
const { AppError } = require('../../lib/errors');
const { validateBody } = require('../../lib/validate');
const { loginSchema, changePasswordSchema } = require('../../lib/schemas');

const router = express.Router();

router.post('/login', validateBody(loginSchema), (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = authService.login(String(email).trim().toLowerCase(), String(password));
    req.session.userId = user.id;
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ data: { ok: true } });
});

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const user = authService.getById(req.session.userId);
    if (!user) throw new AppError('UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.', 401);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', requireAuth, validateBody(changePasswordSchema), (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    authService.changePassword(req.session.userId, oldPassword, newPassword);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
