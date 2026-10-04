/**
 * lib/schemas.js
 * Tập trung toàn bộ Zod schema validate request body cho các route mutating.
 * Mục tiêu: chặn dữ liệu rác (thiếu field, âm, NaN, quá dài...) NGAY tại biên
 * API, trả lỗi 400 rõ ràng, thay vì để crash sâu trong service/DB.
 */
const { z } = require('zod');

const nonEmptyString = (max = 255) => z.string().trim().min(1).max(max);
const optionalString = (max = 2000) => z.string().trim().max(max).optional().nullable();
const positiveInt = () => z.number().int().positive();
const positiveNumber = () => z.number().nonnegative();

// ---- Orders ----
const orderItemSchema = z.object({
  productId: z.union([z.number(), z.string()]),
  quantity: positiveInt(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  customerId: z.union([z.number(), z.string()]).optional().nullable(),
  customerName: optionalString(255),
  customerPhone: optionalString(30),
  customerAddress: optionalString(500),
  channelId: z.union([z.number(), z.string()]).optional().nullable(),
  discount: positiveNumber().optional(),
  shippingFee: positiveNumber().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'ewallet']).optional(),
  expectedDeliveryDate: optionalString(40),
  note: optionalString(2000),
});

// ---- Returns ----
const returnItemSchema = z.object({
  productId: z.union([z.number(), z.string()]),
  quantity: positiveInt(),
  restock: z.boolean().optional(),
});

const createReturnSchema = z.object({
  orderId: z.union([z.number(), z.string()]),
  items: z.array(returnItemSchema).min(1, 'Phiếu trả phải có ít nhất 1 sản phẩm'),
  reason: optionalString(1000),
  refundMethod: z.enum(['cash', 'bank', 'ewallet']).optional(),
});

// ---- Products ----
const createProductSchema = z.object({
  code: nonEmptyString(50),
  name: nonEmptyString(255),
  description: optionalString(4000),
  categoryId: z.union([z.number(), z.string()]).optional().nullable(),
  unit: optionalString(20),
  weightGrams: positiveNumber().optional().nullable(),
  sellPrice: positiveNumber(),
  costPrice: positiveNumber().optional(),
  minStockThreshold: z.number().int().nonnegative().optional(),
  initialStock: z.number().int().nonnegative().optional(),
});

const updateProductSchema = z.object({
  name: nonEmptyString(255).optional(),
  description: optionalString(4000),
  categoryId: z.union([z.number(), z.string()]).optional().nullable(),
  unit: optionalString(20),
  weightGrams: positiveNumber().optional().nullable(),
  sellPrice: positiveNumber().optional(),
  costPrice: positiveNumber().optional(),
  minStockThreshold: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const adjustStockSchema = z.object({
  delta: z.number().int().refine((v) => v !== 0, 'Số lượng điều chỉnh phải khác 0'),
  note: optionalString(500),
});

const categorySchema = z.object({
  name: nonEmptyString(100),
});

// ---- Cashbook ----
const cashManualSchema = z.object({
  type: z.enum(['thu', 'chi']),
  fundType: z.enum(['cash', 'bank', 'ewallet']),
  category: optionalString(255),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  note: optionalString(2000),
});

// ---- Auth ----
const loginSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự'),
});

// ---- Feedback ----
const feedbackContactSchema = z.object({
  name: nonEmptyString(255),
});

const feedbackMessageSchema = z.object({
  content: nonEmptyString(4000),
  label: z.enum(['khen', 'phan_nan', 'gop_y']).optional().nullable(),
});

module.exports = {
  createOrderSchema,
  createReturnSchema,
  createProductSchema,
  updateProductSchema,
  adjustStockSchema,
  categorySchema,
  cashManualSchema,
  loginSchema,
  changePasswordSchema,
  feedbackContactSchema,
  feedbackMessageSchema,
};
