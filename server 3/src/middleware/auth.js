/**
 * middleware/auth.js
 * Bảo vệ mọi route nghiệp vụ - yêu cầu đã đăng nhập (có session hợp lệ).
 * Không có ngoại lệ: đúng như đã thống nhất, KHÔNG route nghiệp vụ nào bỏ qua middleware này.
 */
const { AppError } = require('../lib/errors');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next(new AppError('UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục.', 401));
  }
  next();
}

module.exports = { requireAuth };
