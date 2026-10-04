/**
 * app.js
 * Khởi tạo Express app: middleware toàn cục, session, mount routes theo module,
 * phục vụ file tĩnh của frontend, và error handler tập trung ở CUỐI CÙNG.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieSession = require('cookie-session');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const productsRoutes = require('./modules/products/products.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const returnsRoutes = require('./modules/returns/returns.routes');
const cashbookRoutes = require('./modules/cashbook/cashbook.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const feedbackRoutes = require('./modules/feedback/feedback.routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));

  app.use(
    cookieSession({
      name: 'dailyc_session',
      secret: env.SESSION_SECRET,
      maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction, // chỉ bật secure (bắt buộc HTTPS) ở production
    })
  );

  // Security header cơ bản
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // Request logging nhẹ: method/path/status/thời gian xử lý, KHÔNG log body/cookie/header
  // (tránh ghi lại dữ liệu nhạy cảm). Đánh dấu riêng các request chậm (>300ms) để dễ soi hiệu năng.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const slow = ms > 300 ? ' [SLOW]' : '';
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms${slow}`);
    });
    next();
  });

  // ---- API routes ----
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/returns', returnsRoutes);
  app.use('/api/cash-transactions', cashbookRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/feedback', feedbackRoutes);

  // ---- Phục vụ frontend tĩnh (client/) ----
  const clientDir = path.resolve(__dirname, '../../client');
  app.use(express.static(clientDir));

  // Mọi route không phải /api/* và không khớp file tĩnh -> trả về index.html
  // (để router phía client (hash-based) tự xử lý điều hướng)
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
