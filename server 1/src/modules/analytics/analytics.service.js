/**
 * modules/analytics/analytics.service.js
 * MỌI KPI/chart/bảng ở Tổng quan & Báo cáo PHẢI đi qua đây - tính bằng
 * aggregation SQL trực tiếp trên dữ liệu thật, không hard-code, không có
 * 2 nơi tính ra 2 con số khác nhau cho cùng 1 khái niệm.
 */
const db = require('../../db/connection');

function range(dateFrom, dateTo) {
  return { dateFrom: dateFrom || '0000-01-01', dateTo: dateTo || '9999-12-31' };
}

function overview({ dateFrom, dateTo } = {}) {
  const r = range(dateFrom, dateTo);
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(
          (SELECT COALESCE(SUM(oi.unit_price*oi.quantity),0) FROM order_items oi WHERE oi.order_id=o.id)
          - o.discount + o.shipping_fee
        ), 0) AS revenue
       FROM orders o
       WHERE o.status='completed' AND date(o.completed_at) BETWEEN date(@dateFrom) AND date(@dateTo)`
    )
    .get(r);

  const refunded = db
    .prepare(
      `SELECT COALESCE(SUM(refund_amount),0) AS r FROM return_orders
       WHERE date(created_at) BETWEEN date(@dateFrom) AND date(@dateTo)`
    )
    .get(r).r;

  const ordersCreated = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders
       WHERE status != 'cancelled' AND date(created_at) BETWEEN date(@dateFrom) AND date(@dateTo)`
    )
    .get(r).c;

  const netRevenue = row.revenue - refunded;
  const avgOrderValue = row.totalOrders > 0 ? row.revenue / row.totalOrders : 0;

  const soldQty = db
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity),0) AS q FROM order_items oi JOIN orders o ON o.id=oi.order_id
       WHERE o.status='completed' AND date(o.completed_at) BETWEEN date(@dateFrom) AND date(@dateTo)`
    )
    .get(r).q;
  const returnedQty = db
    .prepare(
      `SELECT COALESCE(SUM(quantity),0) AS q FROM return_items ri JOIN return_orders ro ON ro.id=ri.return_order_id
       WHERE date(ro.created_at) BETWEEN date(@dateFrom) AND date(@dateTo)`
    )
    .get(r).q;
  const returnRate = soldQty > 0 ? returnedQty / soldQty : 0;

  return {
    revenue: row.revenue,
    netRevenue,
    totalOrders: row.totalOrders,
    ordersCreated,
    avgOrderValue,
    returnedAmount: refunded,
    returnRate,
  };
}

function topProducts({ dateFrom, dateTo, sortBy = 'quantity', limit = 10 } = {}) {
  const r = range(dateFrom, dateTo);
  const orderCol = sortBy === 'revenue' ? 'revenue' : 'quantity';
  return db
    .prepare(
      `SELECT p.id, p.code, p.name,
        COALESCE(SUM(oi.quantity),0) AS quantity,
        COALESCE(SUM(oi.unit_price*oi.quantity),0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status='completed' AND date(o.completed_at) BETWEEN date(@dateFrom) AND date(@dateTo)
       GROUP BY p.id
       ORDER BY ${orderCol} DESC
       LIMIT @limit`
    )
    .all({ ...r, limit: Number(limit) || 10 });
}

function returnsAnalysis({ dateFrom, dateTo, limit = 10 } = {}) {
  const r = { ...range(dateFrom, dateTo), limit: Number(limit) || 10 };
  const base = `
    SELECT p.id, p.code, p.name,
      COALESCE(sold.qty, 0) AS soldQty,
      COALESCE(returned.qty, 0) AS returnedQty,
      COALESCE(returned.amount, 0) AS returnedAmount,
      CASE WHEN COALESCE(sold.qty,0) > 0 THEN CAST(COALESCE(returned.qty,0) AS REAL) / sold.qty ELSE 0 END AS returnRate
    FROM products p
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS qty
      FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.status='completed' AND date(o.completed_at) BETWEEN date(@dateFrom) AND date(@dateTo)
      GROUP BY oi.product_id
    ) sold ON sold.product_id = p.id
    LEFT JOIN (
      SELECT ri.product_id, SUM(ri.quantity) AS qty, SUM(ri.quantity*ri.unit_price_at_sale) AS amount
      FROM return_items ri JOIN return_orders ro ON ro.id=ri.return_order_id
      WHERE date(ro.created_at) BETWEEN date(@dateFrom) AND date(@dateTo)
      GROUP BY ri.product_id
    ) returned ON returned.product_id = p.id
    WHERE COALESCE(returned.qty,0) > 0
  `;
  const byQuantity = db.prepare(`${base} ORDER BY returnedQty DESC LIMIT @limit`).all(r);
  const byRate = db.prepare(`${base} ORDER BY returnRate DESC LIMIT @limit`).all(r);
  return { byQuantity, byRate };
}

function channels({ dateFrom, dateTo } = {}) {
  const r = range(dateFrom, dateTo);
  return db
    .prepare(
      `SELECT ch.id, ch.name,
        COUNT(o.id) AS orderCount,
        COALESCE(SUM(
          (SELECT COALESCE(SUM(oi.unit_price*oi.quantity),0) FROM order_items oi WHERE oi.order_id=o.id)
          - o.discount + o.shipping_fee
        ), 0) AS revenue
       FROM channels ch
       LEFT JOIN orders o ON o.channel_id = ch.id AND o.status='completed'
         AND date(o.completed_at) BETWEEN date(@dateFrom) AND date(@dateTo)
       GROUP BY ch.id
       ORDER BY revenue DESC`
    )
    .all(r);
}

function customersTrend({ dateFrom, dateTo } = {}) {
  const r = range(dateFrom, dateTo);
  // Khách "mới" = đơn đầu tiên của khách đó rơi trong khoảng ngày đang xem
  const rows = db
    .prepare(
      `SELECT o.customer_id,
        date(o.created_at) AS orderDate,
        (SELECT MIN(date(o2.created_at)) FROM orders o2 WHERE o2.customer_id = o.customer_id) AS firstOrderDate
       FROM orders o
       WHERE o.customer_id IS NOT NULL AND o.status != 'cancelled'
         AND date(o.created_at) BETWEEN date(@dateFrom) AND date(@dateTo)`
    )
    .all(r);
  const newCustomers = new Set();
  const returningCustomers = new Set();
  rows.forEach((row) => {
    if (row.firstOrderDate === row.orderDate) newCustomers.add(row.customer_id);
    else returningCustomers.add(row.customer_id);
  });
  return { newCustomers: newCustomers.size, returningCustomers: returningCustomers.size };
}

module.exports = { overview, topProducts, returnsAnalysis, channels, customersTrend };
