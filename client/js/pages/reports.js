/**
 * pages/reports.js
 * Báo cáo cuối ngày - khung xem trước dạng "tờ giấy", có nút in.
 */
(function () {
  async function render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Báo cáo cuối ngày</h1>
        <div class="page-header__actions"><button class="btn btn-secondary" id="btn-print">🖨️ In báo cáo</button></div>
      </div>
      <div class="grid-2">
        <div></div>
        <div class="card">
          <div class="field"><label>Ngày báo cáo</label><input type="date" id="r-date" value="${UI.todayIso()}" /></div>
        </div>
      </div>
      <div class="report-viewer mt-4"><div class="report-paper" id="report-paper">${UI.skeletonRows(8)}</div></div>
    `;
    // Đảo lại layout: sidebar trái, report bên phải cho đúng tinh thần đã thiết kế
    container.querySelector('.grid-2').innerHTML = `
      <div class="card">
        <div class="card__header"><h2>Cấu hình báo cáo</h2></div>
        <div class="field"><label>Ngày báo cáo</label><input type="date" id="r-date" value="${UI.todayIso()}" /></div>
        <p class="text-small text-muted">Báo cáo tổng hợp doanh thu, đơn hàng và hàng hoàn trong ngày đã chọn.</p>
      </div>
      <div></div>
    `;

    async function load() {
      const date = document.getElementById('r-date').value;
      const [{ data: overview }, { data: orders }] = await Promise.all([
        Api.get(`/analytics/overview?dateFrom=${date}&dateTo=${date}`),
        Api.get(`/orders?dateFrom=${date}&dateTo=${date}&status=completed&pageSize=100`),
      ]);
      renderPaper(date, overview, orders);
    }
    document.getElementById('r-date').addEventListener('change', load);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    await load();
  }

  function renderPaper(date, overview, orders) {
    const paper = document.getElementById('report-paper');
    paper.innerHTML = `
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="margin:0;">Báo cáo cuối ngày về bán hàng</h2>
        <p class="text-muted text-small">Ngày bán: ${date}</p>
      </div>
      ${orders.length ? `
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Mã đơn</th><th>Thời gian</th><th class="num">SLSP</th><th class="num">Doanh thu</th><th class="num">Thanh toán</th></tr></thead>
          <tbody>${orders.map((o) => `
            <tr><td>${UI.escapeHtml(o.code)}</td><td>${UI.formatDate(o.completed_at)}</td>
              <td class="num">—</td><td class="num">${UI.formatMoney(o.subtotal - o.discount + o.shipping_fee)}</td>
              <td class="num">${o.payment_method}</td></tr>`).join('')}</tbody>
        </table>
        <div style="margin-top:20px;text-align:right;">
          <p><strong>Tổng doanh thu:</strong> ${UI.formatMoney(overview.revenue)}</p>
          <p><strong>Giá trị hàng hoàn:</strong> ${UI.formatMoney(overview.returnedAmount)}</p>
          <p><strong>Doanh thu thuần:</strong> ${UI.formatMoney(overview.netRevenue)}</p>
        </div>
      ` : `<p style="text-align:center;color:var(--color-text-muted);font-style:italic;">Báo cáo không có dữ liệu</p>`}
    `;
  }

  Router.register('/reports', { render, title: 'Báo cáo' });
})();
