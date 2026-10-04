/**
 * router.js
 * Router dạng hash rất đơn giản (#/dashboard, #/products, ...), đủ dùng cho
 * 1 ứng dụng quản trị nội bộ mà không cần build tool/bundler.
 */
const Router = (() => {
  const routes = {}; // path -> { render, title }

  function register(path, config) {
    routes[path] = config;
  }

  function currentPath() {
    const hash = location.hash.replace(/^#/, '');
    return hash || '/dashboard';
  }

  async function render() {
    const path = currentPath();
    const base = path.split('?')[0];
    const config = routes[base] || routes['/dashboard'];
    document.querySelectorAll('.topbar__nav a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-path') === base || a.getAttribute('data-group') === base);
    });
    document.querySelectorAll('.mobile-nav__panel a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-path') === base);
    });
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="skeleton skeleton-row" style="width:200px;height:26px;"></div>';
    try {
      await config.render(container, path);
    } catch (err) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">⚠️</div>
            <div class="empty-state__title">Không tải được trang</div>
            <div class="empty-state__desc">${UI.escapeHtml(err.message || 'Lỗi không xác định')}</div>
          </div>
        </div>`;
    }
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  return { register, start, render };
})();
