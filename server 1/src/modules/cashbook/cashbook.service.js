/**
 * modules/cashbook/cashbook.service.js
 * Sổ quỹ: liệt kê thu/chi, tạo giao dịch thủ công, tính tồn quỹ.
 * Tồn quỹ = quỹ đầu kỳ + tổng thu(kỳ) - tổng chi(kỳ).
 */
const db = require('../../db/connection');
const { AppError } = require('../../lib/errors');
const { parsePagination } = require('../../lib/pagination');

function list({ fundType, type, dateFrom, dateTo, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = {};
  if (fundType) { clauses.push('fund_type = @fundType'); params.fundType = fundType; }
  if (type) { clauses.push('type = @type'); params.type = type; }
  if (dateFrom) { clauses.push('date(created_at) >= date(@dateFrom)'); params.dateFrom = dateFrom; }
  if (dateTo) { clauses.push('date(created_at) <= date(@dateTo)'); params.dateTo = dateTo; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: safePage, pageSize: limit, offset } = parsePagination({ page, pageSize });

  const rows = db
    .prepare(`SELECT * FROM cash_transactions ${where} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });
  const total = db.prepare(`SELECT COUNT(*) AS c FROM cash_transactions ${where}`).get(params).c;
  return { data: rows, meta: { total, page: safePage, pageSize: limit } };
}

function createManual({ type, fundType, category, amount, note }) {
  if (!['thu', 'chi'].includes(type)) throw new AppError('VALIDATION_ERROR', 'Loại chứng từ không hợp lệ.', 400);
  if (!['cash', 'bank', 'ewallet'].includes(fundType)) throw new AppError('VALIDATION_ERROR', 'Loại quỹ không hợp lệ.', 400);
  if (!(amount > 0)) throw new AppError('VALIDATION_ERROR', 'Số tiền phải lớn hơn 0.', 400);

  const result = db
    .prepare(
      `INSERT INTO cash_transactions (type, fund_type, category, amount, related_type, note)
       VALUES (?, ?, ?, ?, 'manual', ?)`
    )
    .run(type, fundType, category || 'Khác', amount, note || null);
  return db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(result.lastInsertRowid);
}

function summary({ dateFrom, dateTo, fundType } = {}) {
  const fundClause = fundType ? 'AND fund_type = @fundType' : '';
  const params = { dateFrom: dateFrom || '0000-01-01', dateTo: dateTo || '9999-12-31', fundType };

  const opening = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type='thu' THEN amount ELSE -amount END), 0) AS balance
       FROM cash_transactions WHERE date(created_at) < date(@dateFrom) ${fundClause}`
    )
    .get(params).balance;

  const inRange = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type='thu' THEN amount ELSE 0 END), 0) AS totalThu,
        COALESCE(SUM(CASE WHEN type='chi' THEN amount ELSE 0 END), 0) AS totalChi
       FROM cash_transactions
       WHERE date(created_at) BETWEEN date(@dateFrom) AND date(@dateTo) ${fundClause}`
    )
    .get(params);

  const closing = opening + inRange.totalThu - inRange.totalChi;
  return { opening, totalThu: inRange.totalThu, totalChi: inRange.totalChi, closing };
}

module.exports = { list, createManual, summary };
