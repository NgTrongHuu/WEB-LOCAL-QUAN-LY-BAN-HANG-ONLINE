/**
 * modules/feedback/feedback.service.js
 * Sổ góp ý khách hàng kiểu Messenger - hoàn toàn nhập tay, ĐỘC LẬP với
 * khách hàng ở Đơn đi (bảng customers). Không có "gửi/nhận" thật.
 */
const db = require('../../db/connection');
const { AppError } = require('../../lib/errors');

function listContacts(search) {
  const clause = search ? 'WHERE fc.name LIKE @search' : '';
  return db
    .prepare(
      `SELECT fc.*,
        (SELECT content FROM feedback_messages fm WHERE fm.contact_id = fc.id ORDER BY fm.created_at DESC, fm.id DESC LIMIT 1) AS lastMessage,
        (SELECT created_at FROM feedback_messages fm WHERE fm.contact_id = fc.id ORDER BY fm.created_at DESC, fm.id DESC LIMIT 1) AS lastMessageAt
       FROM feedback_contacts fc
       ${clause}
       ORDER BY lastMessageAt DESC, fc.created_at DESC`
    )
    .all(search ? { search: `%${search}%` } : {});
}

function createContact(name) {
  if (!name || !name.trim()) throw new AppError('VALIDATION_ERROR', 'Tên khách hàng không được để trống.', 400);
  const result = db.prepare('INSERT INTO feedback_contacts (name) VALUES (?)').run(name.trim());
  return db.prepare('SELECT * FROM feedback_contacts WHERE id = ?').get(result.lastInsertRowid);
}

function getMessages(contactId) {
  const contact = db.prepare('SELECT * FROM feedback_contacts WHERE id = ?').get(contactId);
  if (!contact) throw new AppError('NOT_FOUND', 'Không tìm thấy liên hệ.', 404);
  const messages = db
    .prepare('SELECT * FROM feedback_messages WHERE contact_id = ? ORDER BY created_at ASC, id ASC')
    .all(contactId);
  return { contact, messages };
}

function addMessage(contactId, content, label) {
  if (!content || !content.trim()) throw new AppError('VALIDATION_ERROR', 'Nội dung góp ý không được để trống.', 400);
  const contact = db.prepare('SELECT * FROM feedback_contacts WHERE id = ?').get(contactId);
  if (!contact) throw new AppError('NOT_FOUND', 'Không tìm thấy liên hệ.', 404);
  const validLabel = ['khen', 'phan_nan', 'gop_y'].includes(label) ? label : null;
  const result = db
    .prepare('INSERT INTO feedback_messages (contact_id, content, label) VALUES (?, ?, ?)')
    .run(contactId, content.trim(), validLabel);
  return db.prepare('SELECT * FROM feedback_messages WHERE id = ?').get(result.lastInsertRowid);
}

module.exports = { listContacts, createContact, getMessages, addMessage };
