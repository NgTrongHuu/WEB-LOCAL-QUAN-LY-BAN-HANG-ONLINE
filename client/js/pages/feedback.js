/**
 * pages/feedback.js
 * Khách hàng - giao diện kiểu Messenger, nhập tay hoàn toàn, ĐỘC LẬP với
 * khách hàng ở Đơn đi. Tìm kiếm trên, danh sách liên hệ trái, khung góp ý phải.
 */
(function () {
  let activeContactId = null;

  async function render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Khách hàng — Sổ góp ý</h1>
        <div class="page-header__actions"><button class="btn btn-primary" id="btn-new-contact">+ Thêm khách</button></div>
      </div>
      <div class="messenger">
        <div class="messenger__list" id="contact-list-wrap">
          <div class="messenger__search"><input id="contact-search" placeholder="Tìm tên khách hàng..." /></div>
          <div id="contact-list">${UI.skeletonRows(6)}</div>
        </div>
        <div class="messenger__thread" id="thread-wrap">
          <div class="empty-state" style="margin:auto;">
            <div class="empty-state__icon">💬</div>
            <div class="empty-state__title">Chọn một khách hàng</div>
            <div class="empty-state__desc">để xem hoặc ghi lại góp ý của họ.</div>
          </div>
        </div>
      </div>
    `;

    async function loadContacts(search) {
      const { data } = await Api.get(`/feedback/contacts${search ? '?search=' + encodeURIComponent(search) : ''}`);
      renderContactList(data);
    }

    document.getElementById('contact-search').addEventListener('input', UI.debounce((e) => loadContacts(e.target.value), 300));
    document.getElementById('btn-new-contact').addEventListener('click', () => openNewContact(loadContacts));
    await loadContacts();
  }

  function renderContactList(rows) {
    const el = document.getElementById('contact-list');
    if (!rows.length) {
      el.innerHTML = UI.emptyState({ icon: '👤', title: 'Chưa có khách hàng nào', desc: 'Thêm khách để bắt đầu ghi lại góp ý.' });
      return;
    }
    el.innerHTML = rows.map((c) => `
      <div class="messenger__item ${c.id === activeContactId ? 'active' : ''}" data-contact="${c.id}">
        <div class="avatar">${UI.escapeHtml(c.name.charAt(0).toUpperCase())}</div>
        <div>
          <div class="messenger__item-name">${UI.escapeHtml(c.name)}</div>
          <div class="messenger__item-preview">${UI.escapeHtml(c.lastMessage || 'Chưa có góp ý nào')}</div>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('[data-contact]').forEach((item) => {
      item.addEventListener('click', () => openThread(Number(item.getAttribute('data-contact'))));
    });
  }

  const labelMap = { khen: ['badge-success', '👍 Khen'], phan_nan: ['badge-danger', '⚠️ Phàn nàn'], gop_y: ['badge-warning', '💡 Góp ý'] };

  async function openThread(contactId) {
    activeContactId = contactId;
    document.querySelectorAll('.messenger__item').forEach((el) => el.classList.toggle('active', Number(el.getAttribute('data-contact')) === contactId));
    const { data } = await Api.get(`/feedback/contacts/${contactId}/messages`);
    const wrap = document.getElementById('thread-wrap');
    wrap.innerHTML = `
      <div class="messenger__thread-header">${UI.escapeHtml(data.contact.name)}</div>
      <div class="messenger__messages" id="messages-list">
        ${data.messages.length ? data.messages.map((m) => `
          <div class="bubble">
            ${m.label ? `<span class="badge ${labelMap[m.label][0]}" style="margin-bottom:6px;display:inline-block;">${labelMap[m.label][1]}</span><br/>` : ''}
            ${UI.escapeHtml(m.content)}
            <div class="bubble__meta">${UI.formatDate(m.created_at)}</div>
          </div>
        `).join('') : `<p class="text-muted text-small">Chưa có góp ý nào được ghi lại cho khách này.</p>`}
      </div>
      <div class="messenger__composer">
        <select id="new-label" style="width:120px;height:38px;border-radius:var(--radius-sm);border:1px solid var(--color-border);">
          <option value="">Không gắn nhãn</option>
          <option value="khen">👍 Khen</option>
          <option value="phan_nan">⚠️ Phàn nàn</option>
          <option value="gop_y">💡 Góp ý</option>
        </select>
        <textarea id="new-content" rows="1" placeholder="Nhập nội dung góp ý của khách..."></textarea>
        <button class="btn btn-primary" id="send-message">Ghi lại</button>
      </div>
    `;
    document.getElementById('messages-list').scrollTop = document.getElementById('messages-list').scrollHeight;
    document.getElementById('send-message').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        const content = document.getElementById('new-content').value.trim();
        if (!content) return;
        try {
          await Api.post(`/feedback/contacts/${contactId}/messages`, { content, label: document.getElementById('new-label').value || null });
          openThread(contactId);
        } catch (err) { UI.toast(err.message, 'error'); }
      }, 'Đang ghi...')
    );
  }

  function openNewContact(onSaved) {
    const overlay = UI.openModal(`
      <div class="modal__header"><h3>Thêm khách hàng</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal__body"><div class="field"><label>Tên khách hàng</label><input id="c-name" /></div></div>
      <div class="modal__footer"><button class="btn btn-secondary" data-close>Hủy</button><button class="btn btn-primary" id="c-save">Thêm</button></div>
    `);
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeOverlay(b)));
    overlay.querySelector('#c-save').addEventListener('click', (e) =>
      UI.withButtonLoading(e.target, async () => {
        const name = overlay.querySelector('#c-name').value.trim();
        if (!name) return;
        try {
          await Api.post('/feedback/contacts', { name });
          overlay.remove();
          onSaved && onSaved();
        } catch (err) { UI.toast(err.message, 'error'); }
      })
    );
  }

  Router.register('/customers', { render, title: 'Khách hàng' });
})();
