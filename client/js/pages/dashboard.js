/**
 * pages/dashboard.js
 * Tổng quan: KPI, top sản phẩm, hàng hoàn về (2 bảng xếp hạng khác nhau), kênh bán.
 * Toàn bộ số liệu lấy từ /api/analytics/* - không tự tính lại ở client.
 */
(function () {
  async function render(container) {
    const dateFrom = UI.daysAgoIso(7);
    const dateTo = UI.todayIso();

    container.innerHTML = `
      <div class="page-header"><h1>Bức tranh kinh doanh</h1></div>
      <div class="kpi-grid" id="kpi-grid">${UI.skeletonRows(3)}</div>
      <div class="grid-2 mt-4">
        <div class="card">
          <div class="card__header"><h2>Hiệu quả sản phẩm (7 ngày qua)</h2></div>
          <div id="top-products">${UI.skeletonRows(5)}</div>
        </div>
        <div class="card">
          <div class="card__header"><h2>Kênh bán hàng</h2></div>
          <div id="channels">${UI.skeletonRows(4)}</div>
        </div>
      </div>
      <div class="card mt-4">
        <div class="card__header"><h2>Hàng hoàn về</h2></div>
        <div class="tabs">
          <button class="active" data-tab="qty">Theo số lượng hoàn</button>
          <button data-tab="rate">Theo tỷ lệ hoàn</button>
        </div>
        <div id="returns-table">${UI.skeletonRows(5)}</div>
      </div>
      <div class="card mt-4" id="low-stock-card"></div>
    `;

    const [overview, topProducts, returnsData, channels, lowStock, customers] = await Promise.all([
      Api.get(`/analytics/overview?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      Api.get(`/analytics/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=8`),
      Api.get(`/analytics/returns?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      Api.get(`/analytics/channels?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      Api.get('/products/low-stock'),
      Api.get(`/analytics/customers?dateFrom=${dateFrom}&dateTo=${dateTo}`),
    ]);

    renderKpis(overview.data, customers.data);
    renderTopProducts(topProducts.data);
    renderChannels(channels.data);
    renderReturns(returnsData.data, 'qty');
    renderLowStock(lowStock.data);

    document.querySelectorAll('#page-content .tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#page-content .tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderReturns(returnsData.data, btn.getAttribute('data-tab'));
      });
    });
  }

  function renderKpis(o, customers) {
    document.getElementById('kpi-grid').innerHTML = `
      <div class="kpi-card success">
        <div class="kpi-card__label">Doanh thu thuần (7 ngày qua)</div>
        <div class="kpi-card__value">${UI.formatMoney(o.netRevenue)}</div>
        <div class="kpi-card__sub"><span>Doanh thu gộp</span><span>${UI.formatMoney(o.revenue)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__label">Số đơn hoàn thành</div>
        <div class="kpi-card__value">${o.totalOrders}</div>
        <div class="kpi-card__sub"><span>Giá trị TB/đơn</span><span>${UI.formatMoney(o.avgOrderValue)}</span></div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-card__label">Tỷ lệ hoàn</div>
        <div class="kpi-card__value">${UI.formatPercent(o.returnRate)}</div>
        <div class="kpi-card__sub"><span>Giá trị hoàn</span><span>${UI.formatMoney(o.returnedAmount)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__label">Khách hàng (7 ngày qua)</div>
        <div class="kpi-card__value">${customers.newCustomers + customers.returningCustomers}</div>
        <div class="kpi-card__sub"><span>Mới: ${customers.newCustomers}</span><span>Quay lại: ${customers.returningCustomers}</span></div>
      </div>
    `;
  }

  function renderTopProducts(rows) {
    const el = document.getElementById('top-products');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({ icon: '📦', title: 'Chưa bán sản phẩm nào', desc: 'Dữ liệu sẽ hiện khi có đơn hoàn thành.' });
      return;
    }
    el.innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Sản phẩm</th><th class="num">SL bán</th><th class="num">Doanh thu</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="clickable" data-product-id="${r.id}">
              <td>${UI.escapeHtml(r.name)}</td>
              <td class="num">${r.quantity}</td>
              <td class="num">${UI.formatMoney(r.revenue)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;
    el.querySelectorAll('tr[data-product-id]').forEach((tr) => {
      tr.addEventListener('click', () => window.ProductDetail?.open(tr.getAttribute('data-product-id')));
    });
  }

  function renderChannels(rows) {
    const el = document.getElementById('channels');
    const active = rows.filter((r) => r.orderCount > 0);
    if (!active.length) {
      el.innerHTML = UI.emptyState({ icon: '🛰️', title: 'Chưa có đơn theo kênh', desc: 'Gán kênh bán khi tạo đơn để xem tại đây.' });
      return;
    }
    el.innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Kênh</th><th class="num">Số đơn</th><th class="num">Doanh thu</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${UI.escapeHtml(r.name)}</td><td class="num">${r.orderCount}</td><td class="num">${UI.formatMoney(r.revenue)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  function renderReturns(data, mode) {
    const rows = mode === 'qty' ? data.byQuantity : data.byRate;
    const el = document.getElementById('returns-table');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({ icon: '↩️', title: 'Chưa có hàng hoàn về', desc: 'Đây là tin tốt!' });
      return;
    }
    el.innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Sản phẩm</th><th class="num">SL bán</th><th class="num">SL hoàn</th><th class="num">Tỷ lệ hoàn</th><th class="num">Giá trị hoàn</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td>${UI.escapeHtml(r.name)}</td>
            <td class="num">${r.soldQty}</td>
            <td class="num">${r.returnedQty}</td>
            <td class="num">${UI.formatPercent(r.returnRate)}</td>
            <td class="num">${UI.formatMoney(r.returnedAmount)}</td>
          </tr>`).join('')}</tbody>
      </table></div>
      <p class="text-small text-muted mt-4">Lưu ý: "số lượng hoàn nhiều nhất" và "tỷ lệ hoàn cao nhất" là 2 chỉ số khác nhau - một sản phẩm bán ít nhưng tỷ lệ hoàn cao vẫn đáng chú ý dù số lượng tuyệt đối thấp.</p>`;
  }

  function renderLowStock(rows) {
    const el = document.getElementById('low-stock-card');
    if (!rows.length) { el.style.display = 'none'; return; }
    el.innerHTML = `
      <div class="card__header"><h2>⚠️ Sản phẩm sắp hết hàng</h2></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Sản phẩm</th><th class="num">Tồn kho</th><th class="num">Định mức tối thiểu</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr><td>${UI.escapeHtml(r.name)}</td><td class="num text-danger">${r.stock_qty}</td><td class="num">${r.min_stock_threshold}</td></tr>
        `).join('')}</tbody>
      </table></div>`;
  }

  Router.register('/dashboard', { render, title: 'Tổng quan' });
})();
