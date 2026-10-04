/**
 * api.js
 * HTTP client dùng chung cho toàn bộ frontend. Mọi page module gọi qua đây,
 * KHÔNG gọi fetch() trực tiếp rải rác - để đổi cách gọi API (vd thêm retry,
 * đổi base URL) chỉ cần sửa 1 chỗ.
 */
const Api = (() => {
  const BASE = '/api';

  async function request(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    let json = null;
    try { json = await res.json(); } catch (e) { /* no body */ }

    if (!res.ok) {
      if (res.status === 401) {
        // Phiên hết hạn / chưa đăng nhập -> đá về trang login
        if (!location.pathname.endsWith('login.html')) {
          location.href = '/login.html';
        }
      }
      const err = new Error(json?.error?.message || 'Có lỗi xảy ra.');
      err.code = json?.error?.code || 'UNKNOWN_ERROR';
      err.status = res.status;
      throw err;
    }
    return json;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body || {}),
    patch: (path, body) => request('PATCH', path, body || {}),
    del: (path) => request('DELETE', path),
  };
})();
