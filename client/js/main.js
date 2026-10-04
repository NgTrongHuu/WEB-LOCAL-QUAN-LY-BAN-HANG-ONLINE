/**
 * main.js
 * Bootstrap ứng dụng: kiểm tra đăng nhập, dựng khung AppShell (topbar), khởi động router.
 */
(async function () {
  try {
    const { data: user } = await Api.get('/auth/me');
    renderShell(user);
    Router.start();
  } catch (err) {
    location.href = '/login.html';
  }

  function renderShell(user) {
    const nav = [
      ['/dashboard', 'Tổng quan'],
      ['/products', 'Thực đơn'],
      ['/inventory', 'Kho hàng'],
      ['/orders', 'Đơn đi'],
      ['/returns', 'Đơn hoàn về'],
      ['/cashbook', 'Sổ quỹ'],
      ['/reports', 'Báo cáo'],
      ['/customers', 'Khách hàng'],
    ];
    document.getElementById('app-root').innerHTML = `
      <div class="topbar">
        <div class="topbar__brand">☕ Dailyc Coffee</div>
        <nav class="topbar__nav">
          ${nav.map(([path, label]) => `<a href="#${path}" data-path="${path}">${label}</a>`).join('')}
        </nav>
        <button class="menu-toggle btn btn-secondary btn-sm" id="menu-toggle">☰</button>
        <div class="topbar__right">
          <div class="topbar__user-wrap">
            <button class="topbar__user" id="user-menu" aria-haspopup="true" aria-expanded="false">
              <div class="avatar">${(user.name || user.email).charAt(0).toUpperCase()}</div>
              <span class="text-small user-name">${UI.escapeHtml(user.name || user.email)}</span>
            </button>
            <div class="user-dropdown hidden" id="user-dropdown">
              <div class="user-dropdown__name">${UI.escapeHtml(user.name || user.email)}</div>
              <div class="user-dropdown__email">${UI.escapeHtml(user.email)}</div>
              <hr />
              <button class="user-dropdown__item" id="btn-logout">🚪 Đăng xuất</button>
            </div>
          </div>
        </div>
      </div>
      <div id="page-content"></div>
      <div id="toast-container"></div>
    `;

    document.getElementById('menu-toggle').addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.className = 'mobile-nav';
      overlay.innerHTML = `<div class="mobile-nav__panel">
        ${nav.map(([path, label]) => `<a href="#${path}" data-path="${path}">${label}</a>`).join('')}
        <hr/><a href="#" id="mobile-logout">Đăng xuất</a>
      </div>`;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => overlay.remove()));
      overlay.querySelector('#mobile-logout').addEventListener('click', logout);
      document.body.appendChild(overlay);
    });

    const userMenuBtn = document.getElementById('user-menu');
    const dropdown = document.getElementById('user-dropdown');
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', isOpen);
      userMenuBtn.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.classList.contains('hidden') && !e.target.closest('.topbar__user-wrap')) {
        dropdown.classList.add('hidden');
        userMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.getElementById('btn-logout').addEventListener('click', logout);
  }

  async function logout() {
    await Api.post('/auth/logout');
    location.href = '/login.html';
  }
})();
