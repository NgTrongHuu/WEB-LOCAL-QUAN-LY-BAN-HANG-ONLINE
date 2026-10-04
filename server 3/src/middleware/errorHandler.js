/**
 * middleware/errorHandler.js
 * Xử lý lỗi tập trung - KHÔNG bao giờ lộ stack trace/câu SQL ra client.
 * Log chi tiết đầy đủ ở console server, chỉ trả { error: { code, message } } cho client.
 */
const { AppError } = require('../lib/errors');
const env = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (!env.isProduction) {
      console.error(`[AppError] ${err.code}: ${err.message}`);
    }
    return res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, field: err.meta?.field },
    });
  }

  // Lỗi không lường trước - log đầy đủ ở server, trả về client thông điệp chung chung
  console.error('[UnhandledError]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Có lỗi xảy ra ở máy chủ. Vui lòng thử lại.' },
  });
}

module.exports = { notFoundHandler, errorHandler };
