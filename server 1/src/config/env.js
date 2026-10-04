/**
 * config/env.js
 * Đọc và tập trung toàn bộ biến môi trường tại một chỗ duy nhất.
 * Không nơi nào khác trong codebase được đọc process.env trực tiếp -
 * mọi module đều import từ đây để dễ kiểm soát và thay đổi sau này.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name}. Xem file .env.example.`);
  }
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  SESSION_SECRET: required('SESSION_SECRET', 'dev-secret-change-me'),
  DB_FILE: path.resolve(__dirname, '../../', process.env.DB_FILE || './data/dailyc.db'),
  OWNER_EMAIL: process.env.OWNER_EMAIL || 'owner@dailyc.coffee',
  OWNER_PASSWORD: process.env.OWNER_PASSWORD || 'DailycOwner123',
  CORS_ORIGIN: process.env.CORS_ORIGIN || `http://localhost:${process.env.PORT || '4000'}`,
  SESSION_MAX_AGE_DAYS: parseInt(process.env.SESSION_MAX_AGE_DAYS || '7', 10),
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

module.exports = env;
