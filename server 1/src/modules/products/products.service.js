/**
 * modules/products/products.service.js
 * Thực đơn và Kho hàng CÙNG DÙNG module này (cùng 1 bảng products, khác góc nhìn UI).
 * Bao gồm: CRUD sản phẩm, điều chỉnh tồn kho thủ công, lịch sử biến động tồn.
 */
const db = require('../../db/connection');
const { AppError } = require('../../lib/errors');
const { parsePagination } = require('../../lib/pagination');

function list({ search, categoryId, status, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = {};
  if (search) {
    clauses.push('(p.code LIKE @search OR p.name LIKE @search)');
    params.search = `%${search}%`;
  }
  if (categoryId) {
    clauses.push('p.category_id = @categoryId');
    params.categoryId = categoryId;
  }
  if (status) {
    clauses.push('p.status = @status');
    params.status = status;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: safePage, pageSize: limit, offset } = parsePagination({ page, pageSize });

  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  const total = db.prepare(`SELECT COUNT(*) AS c FROM products p ${where}`).get(params).c;

  return { data: rows, meta: { total, page: safePage, pageSize: limit } };
}

function getById(id) {
  const row = db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
  return row;
}

function create(input) {
  const { code, name, description, categoryId, unit, weightGrams, sellPrice, costPrice, minStockThreshold, initialStock } = input;
  if (!code || !name || sellPrice === undefined) {
    throw new AppError('VALIDATION_ERROR', 'Thiếu mã, tên hoặc giá bán sản phẩm.', 400);
  }
  const existed = db.prepare('SELECT id FROM products WHERE code = ?').get(code);
  if (existed) throw new AppError('DUPLICATE_CODE', 'Mã sản phẩm đã tồn tại.', 409);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO products (code, name, description, category_id, unit, weight_grams, sell_price, cost_price, stock_qty, min_stock_threshold, status)
         VALUES (@code, @name, @description, @categoryId, @unit, @weightGrams, @sellPrice, @costPrice, @stockQty, @minStockThreshold, 'active')`
      )
      .run({
        code,
        name,
        description: description || null,
        categoryId: categoryId || null,
        unit: unit || 'túi',
        weightGrams: weightGrams || null,
        sellPrice,
        costPrice: costPrice || 0,
        stockQty: initialStock || 0,
        minStockThreshold: minStockThreshold ?? 5,
      });
    const productId = result.lastInsertRowid;
    if (initialStock && initialStock > 0) {
      db.prepare(
        `INSERT INTO stock_movements (product_id, type, quantity_change, note, ref_type, ref_id)
         VALUES (?, 'manual_adjust', ?, 'Tồn kho ban đầu khi tạo sản phẩm', 'product', ?)`
      ).run(productId, initialStock, productId);
    }
    return productId;
  });

  const id = tx();
  return getById(id);
}

function update(id, input) {
  const existing = getById(id);
  const fields = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    category_id: input.categoryId ?? existing.category_id,
    unit: input.unit ?? existing.unit,
    weight_grams: input.weightGrams ?? existing.weight_grams,
    sell_price: input.sellPrice ?? existing.sell_price,
    cost_price: input.costPrice ?? existing.cost_price,
    min_stock_threshold: input.minStockThreshold ?? existing.min_stock_threshold,
    status: input.status ?? existing.status,
  };
  db.prepare(
    `UPDATE products SET name=@name, description=@description, category_id=@category_id,
     unit=@unit, weight_grams=@weight_grams, sell_price=@sell_price, cost_price=@cost_price,
     min_stock_threshold=@min_stock_threshold, status=@status WHERE id=@id`
  ).run({ ...fields, id });
  return getById(id);
}

/** Điều chỉnh tồn kho thủ công (ô inline ở trang Kho hàng). delta: số dương/âm để cộng/trừ. */
function adjustStock(id, delta, note) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError('VALIDATION_ERROR', 'Số lượng điều chỉnh không hợp lệ.', 400);
  }
  const tx = db.transaction(() => {
    const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(id);
    if (!product) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
    const newQty = product.stock_qty + delta;
    if (newQty < 0) {
      throw new AppError('INVALID_STOCK', 'Số lượng tồn sau điều chỉnh không được âm.', 422);
    }
    db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQty, id);
    db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity_change, note, ref_type)
       VALUES (?, 'manual_adjust', ?, ?, 'manual')`
    ).run(id, delta, note || null);
  });
  tx();
  return getById(id);
}

