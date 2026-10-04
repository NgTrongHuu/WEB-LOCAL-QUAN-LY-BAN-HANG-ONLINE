/**
 * pages/returns.js
 * Đơn hoàn về: danh sách phiếu trả + tạo phiếu trả từ 1 đơn đã hoàn thành.
 */
(function () {
  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Đơn hoàn về</h1>
        <div class="page-header__actions"><button class="btn btn-primary" id="btn-new-return">+ Trả hàng</button></div>
      </div>
      <div class="filter-bar">
        <input type="date" id="f-from" value="${UI.daysAgoIso(30)}" />
        <input type="date" id="f-to" value="${UI.todayIso()}" />
        <div class="search-input"><span class="search-input__icon">🔍</span><input id="f-search" placeholder="Tìm mã phiếu trả..." /></div>
      </div>
      <div id="return-table">${UI.skeletonRows(6)}</div>
    `;

    async function load() {
      const params = new URLSearchParams({
        dateFrom: document.getElementById('f-from').value,
        dateTo: document.getElementById('f-to').value,
        search: document.getElementById('f-search').value,
      });
      const { data } = await Api.get(`/returns?${params.toString()}`);
      renderTable(data);
    }
    ['f-from', 'f-to'].forEach((id) => document.getElementById(id).addEventListener('change', load));
    document.getElementById('f-search').addEventListener('input', UI.debounce(load, 300));
    document.getElementById('btn-new-return').addEventListener('click', () => openReturnForm(null, load));
    await load();

    window.ReturnsPage = { openFormForOrder: (orderId) => openReturnForm(orderId, load) };
  }

  function renderTable(rows) {
    const el = document.getElementById('return-table');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({ icon: '↩️', title: 'Chưa có phiếu trả hàng nào', desc: 'Tạo phiếu khi khách trả hàng từ 1 đơn đã hoàn thành.' });
      return;
    }
    el.innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Mã phiếu trả</th><th>Thời gian</th><th>Đơn gốc</th><th>Khách hàng</th><th class="num">Giá trị hoàn</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr><td>${UI.escapeHtml(r.code)}</td><td>${UI.formatDate(r.created_at)}</td>
            <td>${UI.escapeHtml(r.order_code)}</td><td>${UI.escapeHtml(r.customer_name || '—')}</td>
            <td class="num">${UI.formatMoney(r.refund_amount)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  async function openReturnForm(presetOrderId, onSaved) {
    let order = null;
    let items = [];

    const overlay = UI.openModal(`
      <div class="modal__header"><h3>Tạo phiếu trả hàng</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body">
        <div class="field"><label>Mã đơn hàng gốc (phải là đơn đã hoàn thành)</label>
          <div style="display:flex;gap:8px;">
            <input id="r-order-code" placeholder="Nhập mã đơn, ví dụ DH260930-1234" value="" />
            <button class="btn btn-secondary btn-sm" id="r-find-order">Tìm</button>
          </div>
        </div>
        <div id="r-order-info"></div>
        <div id="r-items-area"></div>
        <div class="field-row mt-4">
          <div class="field"><label>Lý do</label><input id="r-reason" placeholder="Khách đổi ý, hàng lỗi..." /></div>
          <div class="field"><label>Hình thức hoàn tiền</label><select id="r-method">
            <option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="ewallet">Ví điện tử</option>
          </select></div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn-secondary" data-close>Hủy</button>
        <button class="btn btn-primary" id="r-save" disabled>Tạo phiếu trả</button>
      </div>
    `);
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));

    async function loadOrderById(id) {
      const { data } = await Api.get(`/orders/${id}`);
      order = data;
      renderOrderInfo();
    }

    function renderOrderInfo() {
      const infoEl = overlay.querySelector('#r-order-info');
      const itemsEl = overlay.querySelector('#r-items-area');
      if (!order) { infoEl.innerHTML = ''; itemsEl.innerHTML = ''; return; }
      if (order.status !== 'completed') {
        infoEl.innerHTML = `<p class="text-danger text-small">Đơn ${UI.escapeHtml(order.code)} chưa hoàn thành, không thể tạo phiếu trả.</p>`;
        itemsEl.innerHTML = '';
        overlay.querySelector('#r-save').disabled = true;
        return;
      }
      infoEl.innerHTML = `<p class="text-small text-muted">Đơn ${UI.escapeHtml(order.code)} — khách: ${UI.escapeHtml(order.items[0]?.product_name ? (order.customer_id ? 'đã có thông tin' : '—') : '—')}</p>`;
      itemsEl.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Sản phẩm</th><th class="num">Đã mua</th><th class="num">SL hoàn</th><th>Nhập lại kho?</th></tr></thead>
        <tbody>${order.items.map((it) => {
          const returned = (order.returnedByProduct.find((r) => r.product_id === it.product_id) || {}).qty || 0;
          const remaining = it.quantity - returned;
          return `<tr>
            <td>${UI.escapeHtml(it.product_name)}</td>
            <td class="num">${it.quantity} (còn hoàn được ${remaining})</td>
            <td class="num"><input type="number" min="0" max="${remaining}" value="0" style="width:70px;" data-return-qty="${it.product_id}" ${remaining === 0 ? 'disabled' : ''} /></td>
            <td><input type="checkbox" checked data-restock="${it.product_id}" ${remaining === 0 ? 'disabled' : ''} /></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
      overlay.querySelector('#r-save').disabled = false;
    }

    overlay.querySelector('#r-find-order').addEventListener('click', async () => {
      const code = overlay.querySelector('#r-order-code').value.trim();
      if (!code) return;
      try {
        const { data } = await Api.get(`/orders?search=${encodeURIComponent(code)}&pageSize=1`);
        if (!data.length) { UI.toast('Không tìm thấy đơn hàng.', 'error'); return; }
        await loadOrderById(data[0].id);
      } catch (err) { UI.toast(err.message, 'error'); }
    });

    if (presetOrderId) await loadOrderById(presetOrderId);

    overlay.querySelector('#r-save').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        const itemInputs = overlay.querySelectorAll('[data-return-qty]');
        const items = [];
        itemInputs.forEach((input) => {
          const qty = Number(input.value);
          if (qty > 0) {
            const productId = Number(input.getAttribute('data-return-qty'));
            const restock = overlay.querySelector(`[data-restock="${productId}"]`).checked;
            items.push({ productId, quantity: qty, restock });
          }
        });
        if (!items.length) { UI.toast('Vui lòng nhập số lượng hoàn cho ít nhất 1 sản phẩm.', 'error'); return; }
        try {
          await Api.post('/returns', {
            orderId: order.id,
            reason: overlay.querySelector('#r-reason').value.trim(),
            refundMethod: overlay.querySelector('#r-method').value,
            items,
          });
          UI.toast('Đã tạo phiếu trả hàng.', 'success');
          overlay.remove();
          onSaved && onSaved();
        } catch (err) { UI.toast(err.message, 'error'); }
      }, 'Đang lưu...')
    );
  }

  Router.register('/returns', { render, title: 'Đơn hoàn về' });
})();
