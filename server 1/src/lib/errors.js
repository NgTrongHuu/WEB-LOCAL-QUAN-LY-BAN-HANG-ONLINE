/**
 * lib/errors.js
 * Lớp lỗi nghiệp vụ dùng chung - mang theo httpStatus và code ổn định
 * để frontend xử lý theo `code` thay vì parse chuỗi message (đúng chuẩn đã thống nhất).
 */
class AppError extends Error {
  constructor(code, message, httpStatus = 400, meta = undefined) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.meta = meta;
  }
}

module.exports = { AppError };