function getStockMovements(productId) {
  return db
    .prepare(
      `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC, id DESC LIMIT 200`
    )
    .all(productId);
}

function listCategories() {
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount
       FROM categories c ORDER BY c.name`
    )
    .all();
}

/** Tạo nhóm sản phẩm mới (VD: "Arabica", "Robusta"...). */
function createCategory(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new AppError('VALIDATION_ERROR', 'Tên nhóm không được để trống.', 400);
  const existed = db.prepare('SELECT id FROM categories WHERE name = ?').get(trimmed);
  if (existed) throw new AppError('DUPLICATE_NAME', 'Tên nhóm đã tồn tại.', 409);
  const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(trimmed);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

/** Đổi tên nhóm sản phẩm. */
function renameCategory(id, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new AppError('VALIDATION_ERROR', 'Tên nhóm không được để trống.', 400);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) throw new AppError('NOT_FOUND', 'Không tìm thấy nhóm sản phẩm.', 404);
  const dup = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(trimmed, id);
  if (dup) throw new AppError('DUPLICATE_NAME', 'Tên nhóm đã tồn tại.', 409);
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(trimmed, id);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

/**
 * Xóa nhóm sản phẩm. Sản phẩm thuộc nhóm bị xóa KHÔNG bị xóa theo - chỉ chuyển
 * về "chưa phân nhóm" (category_id = NULL), đúng với ràng buộc ON DELETE SET NULL
 * đã khai báo ở schema products.
 */
function deleteCategory(id) {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) throw new AppError('NOT_FOUND', 'Không tìm thấy nhóm sản phẩm.', 404);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { ok: true };
}

/**
 * Thống kê 1 sản phẩm trong khoảng ngày (mặc định 90 ngày gần nhất): số lượng bán,
 * doanh thu, số lượng hoàn và tỷ lệ hoàn CỦA RIÊNG sản phẩm này - khác với "mô tả"
 * (description) là thông tin tĩnh của sản phẩm.
 */
function getProductStat(productId, { dateFrom, dateTo } = {}) {
  const product = getById(productId);
  const from = dateFrom || '0000-01-01';
  const to = dateTo || '9999-12-31';

  const sold = db
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS qty, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = ? AND o.status = 'completed' AND date(o.completed_at) BETWEEN date(?) AND date(?)`
    )
    .get(productId, from, to);

  const returned = db
    .prepare(
      `SELECT COALESCE(SUM(ri.quantity), 0) AS qty
       FROM return_items ri JOIN return_orders ro ON ro.id = ri.return_order_id
       WHERE ri.product_id = ? AND date(ro.created_at) BETWEEN date(?) AND date(?)`
    )
    .get(productId, from, to);

  const returnRate = sold.qty > 0 ? returned.qty / sold.qty : 0;

  return {
    product,
    soldQty: sold.qty,
    revenue: sold.revenue,
    returnedQty: returned.qty,
    returnRate, // 0..1, UI nhân 100 để hiển thị %
  };
}

function lowStock() {
  return db
    .prepare(
      `SELECT * FROM products WHERE status='active' AND stock_qty <= min_stock_threshold ORDER BY stock_qty ASC`
    )
    .all();
}

module.exports = {
  list,
  getById,
  create,
  update,
  adjustStock,
  getStockMovements,
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  lowStock,
  getProductStat,
};
