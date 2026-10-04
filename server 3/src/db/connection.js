/**
 * db/connection.js
 * Kết nối SQLite duy nhất dùng chung toàn bộ ứng dụng (singleton).
 *
 * Vì sao SQLite ở bản chạy local này:
 *  - Chạy được ngay bằng 1 lệnh, không cần cài đặt server DB riêng (Postgres/MySQL)
 *    trên máy người dùng - đúng yêu cầu "tải về, chạy trên VS Code" của dự án.
 *  - better-sqlite3 là đồng bộ (synchronous) và chỉ có 1 connection duy nhất trong
 *    tiến trình Node -> mọi thao tác ghi tự động được tuần tự hóa, tránh race
 *    condition khi trừ/cộng kho mà KHÔNG cần row-level lock thủ công như Postgres.
 *  - Khi lên production thật với nhiều người dùng đồng thời, đổi sang Postgres/MySQL
 *    theo đúng schema + business logic đã thiết kế (xem docs/ARCHITECTURE.md và các
 *    prompt Database/API/Transaction đã thống nhất) - lớp service không cần viết lại,
 *    chỉ đổi lớp repository/connection này.
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

// Đảm bảo thư mục chứa file DB tồn tại
const dbDir = path.dirname(env.DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(env.DB_FILE);

// Bật ràng buộc khóa ngoại (SQLite mặc định TẮT, phải bật thủ công)
db.pragma('foreign_keys = ON');
// WAL mode: đọc/ghi đồng thời tốt hơn, an toàn hơn khi tắt ứng dụng đột ngột
db.pragma('journal_mode = WAL');
// Nếu có 2 tiến trình/kết nối cùng ghi, chờ tối đa 5s trước khi báo lỗi "database is locked"
// thay vì báo lỗi ngay lập tức.
db.pragma('busy_timeout = 5000');
// NORMAL đủ an toàn khi dùng WAL (chỉ mất dữ liệu nếu mất điện đúng lúc OS crash),
// nhanh hơn FULL đáng kể cho ứng dụng 1 user/local này.
db.pragma('synchronous = NORMAL');
// Bảng tạm (ORDER BY, GROUP BY lớn) xử lý trong RAM thay vì ghi ra file tạm trên đĩa.
db.pragma('temp_store = MEMORY');

module.exports = db;
