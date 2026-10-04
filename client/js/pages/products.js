/**
 * pages/products.js
 * Thực đơn (view="menu") và Kho hàng (view="inventory") DÙNG CHUNG 1 nguồn dữ liệu
 * (bảng products), chỉ khác cột hiển thị - đúng nghiệp vụ đã thống nhất.
 */
(function () {
  let categoriesCache = null;

  async function getCategories(forceRefresh = false) {
    if (!categoriesCache || forceRefresh) categoriesCache = (await Api.get('/products/categories')).data;
    return categoriesCache;
  }

  async function renderMenu(container) { await renderList(container, 'menu'); }
  async function renderInventory(container) { await renderList(container, 'inventory'); }

  async function renderList(container, view) {
    const isMenu = view === 'menu';
    const categories = await getCategories();

    container.innerHTML = `
      <div class="page-header">
        <h1>${isMenu ? 'Thực đơn' : 'Kho hàng'}</h1>
        <div class="page-header__actions">
          <button class="btn btn-secondary" id="btn-manage-categories">⚙️ Quản lý nhóm</button>
          ${isMenu ? `<button class="btn btn-primary" id="btn-new-product">+ Sản phẩm mới</button>` : ''}
        </div>
      </div>
      <div class="toolbar">
        <div class="toolbar__left">
          <div class="search-input"><span class="search-input__icon">🔍</span>
            <input type="text" id="search-input" placeholder="Tìm theo mã hoặc tên..." />
          </div>
          <select id="filter-category"><option value="">Tất cả nhóm</option>
            ${categories.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('')}
          </select>
          <select id="filter-status">
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngừng bán</option>
          </select>
        </div>
      </div>
      <div id="product-table">${UI.skeletonRows(6)}</div>
    `;

    async function reloadCategorySelect() {
      const fresh = await getCategories(true);
      const sel = document.getElementById('filter-category');
      const current = sel.value;
      sel.innerHTML = `<option value="">Tất cả nhóm</option>${fresh.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('')}`;
      sel.value = current;
    }

    async function load() {
      const params = new URLSearchParams({
        search: document.getElementById('search-input').value,
        categoryId: document.getElementById('filter-category').value,
        status: document.getElementById('filter-status').value,
      });
      const { data } = await Api.get(`/products?${params.toString()}`);
      renderTable(data, isMenu);
    }

    document.getElementById('search-input').addEventListener('input', UI.debounce(load, 300));
    document.getElementById('filter-category').addEventListener('change', load);
    document.getElementById('filter-status').addEventListener('change', load);
    document.getElementById('btn-manage-categories').addEventListener('click', () =>
      openCategoryManager(async () => {
        await reloadCategorySelect();
        await load();
      })
    );
    if (isMenu) {
      document.getElementById('btn-new-product').addEventListener('click', () => openProductForm(null, load));
    }

    await load();
  }

  /** Quản lý nhóm sản phẩm: thêm / đổi tên / xóa - dùng chung cho Thực đơn & Kho hàng. */
  async function openCategoryManager(onChanged) {
    async function renderBody() {
      const categories = await getCategories(true);
      overlay.querySelector('#category-list').innerHTML = categories.length
        ? categories.map((c) => `
            <div class="category-row" data-id="${c.id}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border);">
              <span style="flex:1;">${UI.escapeHtml(c.name)} <span class="text-small text-muted">(${c.productCount} sản phẩm)</span></span>
              <button class="btn btn-secondary btn-sm" data-rename="${c.id}" data-name="${UI.escapeHtml(c.name)}">Đổi tên</button>
              <button class="btn btn-secondary btn-sm" data-delete="${c.id}">Xóa</button>
            </div>`).join('')
        : UI.emptyState({ icon: '🏷️', title: 'Chưa có nhóm sản phẩm nào' });

      overlay.querySelectorAll('[data-rename]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const name = prompt('Tên nhóm mới:', btn.getAttribute('data-name'));
          if (name === null) return;
          try {
            await Api.patch(`/products/categories/${btn.getAttribute('data-rename')}`, { name });
            UI.toast('Đã đổi tên nhóm.', 'success');
            await renderBody();
            onChanged && onChanged();
          } catch (err) { UI.toast(err.message, 'error'); }
        });
      });
      overlay.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Xóa nhóm này? Sản phẩm thuộc nhóm sẽ chuyển về "chưa phân nhóm".')) return;
          try {
            await Api.del(`/products/categories/${btn.getAttribute('data-delete')}`);
            UI.toast('Đã xóa nhóm.', 'success');
            await renderBody();
            onChanged && onChanged();
          } catch (err) { UI.toast(err.message, 'error'); }
        });
      });
    }

    const overlay = UI.openModal(`
      <div class="modal__header"><h3>Quản lý nhóm sản phẩm</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body">
        <div class="field-row">
          <div class="field" style="flex:1;"><label>Tên nhóm mới</label><input id="new-category-name" placeholder="VD: Hạt rang mộc" /></div>
          <button class="btn btn-primary" id="add-category" style="align-self:flex-end;height:40px;">+ Thêm</button>
        </div>
        <div id="category-list" class="mt-4"></div>
      </div>
      <div class="modal__footer"><button class="btn btn-secondary" data-close>Đóng</button></div>
    `);
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
    overlay.querySelector('#add-category').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        const input = overlay.querySelector('#new-category-name');
        if (!input.value.trim()) { UI.toast('Vui lòng nhập tên nhóm.', 'error'); return; }
        try {
          await Api.post('/products/categories', { name: input.value.trim() });
          input.value = '';
          UI.toast('Đã thêm nhóm.', 'success');
          await renderBody();
          onChanged && onChanged();
        } catch (err) { UI.toast(err.message, 'error'); }
      })
    );
    await renderBody();
  }

  function renderTable(rows, isMenu) {
    const el = document.getElementById('product-table');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({
        icon: '📄', title: 'Chưa có sản phẩm nào',
        desc: 'Tạo sản phẩm đầu tiên để bắt đầu quản lý.',
      });
      return;
    }
    if (isMenu) {
      el.innerHTML = `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Mã</th><th>Tên sản phẩm</th><th>Nhóm</th><th class="num">Giá bán</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${rows.map((p) => `
            <tr class="clickable" data-id="${p.id}">
              <td>${UI.escapeHtml(p.code)}</td>
              <td>${UI.escapeHtml(p.name)}</td>
              <td>${UI.escapeHtml(p.category_name || '—')}</td>
              <td class="num">${UI.formatMoney(p.sell_price)}</td>
              <td>${UI.statusBadge(p.status)}</td>
              <td><button class="btn btn-secondary btn-sm" data-edit="${p.id}">Sửa</button></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
      el.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          window.ProductDetail.open(tr.getAttribute('data-id'));
        });
      });
      el.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const { data } = await Api.get(`/products/${btn.getAttribute('data-edit')}`);
          openProductForm(data, () => Router.render());
        });
      });
    } else {
      el.innerHTML = `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Sản phẩm</th><th class="num">Tồn kho</th><th style="width:120px">Điều chỉnh</th><th class="num">Giá vốn</th><th class="num">Định mức tối thiểu</th><th>Lịch sử</th></tr></thead>
          <tbody>${rows.map((p) => `
            <tr>
              <td>${UI.escapeHtml(p.name)} ${p.stock_qty <= p.min_stock_threshold ? '<span class="badge badge-danger" style="margin-left:6px">Sắp hết</span>' : ''}</td>
              <td class="num" id="stock-${p.id}">${p.stock_qty} ${p.unit}</td>
              <td>
                <div style="display:flex;gap:4px;align-items:center;">
                  <button class="btn btn-secondary btn-sm" data-adjust="-1" data-id="${p.id}">−</button>
                  <button class="btn btn-secondary btn-sm" data-adjust="1" data-id="${p.id}">+</button>
                </div>
              </td>
              <td class="num">${UI.formatMoney(p.cost_price)}</td>
              <td class="num">${p.min_stock_threshold}</td>
              <td><button class="btn btn-secondary btn-sm" data-history="${p.id}">Xem</button></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
      el.querySelectorAll('[data-adjust]').forEach((btn) => {
        btn.addEventListener('click', () => openStockAdjustPrompt(btn.getAttribute('data-id'), Number(btn.getAttribute('data-adjust'))));
      });
      el.querySelectorAll('[data-history]').forEach((btn) => {
        btn.addEventListener('click', () => openStockHistory(btn.getAttribute('data-history')));
      });
    }
  }

  function openStockAdjustPrompt(productId, direction) {
    const overlay = UI.openModal(`
      <div class="modal__header"><h3>Điều chỉnh tồn kho</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body">
        <div class="field"><label>Số lượng ${direction > 0 ? 'nhập thêm (+)' : 'giảm bớt (−)'}</label>
          <input type="number" id="adjust-qty" min="1" value="1" />
        </div>
        <div class="field"><label>Ghi chú (tùy chọn)</label><input type="text" id="adjust-note" placeholder="Lý do điều chỉnh..." /></div>
      </div>
      <div class="modal__footer">
        <button class="btn btn-secondary" data-close>Hủy</button>
        <button class="btn btn-primary" id="confirm-adjust">Xác nhận</button>
      </div>
    `);
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
    overlay.querySelector('#confirm-adjust').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        const qty = Number(overlay.querySelector('#adjust-qty').value);
        const note = overlay.querySelector('#adjust-note').value;
        const delta = direction > 0 ? qty : -qty;
        try {
          await Api.patch(`/products/${productId}/stock`, { delta, note });
          UI.toast('Đã cập nhật tồn kho.', 'success');
          overlay.remove();
          Router.render();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      })
    );
  }

  async function openStockHistory(productId) {
    const { data } = await Api.get(`/products/${productId}/stock-movements`);
    const typeLabel = { sale: 'Bán hàng', return: 'Trả hàng', manual_adjust: 'Điều chỉnh tay', cancel_restore: 'Hủy đơn - hoàn kho' };
    UI.openDrawer(`
      <div class="drawer__header"><h3>Lịch sử biến động tồn kho</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="drawer__body">
        ${data.length ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Thời gian</th><th>Loại</th><th class="num">Thay đổi</th><th>Ghi chú</th></tr></thead>
          <tbody>${data.map((m) => `
            <tr><td>${UI.formatDate(m.created_at)}</td><td>${typeLabel[m.type] || m.type}</td>
              <td class="num" style="color:${m.quantity_change > 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${m.quantity_change > 0 ? '+' : ''}${m.quantity_change}</td>
              <td>${UI.escapeHtml(m.note || '—')}</td></tr>`).join('')}</tbody>
        </table></div>` : UI.emptyState({ icon: '🗂️', title: 'Chưa có biến động nào' })}
      </div>
    `).querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
  }

  async function openProductForm(existing, onSaved) {
    const categories = await getCategories();
    const overlay = UI.openModal(`
      <div class="modal__header"><h3>${existing ? 'Sửa sản phẩm' : 'Sản phẩm mới'}</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body">
        <div class="field-row">
          <div class="field"><label>Mã sản phẩm</label><input id="f-code" ${existing ? 'disabled' : ''} value="${existing ? UI.escapeHtml(existing.code) : ''}" /></div>
          <div class="field"><label>Nhóm sản phẩm</label><select id="f-category">
            <option value="">— Chọn nhóm —</option>
            ${categories.map((c) => `<option value="${c.id}" ${existing?.category_id === c.id ? 'selected' : ''}>${UI.escapeHtml(c.name)}</option>`).join('')}
          </select></div>
        </div>
        <div class="field"><label>Tên sản phẩm</label><input id="f-name" value="${existing ? UI.escapeHtml(existing.name) : ''}" /></div>
        <div class="field"><label>Mô tả</label><textarea id="f-description">${existing ? UI.escapeHtml(existing.description || '') : ''}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Đơn vị</label><input id="f-unit" value="${existing ? UI.escapeHtml(existing.unit) : 'túi'}" /></div>
          <div class="field"><label>Khối lượng (gram)</label><input id="f-weight" type="number" value="${existing ? existing.weight_grams || '' : ''}" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Giá bán</label><input id="f-sell" type="number" value="${existing ? existing.sell_price : ''}" /></div>
          <div class="field"><label>Giá vốn</label><input id="f-cost" type="number" value="${existing ? existing.cost_price : 0}" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Định mức tồn tối thiểu</label><input id="f-min" type="number" value="${existing ? existing.min_stock_threshold : 5}" /></div>
          ${!existing ? `<div class="field"><label>Tồn kho ban đầu</label><input id="f-initial-stock" type="number" value="0" /></div>` : `
          <div class="field"><label>Trạng thái</label><select id="f-status">
            <option value="active" ${existing.status === 'active' ? 'selected' : ''}>Đang bán</option>
            <option value="inactive" ${existing.status === 'inactive' ? 'selected' : ''}>Ngừng bán</option>
          </select></div>`}
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn-secondary" data-close>Hủy</button>
        <button class="btn btn-primary" id="save-product">Lưu</button>
      </div>
    `);
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
    overlay.querySelector('#save-product').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        const payload = {
          code: overlay.querySelector('#f-code').value.trim(),
          name: overlay.querySelector('#f-name').value.trim(),
          description: overlay.querySelector('#f-description').value.trim(),
          categoryId: Number(overlay.querySelector('#f-category').value) || null,
          unit: overlay.querySelector('#f-unit').value.trim(),
          weightGrams: Number(overlay.querySelector('#f-weight').value) || null,
          sellPrice: Number(overlay.querySelector('#f-sell').value),
          costPrice: Number(overlay.querySelector('#f-cost').value) || 0,
          minStockThreshold: Number(overlay.querySelector('#f-min').value) || 0,
        };
        try {
          if (existing) {
            payload.status = overlay.querySelector('#f-status').value;
            await Api.patch(`/products/${existing.id}`, payload);
          } else {
            payload.initialStock = Number(overlay.querySelector('#f-initial-stock').value) || 0;
            await Api.post('/products', payload);
          }
          UI.toast('Đã lưu sản phẩm.', 'success');
          overlay.remove();
          onSaved && onSaved();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      })
    );
  }

  // Dùng lại ở nhiều trang khác (dashboard, orders...) để mở nhanh chi tiết sản phẩm
  window.ProductDetail = {
    async open(productId) {
      const dateFrom = UI.daysAgoIso(30);
      const dateTo = UI.todayIso();
      const [{ data: movements }, { data: statData }] = await Promise.all([
        Api.get(`/products/${productId}/stock-movements`),
        Api.get(`/products/${productId}/stat?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ]);
      const product = statData.product;
      const stat = { quantity: statData.soldQty, revenue: statData.revenue };

      const overlay = UI.openDrawer(`
        <div class="drawer__header"><h3>${UI.escapeHtml(product.name)}</h3><button class="icon-btn" data-close>✕</button></div>
        <div class="drawer__body">
          <div class="tabs">
            <button class="active" data-tab="desc">Mô tả</button>
            <button data-tab="analysis">Phân tích (30 ngày)</button>
          </div>
          <div id="tab-desc">
            <p><strong>Mã:</strong> ${UI.escapeHtml(product.code)}</p>
            <p><strong>Nhóm:</strong> ${UI.escapeHtml(product.category_name || '—')}</p>
            <p><strong>Giá bán:</strong> ${UI.formatMoney(product.sell_price)}</p>
            <p><strong>Trạng thái:</strong> ${UI.statusBadge(product.status)}</p>
            <p><strong>Mô tả:</strong><br>${UI.escapeHtml(product.description || 'Chưa có mô tả.')}</p>
          </div>
          <div id="tab-analysis" class="hidden">
            <div class="kpi-grid" style="grid-template-columns:1fr 1fr;">
              <div class="kpi-card"><div class="kpi-card__label">SL đã bán</div><div class="kpi-card__value">${stat.quantity}</div></div>
              <div class="kpi-card success"><div class="kpi-card__label">Doanh thu</div><div class="kpi-card__value">${UI.formatMoney(stat.revenue)}</div></div>
              <div class="kpi-card"><div class="kpi-card__label">Tồn kho hiện tại</div><div class="kpi-card__value">${product.stock_qty}</div></div>
              <div class="kpi-card warning"><div class="kpi-card__label">Lợi nhuận ước tính</div><div class="kpi-card__value">${UI.formatMoney((product.sell_price - product.cost_price) * stat.quantity)}</div></div>
              <div class="kpi-card"><div class="kpi-card__label">SL hoàn</div><div class="kpi-card__value">${statData.returnedQty}</div></div>
              <div class="kpi-card danger"><div class="kpi-card__label">Tỷ lệ hoàn</div><div class="kpi-card__value">${UI.formatPercent(statData.returnRate)}</div></div>
            </div>
            <p class="text-small text-muted mt-4">${movements.length} lượt biến động tồn kho gần đây.</p>
          </div>
        </div>
      `);
      overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
      overlay.querySelectorAll('.tabs button').forEach((btn) => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          overlay.querySelector('#tab-desc').classList.toggle('hidden', btn.dataset.tab !== 'desc');
          overlay.querySelector('#tab-analysis').classList.toggle('hidden', btn.dataset.tab !== 'analysis');
        });
      });
    },
  };

  Router.register('/products', { render: renderMenu, title: 'Thực đơn' });
  Router.register('/inventory', { render: renderInventory, title: 'Kho hàng' });
})();
