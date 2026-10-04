/**
 * lib/validate.js
 * Middleware validate request body bằng Zod schema, trả lỗi 400 rõ ràng
 * thay vì để lỗi rơi xuống tận service/DB (ví dụ: "Cannot read properties of
 * undefined") rồi mới bị errorHandler bắt chung chung.
 */
const { AppError } = require('./errors');

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      const fieldPath = first.path.join('.');
      const message = fieldPath
        ? `Dữ liệu không hợp lệ ở "${fieldPath}": ${first.message}`
        : `Dữ liệu không hợp lệ: ${first.message}`;
      return next(new AppError('VALIDATION_ERROR', message, 400, { issues: result.error.issues }));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
