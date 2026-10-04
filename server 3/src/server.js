/**
 * server.js
 * Điểm khởi động thực sự của backend: khởi tạo database, mở cổng lắng nghe,
 * lên lịch backup tự động, và đóng ứng dụng gọn gàng (graceful shutdown) khi
 * nhận Ctrl+C hoặc bị hệ điều hành yêu cầu dừng.
 */
const { createApp } = require('./app');
const { initDatabase } = require('./db/init');
const { scheduleBackups } = require('./db/backup');
const db = require('./db/connection');
const env = require('./config/env');

initDatabase();

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Dailyc Coffee server đang chạy tại http://localhost:${env.PORT}`);
  console.log(`Môi trường: ${env.NODE_ENV}`);
  scheduleBackups(6); // sao lưu database mỗi 6 giờ
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nĐang nhận ${signal}, tắt server gọn gàng...`);

  // Nếu quá 5s mà chưa đóng xong (request treo), buộc thoát để không bị kẹt mãi.
  const forceExitTimer = setTimeout(() => {
    console.error('Đóng server quá lâu, buộc thoát.');
    process.exit(1);
  }, 5000);

  server.close(() => {
    try {
      db.close();
      console.log('Đã đóng kết nối database. Tạm biệt!');
    } catch (err) {
      console.error('Lỗi khi đóng database:', err.message);
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
