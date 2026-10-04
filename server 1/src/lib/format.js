/**
 * lib/format.js
 * Các hàm thuần dùng chung để sinh mã chứng từ, format tiền, v.v.
 */
function generateCode(prefix) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${y}${m}${d}-${rand}`;
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { generateCode, nowIso };
