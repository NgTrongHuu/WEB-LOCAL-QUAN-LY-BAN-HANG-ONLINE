/**
 * modules/orders/orders.service.js
 * Business logic Đơn đi - đúng theo vòng đời đã thiết kế:
 *   Processing --(complete)--> Completed --(khóa)
 *   Processing --(cancel)--> Cancelled
 * Mọi thao tác nhiều bước (trừ kho + tạo đơn, hoàn thành + sinh phiếu thu,
 * hủy + hoàn kho) đều nằm trong 1 database transaction (db.transaction) để
 * không bao giờ có trạng thái dữ liệu nửa vời.
 */
const db = require('../../db/connection');
const { AppError } = require('../../lib/errors');
const { generateCode } = require('../../lib/format');
const { parsePagination } = require('../../lib/pagination');

function computeTotals(items, discount = 0, shippingFee = 0) {
  const subtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const total = subtotal - (discount || 0) + (shippingFee || 0);
  return { subtotal, total };
}

function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  const items = db
    .prepare(
      `SELECT oi.*, p.name AS product_name, p.code AS product_code
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`
    )
    .all(id);
  const returned = db
    .prepare(
      `SELECT ri.product_id, SUM(ri.quantity) AS qty
       FROM return_items ri JOIN return_orders ro ON ro.id = ri.return_order_id
       WHERE ro.order_id = ? GROUP BY ri.product_id`
    )
    .all(id);
  return { ...order, items, returnedByProduct: returned };
}

function list({ status, channelId, dateFrom, dateTo, search, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = {};
  if (status) { clauses.push('o.status = @status'); params.status = status; }
  if (channelId) { clauses.push('o.channel_id = @channelId'); params.channelId = channelId; }
  if (dateFrom) { clauses.push('date(o.created_at) >= date(@dateFrom)'); params.dateFrom = dateFrom; }
  if (dateTo) { clauses.push('date(o.created_at) <= date(@dateTo)'); params.dateTo = dateTo; }
  if (search) { clauses.push('(o.code LIKE @search OR c.name LIKE @search)'); params.search = `%${search}%`; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: safePage, pageSize: limit, offset } = parsePagination({ page, pageSize });

  const rows = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, ch.name AS channel_name,
        (SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS subtotal
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN channels ch ON ch.id = o.channel_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  const summaryRow = db
    .prepare(
      `SELECT COUNT(*) AS totalOrders,
        COALESCE(SUM(CASE WHEN o.status='completed' THEN
          (SELECT COALESCE(SUM(oi.unit_price*oi.quantity),0) FROM order_items oi WHERE oi.order_id=o.id) - o.discount + o.shipping_fee
        ELSE 0 END), 0) AS totalRevenue
       FROM orders o ${where}`
    )
    .get(params);

  const total = db.prepare(`SELECT COUNT(*) AS c FROM orders o LEFT JOIN customers c ON c.id=o.customer_id ${where}`).get(params).c;

  return {
    data: rows,
    meta: { total, page: safePage, pageSize: limit, ...summaryRow },
  };
}

function getOrCreateCustomer({ customerId, customerName, customerPhone, customerAddress }) {
  if (customerId) return customerId;
  if (!customerName) return null;
  const result = db
    .prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)')
    .run(customerName, customerPhone || null, customerAddress || null);
  return result.lastInsertRowid;
}

/** Tạo đơn: TRỪ NGAY tồn kho trong 1 transaction. Chặn nếu bất kỳ sản phẩm nào không đủ tồn. */
function createOrder(input) {
  const { items, discount = 0, shippingFee = 0, paymentMethod = 'cash', channelId, expectedDeliveryDate, note } = input;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Đơn hàng phải có ít nhất 1 sản phẩm.', 400);
  }

  const tx = db.transaction(() => {
    const customerId = getOrCreateCustomer(input);
    const resolvedItems = items.map((it) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId);
      if (!product) throw new AppError('NOT_FOUND', `Không tìm thấy sản phẩm #${it.productId}.`, 404);
      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new AppError('VALIDATION_ERROR', `Số lượng không hợp lệ cho sản phẩm ${product.name}.`, 400);
      }
      if (product.stock_qty < quantity) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock_qty}, cần ${quantity}).`,
          422,
          { field: 'items' }
        );
      }
      return { product, quantity, unit_price: product.sell_price, unit_cost: product.cost_price };
    });

    const code = generateCode('DH');
    const orderResult = db
      .prepare(
        `INSERT INTO orders (code, customer_id, channel_id, discount, shipping_fee, payment_method, status, note, expected_delivery_date)
         VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?)`
      )
      .run(code, customerId, channelId || null, discount, shippingFee, paymentMethod, note || null, expectedDeliveryDate || null);
    const orderId = orderResult.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)`
    );
    const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?');
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity_change, ref_type, ref_id) VALUES (?, 'sale', ?, 'order', ?)`
    );

    resolvedItems.forEach(({ product, quantity, unit_price, unit_cost }) => {
      insertItem.run(orderId, product.id, quantity, unit_price, unit_cost);
      updateStock.run(quantity, product.id);
      insertMovement.run(product.id, -quantity, orderId);
    });

    return orderId;
  });

  const id = tx();
  return getOrderWithItems(id);
}

/** Hoàn thành đơn: khóa đơn, sinh phiếu thu. */
function completeOrder(id) {
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    if (order.status !== 'processing') {
      throw new AppError('INVALID_STATE', 'Chỉ đơn đang xử lý mới có thể đánh dấu hoàn thành.', 409);
    }
    const subtotal = db
      .prepare('SELECT COALESCE(SUM(unit_price*quantity),0) AS s FROM order_items WHERE order_id = ?')
      .get(id).s;
    const total = subtotal - order.discount + order.shipping_fee;

    db.prepare(`UPDATE orders SET status='completed', completed_at=datetime('now') WHERE id = ?`).run(id);
    db.prepare(
      `INSERT INTO cash_transactions (type, fund_type, category, amount, related_type, related_id, note)
       VALUES ('thu', ?, 'Doanh thu bán hàng', ?, 'order', ?, ?)`
    ).run(order.payment_method, total, id, `Thu tiền đơn ${order.code}`);
  });
  tx();
  return getOrderWithItems(id);
}

/** Hủy đơn: chỉ khi đang processing - hoàn lại toàn bộ kho, không tính doanh thu. */
function cancelOrder(id) {
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    if (order.status !== 'processing') {
      throw new AppError('INVALID_STATE', 'Chỉ đơn đang xử lý mới có thể hủy.', 409);
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity_change, ref_type, ref_id) VALUES (?, 'cancel_restore', ?, 'order', ?)`
    );
    items.forEach((it) => {
      updateStock.run(it.quantity, it.product_id);
      insertMovement.run(it.product_id, it.quantity, id);
    });
    db.prepare(`UPDATE orders SET status='cancelled' WHERE id = ?`).run(id);
  });
  tx();
  return getOrderWithItems(id);
}

module.exports = { list, getOrderWithItems, createOrder, completeOrder, cancelOrder };
