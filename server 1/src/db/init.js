/**
 * db/init.js
 * Tạo toàn bộ schema (bảng, ràng buộc, index) nếu chưa có, và seed dữ liệu
 * khởi tạo tối thiểu (tài khoản owner + danh mục/kênh bán mẫu) khi DB còn trống.
 *
 * Idempotent: chạy lại nhiều lần không lỗi, không tạo trùng (dùng CREATE TABLE IF NOT EXISTS
 * và kiểm tra COUNT trước khi seed).
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');
const env = require('../config/env');

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','staff')),
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      unit TEXT NOT NULL DEFAULT 'túi',
      weight_grams INTEGER,
      sell_price REAL NOT NULL CHECK (sell_price >= 0),
      cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
      stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
      min_stock_threshold INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_qty);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      discount REAL NOT NULL DEFAULT 0,
      shipping_fee REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank','ewallet')),
      status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','cancelled')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      expected_delivery_date TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);
    CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel_id);
    -- Composite: lọc theo trạng thái + sắp xếp theo ngày tạo là truy vấn phổ biến nhất
    -- của trang Đơn đi (danh sách theo tab trạng thái, mới nhất trước).
    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
    -- Composite: báo cáo/phân tích doanh thu luôn lọc completed + khoảng completed_at.
    CREATE INDEX IF NOT EXISTS idx_orders_status_completed ON orders(status, completed_at);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

    CREATE TABLE IF NOT EXISTS return_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      reason TEXT,
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_method TEXT NOT NULL DEFAULT 'cash' CHECK (refund_method IN ('cash','bank','ewallet')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_return_orders_order ON return_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_return_orders_created_at ON return_orders(created_at);
    -- Composite: tra "các phiếu trả của 1 đơn, mới nhất trước" (kiểm tra số lượng còn được hoàn).
    CREATE INDEX IF NOT EXISTS idx_return_orders_order_created ON return_orders(order_id, created_at);

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_order_id INTEGER NOT NULL REFERENCES return_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_at_sale REAL NOT NULL,
      restock INTEGER NOT NULL DEFAULT 1 CHECK (restock IN (0,1))
    );
    CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_order_id);
    CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id);

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      type TEXT NOT NULL CHECK (type IN ('sale','return','manual_adjust','cancel_restore')),
      quantity_change INTEGER NOT NULL,
      note TEXT,
      ref_type TEXT,
      ref_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at);

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('thu','chi')),
      fund_type TEXT NOT NULL CHECK (fund_type IN ('cash','bank','ewallet')),
      category TEXT,
      amount REAL NOT NULL CHECK (amount >= 0),
      related_type TEXT CHECK (related_type IN ('order','return','manual')),
      related_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cash_created_at ON cash_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_cash_fund_type ON cash_transactions(fund_type);
    -- Composite: Sổ quỹ lọc theo quỹ + khoảng ngày cùng lúc là truy vấn chính của trang.
    CREATE INDEX IF NOT EXISTS idx_cash_fund_created ON cash_transactions(fund_type, created_at);

    CREATE TABLE IF NOT EXISTS feedback_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES feedback_contacts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      label TEXT CHECK (label IN ('khen','phan_nan','gop_y') OR label IS NULL),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_messages_contact ON feedback_messages(contact_id, created_at);
  `);
}

function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync(env.OWNER_PASSWORD, 10);
    db.prepare(
      'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)'
    ).run(env.OWNER_EMAIL, hash, 'owner', 'Chủ shop');
    // eslint-disable-next-line no-console
    console.log('----------------------------------------------------');
    console.log('Đã tạo tài khoản OWNER đầu tiên:');
    console.log(`  Email:    ${env.OWNER_EMAIL}`);
    console.log(`  Mật khẩu: ${env.OWNER_PASSWORD}`);
    console.log('  -> Hãy đổi mật khẩu này sau khi đăng nhập lần đầu.');
    console.log('----------------------------------------------------');
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (categoryCount === 0) {
    const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
    ['Arabica', 'Robusta', 'Blend'].forEach((name) => insertCategory.run(name));
  }

  const channelCount = db.prepare('SELECT COUNT(*) AS c FROM channels').get().c;
  if (channelCount === 0) {
    const insertChannel = db.prepare('INSERT INTO channels (name) VALUES (?)');
    ['Website', 'Shopee', 'Grab/Now', 'Fanpage/Zalo'].forEach((name) => insertChannel.run(name));
  }

  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (productCount === 0) {
    const categories = db.prepare('SELECT id, name FROM categories').all();
    const catId = (name) => categories.find((c) => c.name === name).id;
    const insertProduct = db.prepare(`
      INSERT INTO products (code, name, description, category_id, unit, weight_grams, sell_price, cost_price, stock_qty, min_stock_threshold, status)
      VALUES (@code, @name, @description, @category_id, @unit, @weight_grams, @sell_price, @cost_price, @stock_qty, @min_stock_threshold, 'active')
    `);
    const samples = [
      { code: 'ARB-250', name: 'Cà phê Arabica rang xay 250g', description: 'Hạt Arabica Cầu Đất, rang vừa, vị chua thanh, hậu ngọt.', category_id: catId('Arabica'), unit: 'túi', weight_grams: 250, sell_price: 95000, cost_price: 55000, stock_qty: 40, min_stock_threshold: 10 },
      { code: 'ARB-500', name: 'Cà phê Arabica rang xay 500g', description: 'Hạt Arabica Cầu Đất, rang vừa, vị chua thanh, hậu ngọt.', category_id: catId('Arabica'), unit: 'túi', weight_grams: 500, sell_price: 175000, cost_price: 100000, stock_qty: 25, min_stock_threshold: 8 },
      { code: 'ROB-250', name: 'Cà phê Robusta rang mộc 250g', description: 'Hạt Robusta Buôn Ma Thuột, rang đậm, vị đắng mạnh, nhiều caffeine.', category_id: catId('Robusta'), unit: 'túi', weight_grams: 250, sell_price: 75000, cost_price: 42000, stock_qty: 60, min_stock_threshold: 15 },
      { code: 'ROB-500', name: 'Cà phê Robusta rang mộc 500g', description: 'Hạt Robusta Buôn Ma Thuột, rang đậm, vị đắng mạnh, nhiều caffeine.', category_id: catId('Robusta'), unit: 'túi', weight_grams: 500, sell_price: 140000, cost_price: 80000, stock_qty: 30, min_stock_threshold: 10 },
      { code: 'BLD-250', name: 'Cà phê Blend 70/30 rang xay 250g', description: 'Phối trộn 70% Robusta - 30% Arabica, cân bằng đắng - thơm.', category_id: catId('Blend'), unit: 'túi', weight_grams: 250, sell_price: 85000, cost_price: 48000, stock_qty: 8, min_stock_threshold: 10 },
      { code: 'BLD-500', name: 'Cà phê Blend 70/30 rang xay 500g', description: 'Phối trộn 70% Robusta - 30% Arabica, cân bằng đắng - thơm.', category_id: catId('Blend'), unit: 'túi', weight_grams: 500, sell_price: 155000, cost_price: 88000, stock_qty: 3, min_stock_threshold: 10 },
    ];
    samples.forEach((p) => insertProduct.run(p));
  }
}

function initDatabase() {
  createSchema();
  seedIfEmpty();
}

module.exports = { initDatabase };
