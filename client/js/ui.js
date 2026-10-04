/**
 * ui.js
 * Các hàm dựng UI dùng chung: format tiền, toast, empty state, escape HTML...
 * Component thật sự (không phải business logic) - mọi page module đều dùng lại.
 */
const UI = (() => {
  function formatMoney(n) {
    const v = Math.round(Number(n) || 0);
    return v.toLocaleString('vi-VN') + '₫';
  }

  function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatPercent(n) {
    return (Number(n) * 100).toFixed(1) + '%';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function emptyState({ icon = '📭', title = 'Chưa có dữ liệu', desc = '', actionHtml = '' }) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${icon}</div>
        <div class="empty-state__title">${escapeHtml(title)}</div>
        <div class="empty-state__desc">${escapeHtml(desc)}</div>
        ${actionHtml}
      </div>`;
  }

  function skeletonRows(n = 5) {
    return Array.from({ length: n }).map(() => `<div class="skeleton skeleton-row"></div>`).join('');
  }

  function statusBadge(status) {
    const map = {
      processing: ['badge-warning', 'Đang xử lý'],
      completed: ['badge-success', 'Hoàn thành'],
      cancelled: ['badge-danger', 'Đã hủy'],
      active: ['badge-success', 'Đang bán'],
      inactive: ['badge-neutral', 'Ngừng bán'],
      thu: ['badge-success', 'Thu'],
      chi: ['badge-danger', 'Chi'],
    };
    const [cls, label] = map[status] || ['badge-neutral', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function openModal(innerHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay center';
    overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  function openDrawer(innerHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="drawer">${innerHtml}</div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeOverlay(el) {
    const overlay = el.closest('.overlay');
    if (overlay) overlay.remove();
  }

  function debounce(fn, wait = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /**
   * Chặn double-submit: khi bấm nút, tự disable + đổi nhãn "Đang lưu..." trong
   * lúc chờ request, rồi khôi phục nhãn gốc ở finally (cả lúc thành công & lỗi).
   * Không làm gì nếu nút đang bị disable sẵn (tránh bấm dồn/gọi lại khi đang chạy).
   */
  async function withButtonLoading(button, fn, loadingLabel = 'Đang lưu...') {
    if (!button || button.disabled) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = loadingLabel;
    try {
      return await fn();
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgoIso(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  return {
    formatMoney, formatDate, formatPercent, escapeHtml, toast, emptyState,
    skeletonRows, statusBadge, openModal, openDrawer, closeOverlay, debounce,
    withButtonLoading, todayIso, daysAgoIso,
  };
})();
