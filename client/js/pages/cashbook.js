/**
 * pages/cashbook.js
 * Sổ quỹ: thanh tổng hợp (quỹ đầu kỳ, tổng thu, tổng chi, tồn quỹ) + danh sách + tạo tay.
 */
(function () {
  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Sổ quỹ</h1>
        <div class="page-header__actions">
          <button class="btn btn-secondary" id="btn-new-thu">+ Phiếu thu</button>
          <button class="btn btn-secondary" id="btn-new-chi">+ Phiếu chi</button>
        </div>
      </div>
      <div class="filter-bar">
        <select id="f-fund"><option value="">Tất cả quỹ</option><option value="cash">Tiền mặt</option><option value="bank">Ngân hàng</option><option value="ewallet">Ví điện tử</option></select>
        <input type="date" id="f-from" value="${UI.daysAgoIso(30)}" />
        <input type="date" id="f-to" value="${UI.todayIso()}" />
      </div>
      <div class="kpi-grid" id="cash-summary">${UI.skeletonRows(4)}</div>
      <div id="cash-table">${UI.skeletonRows(6)}</div>
    `;

    async function load() {
      const fund = document.getElementById('f-fund').value;
      const dateFrom = document.getElementById('f-from').value;
      const dateTo = document.getElementById('f-to').value;
      const [{ data: summary }, { data: rows }] = await Promise.all([
        Api.get(`/cash-transactions/summary?fundType=${fund}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        Api.get(`/cash-transactions?fundType=${fund}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ]);
      document.getElementById('cash-summary').innerHTML = `
        <div class="kpi-card"><div class="kpi-card__label">Quỹ đầu kỳ</div><div class="kpi-card__value">${UI.formatMoney(summary.opening)}</div></div>
        <div class="kpi-card success"><div class="kpi-card__label">Tổng thu</div><div class="kpi-card__value">${UI.formatMoney(summary.totalThu)}</div></div>
        <div class="kpi-card danger"><div class="kpi-card__label">Tổng chi</div><div class="kpi-card__value">${UI.formatMoney(summary.totalChi)}</div></div>
        <div class="kpi-card"><div class="kpi-card__label">Tồn quỹ</div><div class="kpi-card__value">${UI.formatMoney(summary.closing)}</div></div>
      `;
      renderTable(rows);
    }

    ['f-fund', 'f-from', 'f-to'].forEach((id) => document.getElementById(id).addEventListener('change', load));
    document.getElementById('btn-new-thu').addEventListener('click', () => openManualForm('thu', load));
    document.getElementById('btn-new-chi').addEventListener('click', () => openManualForm('chi', load));
    await load();
  }

  const fundLabel = { cash: 'Tiền mặt', bank: 'Ngân hàng', ewallet: 'Ví điện tử' };

  function renderTable(rows) {
    const el = document.getElementById('cash-table');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({ icon: '💰', title: 'Chưa có phiếu thu/chi nào trong khoảng thời gian này' });
      return;
    }
    el.innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Thời gian</th><th>Loại</th><th>Quỹ</th><th>Diễn giải</th><th class="num">Giá trị</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr><td>${UI.formatDate(r.created_at)}</td><td>${UI.statusBadge(r.type)}</td>
            <td>${fundLabel[r.fund_type]}</td><td>${UI.escapeHtml(r.category || '')} ${r.note ? '· ' + UI.escapeHtml(r.note) : ''}</td>
            <td class="num" style="color:${r.type === 'thu' ? 'var(--color-success)' : 'var(--color-danger)'}">${r.type === 'thu' ? '+' : '-'}${UI.formatMoney(r.amount)}</td>
          </tr>`).join('')}</tbody>
      </table></div>`;
  }

  function openManualForm(type, onSaved) {
    const overlay = UI.openModal(`
      <div class="modal__header"><h3>${type === 'thu' ? 'Tạo phiếu thu' : 'Tạo phiếu chi'}</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body">
        <div class="field"><label>Quỹ</label><select id="m-fund">
          <option value="cash">Tiền mặt</option><option value="bank">Ngân hàng</option><option value="ewallet">Ví điện tử</option>
        </select></div>
        <div class="field"><label>Loại thu/chi</label><input id="m-category" placeholder="${type === 'thu' ? 'VD: Thu khác' : 'VD: Nhập hàng, chi phí vận chuyển...'}" /></div>
        <div class="field"><label>Số tiền</label><input id="m-amount" type="number" /></div>
        <div class="field"><label>Ghi chú</label><textarea id="m-note"></textarea></div>
      </div>
      <div class="modal__footer"><button class="btn btn-secondary" data-close>Hủy</button><button class="btn btn-primary" id="m-save">Lưu</button></div>
    `);
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
    overlay.querySelector('#m-save').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        try {
          await Api.post('/cash-transactions', {
            type, fundType: overlay.querySelector('#m-fund').value,
            category: overlay.querySelector('#m-category').value.trim(),
            amount: Number(overlay.querySelector('#m-amount').value),
            note: overlay.querySelector('#m-note').value.trim(),
          });
          UI.toast('Đã lưu phiếu.', 'success');
          overlay.remove();
          onSaved && onSaved();
        } catch (err) { UI.toast(err.message, 'error'); }
      })
    );
  }

  Router.register('/cashbook', { render, title: 'Sổ quỹ' });
})();
