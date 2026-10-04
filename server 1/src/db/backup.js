/**
 * db/backup.js
 * Tự động sao lưu database định kỳ, dùng API backup() gốc của better-sqlite3
 * (an toàn với WAL/transaction đang chạy) - KHÔNG copy file .db thô bằng tay,
 * vì copy thô có thể chụp trúng lúc đang ghi và tạo ra file hỏng.
 */
const fs = require('fs');
const path = require('path');
const db = require('./connection');
const env = require('../config/env');

const BACKUP_DIR = path.join(path.dirname(env.DB_FILE), 'backups');
const MAX_BACKUPS = 5;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function rotateOldBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  for (const f of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
  }
}

async function backupNow() {
  try {
    ensureBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destPath = path.join(BACKUP_DIR, `dailyc-${stamp}.db`);
    await db.backup(destPath);
    rotateOldBackups();
    console.log(`[backup] Đã sao lưu database -> ${destPath}`);
  } catch (err) {
    // Backup lỗi không được làm sập server chính
    console.error('[backup] Sao lưu thất bại:', err.message);
  }
}

function scheduleBackups(intervalHours = 6) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  // Lần đầu chạy sau 10s để không chặn thời gian khởi động server
  setTimeout(() => backupNow(), 10 * 1000);
  setInterval(() => backupNow(), intervalMs);
}

module.exports = { backupNow, scheduleBackups, BACKUP_DIR };
