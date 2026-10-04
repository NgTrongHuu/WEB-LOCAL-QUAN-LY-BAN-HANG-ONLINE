/**
 * modules/returns/returns.service.js
 * Phiếu trả hàng - chỉ áp dụng cho đơn đã completed. Mỗi dòng hoàn có toggle
 * restock: true -> cộng lại kho; false -> hàng hỏng, không cộng kho.
 * Toàn bộ nằm trong 1 transaction, kiểm tra lại số lượng tối đa được hoàn NGAY
 * trong transaction để tránh 2 phiếu trả cùng lúc vượt giới hạn.
 */
const db = require('../../db/connection');
const { AppError } = require('../../lib/errors');
const { generateCode } = require('../../lib/format');
const { parsePagination } = require('../../lib/pagination');

function getReturnWithItems(id) {
  const ret = db.prepare('SELECT * FROM return_orders WHERE id = ?').get(id);
  if (!ret) throw new AppError('NOT_FOUND', 'Không tìm thấy phiếu trả hàng.', 404);
  const items = db
    .prepare(
      `SELECT ri.*, p.name AS product_name, p.code AS product_code
       FROM return_items ri JOIN products p ON p.id = ri.product_id
       WHERE ri.return_order_id = ?`
    )
    .all(id);
  return { ...ret, items };
}

function list({ dateFrom, dateTo, search, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = {};
  if (dateFrom) { clauses.push('date(ro.created_at) >= date(@dateFrom)'); params.dateFrom = dateFrom; }
  if (dateTo) { clauses.push('date(ro.created_at) <= date(@dateTo)'); params.dateTo = dateTo; }
  if (search) { clauses.push('(ro.code LIKE @search)'); params.search = `%${search}%`; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: safePage, pageSize: limit, offset } = parsePagination({ page, pageSize });

  const rows = db
    .prepare(
      `SELECT ro.*, o.code AS order_code, c.name AS customer_name
       FROM return_orders ro
       LEFT JOIN orders o ON o.id = ro.order_id
       LEFT JOIN customers c ON c.id = ro.customer_id
       ${where}
       ORDER BY ro.created_at DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  const total = db.prepare(`SELECT COUNT(*) AS c FROM return_orders ro ${where}`).get(params).c;
  return { data: rows, meta: { total, page: safePage, pageSize: limit } };
}

/** Số lượng còn được hoàn của 1 sản phẩm trong 1 đơn = đã mua - đã hoàn trước đó. */
function getRemainingReturnable(orderId, productId) {
  const bought = db
    .prepare('SELECT COALESCE(SUM(quantity),0) AS q FROM order_items WHERE order_id=? AND product_id=?')
    .get(orderId, productId).q;
  const alreadyReturned = db
    .prepare(
      `SELECT COALESCE(SUM(ri.quantity),0) AS q FROM return_items ri
       JOIN return_orders ro ON ro.id = ri.return_order_id
       WHERE ro.order_id = ? AND ri.product_id = ?`
    )
    .get(orderId, productId).q;
  return bought - alreadyReturned;
}

function createReturn(input) {
  const { orderId, items, reason, refundMethod = 'cash' } = input;
  if (!orderId || !Array.isArray(items) || items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Thiếu đơn gốc hoặc danh sách sản phẩm hoàn.', 400);
  }

  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng gốc.', 404);
    if (order.status !== 'completed') {
      throw new AppError('INVALID_STATE', 'Chỉ đơn đã hoàn thành mới được tạo phiếu trả hàng.', 409);
    }

    let refundAmount = 0;
    const resolvedItems = items.map((it) => {
      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new AppError('VALIDATION_ERROR', 'Số lượng hoàn không hợp lệ.', 400);
      }
      const remaining = getRemainingReturnable(orderId, it.productId);
      if (quantity > remaining) {
        throw new AppError(
          'RETURN_EXCEEDS_LIMIT',
          `Số lượng hoàn vượt quá số lượng còn có thể hoàn (còn tối đa ${remaining}).`,
          422
        );
      }
      const orderItem = db
        .prepare('SELECT unit_price FROM order_items WHERE order_id=? AND product_id=?')
        .get(orderId, it.productId);
      refundAmount += orderItem.unit_price * quantity;
      return { productId: it.productId, quantity, unitPrice: orderItem.unit_price, restock: it.restock !== false };
    });

    const code = generateCode('TH');
    const returnResult = db
      .prepare(
        `INSERT INTO return_orders (code, order_id, customer_id, reason, refund_amount, refund_method)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(code, orderId, order.customer_id, reason || null, refundAmount, refundMethod);
    const returnId = returnResult.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO return_items (return_order_id, product_id, quantity, unit_price_at_sale, restock) VALUES (?, ?, ?, ?, ?)`
    );
    const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity_change, ref_type, ref_id) VALUES (?, 'return', ?, 'return', ?)`
    );

    resolvedItems.forEach(({ productId, quantity, unitPrice, restock }) => {
      insertItem.run(returnId, productId, quantity, unitPrice, restock ? 1 : 0);
      if (restock) {
        updateStock.run(quantity, productId);
        insertMovement.run(productId, quantity, returnId);
      }
    });

    db.prepare(
      `INSERT INTO cash_transactions (type, fund_type, category, amount, related_type, related_id, note)
       VALUES ('chi', ?, 'Hoàn tiền khách trả hàng', ?, 'return', ?, ?)`
    ).run(refundMethod, refundAmount, returnId, `Hoàn tiền phiếu ${code}`);

    return returnId;
  });

  const id = tx();
  return getReturnWithItems(id);
}

module.exports = { list, getReturnWithItems, createReturn, getRemainingReturnable };
