/**
 * pages/orders.js
 * Đơn đi: danh sách + thanh tổng hợp + tạo đơn (kèm tạo nhanh sản phẩm) + hoàn thành/hủy.
 */
(function () {
  let orderItemsDraft = [];

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Đơn đi</h1>
        <div class="page-header__actions"><button class="btn btn-primary" id="btn-new-order">+ Tạo đơn</button></div>
      </div>
      <div class="filter-bar">
        <select id="f-status">
          <option value="">Tất cả trạng thái</option>
          <option value="processing">Đang xử lý</option>
          <option value="completed">Đã hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <input type="date" id="f-from" value="${UI.daysAgoIso(30)}" />
        <input type="date" id="f-to" value="${UI.todayIso()}" />
        <div class="search-input"><span class="search-input__icon">🔍</span><input id="f-search" placeholder="Tìm mã đơn / khách..." /></div>
      </div>
      <div class="kpi-grid" id="order-summary" style="grid-template-columns:repeat(3,1fr);">${UI.skeletonRows(3)}</div>
      <div id="order-table">${UI.skeletonRows(6)}</div>
    `;

    async function load() {
      const params = new URLSearchParams({
        status: document.getElementById('f-status').value,
        dateFrom: document.getElementById('f-from').value,
        dateTo: document.getElementById('f-to').value,
        search: document.getElementById('f-search').value,
      });
      const { data, meta } = await Api.get(`/orders?${params.toString()}`);
      document.getElementById('order-summary').innerHTML = `
        <div class="kpi-card"><div class="kpi-card__label">Tổng số đơn (theo bộ lọc)</div><div class="kpi-card__value">${meta.totalOrders}</div></div>
        <div class="kpi-card success"><div class="kpi-card__label">Doanh thu (đơn hoàn thành)</div><div class="kpi-card__value">${UI.formatMoney(meta.totalRevenue)}</div></div>
        <div class="kpi-card"><div class="kpi-card__label">Giá trị TB/đơn</div><div class="kpi-card__value">${UI.formatMoney(meta.totalOrders ? meta.totalRevenue / meta.totalOrders : 0)}</div></div>
      `;
      renderTable(data, load);
    }

    ['f-status', 'f-from', 'f-to'].forEach((id) => document.getElementById(id).addEventListener('change', load));
    document.getElementById('f-search').addEventListener('input', UI.debounce(load, 300));
    document.getElementById('btn-new-order').addEventListener('click', () => openOrderForm(load));
    await load();
  }

  function renderTable(rows, reload) {
    const el = document.getElementById('order-table');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({ icon: '🧾', title: 'Không có đơn hàng phù hợp', desc: 'Thử đổi bộ lọc hoặc tạo đơn mới.' });
      return;
    }
    el.innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Mã đơn</th><th>Thời gian</th><th>Khách hàng</th><th>Kênh</th><th class="num">Giá trị</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
        <tbody>${rows.map((o) => `
          <tr>
            <td>${UI.escapeHtml(o.code)}</td>
            <td>${UI.formatDate(o.created_at)}</td>
            <td>${UI.escapeHtml(o.customer_name || '—')}</td>
            <td>${UI.escapeHtml(o.channel_name || '—')}</td>
            <td class="num">${UI.formatMoney(o.subtotal - o.discount + o.shipping_fee)}</td>
            <td>${UI.statusBadge(o.status)}</td>
            <td>
              ${o.status === 'processing' ? `
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;">
                  <input type="checkbox" data-complete="${o.id}" /> Đã hoàn thành
                </label>
                <button class="btn btn-danger btn-sm" data-cancel="${o.id}" style="margin-top:4px;">Hủy đơn</button>
              ` : o.status === 'completed' ? `<button class="btn btn-secondary btn-sm" data-return="${o.id}">Tạo phiếu trả</button>` : ''}
            </td>
          </tr>`).join('')}</tbody>
      </table></div>`;

    el.querySelectorAll('[data-complete]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        if (!cb.checked) return;
        if (!confirm('Xác nhận đơn hàng đã hoàn thành? Hành động này sẽ khóa đơn và sinh phiếu thu.')) { cb.checked = false; return; }
        cb.disabled = true;
        try {
          await Api.post(`/orders/${cb.getAttribute('data-complete')}/complete`);
          UI.toast('Đã hoàn thành đơn hàng.', 'success');
          reload();
        } catch (err) {
          UI.toast(err.message, 'error');
          cb.checked = false;
          cb.disabled = false;
        }
      });
    });
    el.querySelectorAll('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', () =>
        UI.withButtonLoading(btn, async () => {
          if (!confirm('Hủy đơn này? Toàn bộ hàng sẽ được hoàn lại kho.')) return;
          try {
            await Api.post(`/orders/${btn.getAttribute('data-cancel')}/cancel`);
            UI.toast('Đã hủy đơn hàng.', 'success');
            reload();
          } catch (err) { UI.toast(err.message, 'error'); }
        }, 'Đang hủy...')
      );
    });
    el.querySelectorAll('[data-return]').forEach((btn) => {
      btn.addEventListener('click', () => {
        location.hash = '#/returns';
        setTimeout(() => window.ReturnsPage?.openFormForOrder(btn.getAttribute('data-return')), 150);
      });
    });
  }

  async function openOrderForm(onSaved) {
    orderItemsDraft = [];
    const [{ data: products }, { data: channels }] = await Promise.all([
      Api.get('/products?status=active&pageSize=100'),
      Api.get('/orders/channels'),
    ]);

    const overlay = UI.openModal(`
      <div class="modal__header"><h3>Tạo đơn hàng mới</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body">
        <div class="field-row">
          <div class="field"><label>Tên khách hàng</label><input id="o-customer-name" /></div>
          <div class="field"><label>Số điện thoại</label><input id="o-customer-phone" /></div>
        </div>
        <div class="field"><label>Địa chỉ giao</label><input id="o-customer-address" /></div>
        <div class="field-row">
          <div class="field"><label>Kênh bán</label><select id="o-channel">
            <option value="">— Không chọn —</option>
            ${channels.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('')}
          </select></div>
          <div class="field"><label>Phương thức thanh toán</label><select id="o-payment">
            <option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="ewallet">Ví điện tử</option>
          </select></div>
        </div>

        <div class="card" style="padding:var(--space-3);background:var(--color-bg);">
          <div style="display:flex;gap:8px;">
            <select id="o-product-select" style="flex:1;height:36px;border-radius:var(--radius-sm);border:1px solid var(--color-border);">
              ${products.map((p) => `<option value="${p.id}" data-price="${p.sell_price}" data-stock="${p.stock_qty}">${UI.escapeHtml(p.name)} — còn ${p.stock_qty}</option>`).join('')}
            </select>
            <input type="number" id="o-product-qty" value="1" min="1" style="width:70px;height:36px;border-radius:var(--radius-sm);border:1px solid var(--color-border);" />
            <button class="btn btn-secondary btn-sm" id="o-add-item">Thêm</button>
          </div>
          <button class="btn btn-secondary btn-sm mt-4" id="o-quick-create">+ Tạo nhanh sản phẩm</button>
        </div>

        <div id="o-items-list" class="mt-4"></div>

        <div class="field-row mt-4">
          <div class="field"><label>Giảm giá</label><input id="o-discount" type="number" value="0" /></div>
          <div class="field"><label>Phí giao hàng</label><input id="o-shipping" type="number" value="0" /></div>
        </div>
        <div id="o-total" style="font-weight:600;text-align:right;"></div>
      </div>
      <div class="modal__footer">
        <button class="btn btn-secondary" data-close>Hủy</button>
        <button class="btn btn-primary" id="o-save">Tạo đơn</button>
      </div>
    `);

    function refreshItemsList() {
      const list = overlay.querySelector('#o-items-list');
      if (!orderItemsDraft.length) {
        list.innerHTML = `<p class="text-small text-muted">Chưa có sản phẩm nào trong đơn.</p>`;
      } else {
        list.innerHTML = `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Sản phẩm</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th><th></th></tr></thead>
          <tbody>${orderItemsDraft.map((it, idx) => `
            <tr><td>${UI.escapeHtml(it.name)}</td><td class="num">${it.quantity}</td><td class="num">${UI.formatMoney(it.price)}</td>
              <td class="num">${UI.formatMoney(it.price * it.quantity)}</td>
              <td><button class="icon-btn" data-remove="${idx}">✕</button></td></tr>`).join('')}</tbody>
        </table></div>`;
        list.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
          orderItemsDraft.splice(Number(b.getAttribute('data-remove')), 1);
          refreshItemsList();
        }));
      }
      const subtotal = orderItemsDraft.reduce((s, it) => s + it.price * it.quantity, 0);
      const discount = Number(overlay.querySelector('#o-discount').value) || 0;
      const shipping = Number(overlay.querySelector('#o-shipping').value) || 0;
      overlay.querySelector('#o-total').textContent = `Tổng cộng: ${UI.formatMoney(subtotal - discount + shipping)}`;
    }

    overlay.querySelector('#o-add-item').addEventListener('click', () => {
      const select = overlay.querySelector('#o-product-select');
      const opt = select.selectedOptions[0];
      if (!opt) return;
      const qty = Number(overlay.querySelector('#o-product-qty').value) || 1;
      orderItemsDraft.push({ productId: Number(opt.value), name: opt.textContent.split(' — ')[0], price: Number(opt.dataset.price), quantity: qty });
      refreshItemsList();
    });
    overlay.querySelector('#o-discount').addEventListener('input', refreshItemsList);
    overlay.querySelector('#o-shipping').addEventListener('input', refreshItemsList);

    overlay.querySelector('#o-quick-create').addEventListener('click', () => {
      const quickOverlay = UI.openModal(`
        <div class="modal__header"><h3>Tạo nhanh sản phẩm</h3><button class="icon-btn" data-close>✕</button></div>
        <div class="modal__body">
          <div class="field"><label>Mã sản phẩm</label><input id="q-code" /></div>
          <div class="field"><label>Tên sản phẩm</label><input id="q-name" /></div>
          <div class="field-row">
            <div class="field"><label>Giá bán</label><input id="q-price" type="number" /></div>
            <div class="field"><label>Tồn kho ban đầu</label><input id="q-stock" type="number" value="0" /></div>
          </div>
        </div>
        <div class="modal__footer"><button class="btn btn-secondary" data-close>Hủy</button><button class="btn btn-primary" id="q-save">Tạo</button></div>
      `);
      quickOverlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
      quickOverlay.querySelector('#q-save').addEventListener('click', (e) =>
        UI.withButtonLoading(e.target, async () => {
          try {
            const { data: p } = await Api.post('/products', {
              code: quickOverlay.querySelector('#q-code').value.trim(),
              name: quickOverlay.querySelector('#q-name').value.trim(),
              sellPrice: Number(quickOverlay.querySelector('#q-price').value),
              initialStock: Number(quickOverlay.querySelector('#q-stock').value) || 0,
            });
            const select = overlay.querySelector('#o-product-select');
            const opt = document.createElement('option');
            opt.value = p.id; opt.dataset.price = p.sell_price; opt.dataset.stock = p.stock_qty;
            opt.textContent = `${p.name} — còn ${p.stock_qty}`;
            select.appendChild(opt);
            select.value = p.id;
            UI.toast('Đã tạo sản phẩm, có thể thêm vào đơn ngay.', 'success');
            quickOverlay.remove();
          } catch (err) { UI.toast(err.message, 'error'); }
        })
      );
    });

    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
    overlay.querySelector('#o-save').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        if (!orderItemsDraft.length) { UI.toast('Vui lòng thêm ít nhất 1 sản phẩm.', 'error'); return; }
        try {
          await Api.post('/orders', {
            customerName: overlay.querySelector('#o-customer-name').value.trim() || undefined,
            customerPhone: overlay.querySelector('#o-customer-phone').value.trim() || undefined,
            customerAddress: overlay.querySelector('#o-customer-address').value.trim() || undefined,
            channelId: Number(overlay.querySelector('#o-channel').value) || null,
            paymentMethod: overlay.querySelector('#o-payment').value,
            discount: Number(overlay.querySelector('#o-discount').value) || 0,
            shippingFee: Number(overlay.querySelector('#o-shipping').value) || 0,
            items: orderItemsDraft.map((it) => ({ productId: it.productId, quantity: it.quantity })),
          });
          UI.toast('Đã tạo đơn hàng.', 'success');
          overlay.remove();
          onSaved && onSaved();
        } catch (err) { UI.toast(err.message, 'error'); }
      }, 'Đang tạo đơn...')
    );

    refreshItemsList();
  }

  Router.register('/orders', { render, title: 'Đơn đi' });
})();
