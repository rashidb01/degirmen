(() => {
  const API = '';
  const KEY_STORAGE = 'degirmen_admin_key';
  const money = (n) => `${Number(n).toLocaleString('ru-RU')} ₸`;

  let adminKey = sessionStorage.getItem(KEY_STORAGE) || '';
  let categories = [];
  let dishes = [];
  let editingDishId = null;
  let ordersTimer = null;

  const loginGate = document.getElementById('loginGate');
  const adminApp = document.getElementById('adminApp');

  async function authFetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), 'x-admin-key': adminKey },
    });
    if (res.status === 401) {
      sessionStorage.removeItem(KEY_STORAGE);
      showLogin(true);
      throw new Error('unauthorized');
    }
    return res;
  }

  function showLogin(withError) {
    loginGate.classList.remove('hidden');
    adminApp.classList.add('hidden');
    document.getElementById('loginError').classList.toggle('hidden', !withError);
    if (ordersTimer) clearInterval(ordersTimer);
  }

  async function tryEnter() {
    try {
      const res = await fetch(`${API}/api/admin/orders`, { headers: { 'x-admin-key': adminKey } });
      if (!res.ok) { showLogin(true); return; }
      loginGate.classList.add('hidden');
      adminApp.classList.remove('hidden');
      sessionStorage.setItem(KEY_STORAGE, adminKey);
      init();
    } catch {
      showLogin(true);
    }
  }

  document.getElementById('loginBtn').addEventListener('click', () => {
    adminKey = document.getElementById('adminKeyInput').value.trim();
    tryEnter();
  });
  document.getElementById('adminKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(KEY_STORAGE);
    adminKey = '';
    showLogin(false);
  });

  // ── tabs ──────────────────────────────────────────────────────────────
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });

  // ── init ──────────────────────────────────────────────────────────────
  async function init() {
    await loadMenu();
    renderCategoryOptions();
    renderDishes();
    renderCategories();
    await loadOrders();
    if (ordersTimer) clearInterval(ordersTimer);
    ordersTimer = setInterval(loadOrders, 15000);
  }

  async function loadMenu() {
    const res = await fetch(`${API}/api/menu`);
    const data = await res.json();
    categories = data.categories || [];
    dishes = data.dishes || [];
  }

  // ── categories ────────────────────────────────────────────────────────
  function renderCategoryOptions() {
    const sel = document.getElementById('dishCategory');
    sel.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }
  function renderCategories() {
    const wrap = document.getElementById('categoriesList');
    wrap.innerHTML = '';
    categories.forEach((c) => {
      const pill = document.createElement('div');
      pill.className = 'category-admin-pill';
      pill.innerHTML = `<span>${escapeHtml(c.name)}</span> <button type="button" title="Удалить">✕</button>`;
      pill.querySelector('button').addEventListener('click', async () => {
        if (!confirm(`Удалить категорию "${c.name}"? Блюда в ней останутся, но без категории.`)) return;
        await authFetch(`${API}/api/admin/categories/${c.id}`, { method: 'DELETE' });
        await loadMenu();
        renderCategoryOptions();
        renderDishes();
        renderCategories();
      });
      wrap.appendChild(pill);
    });
  }
  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('categoryName');
    const name = input.value.trim();
    if (!name) return;
    await authFetch(`${API}/api/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, order: categories.length + 1 }),
    });
    input.value = '';
    await loadMenu();
    renderCategoryOptions();
    renderDishes();
    renderCategories();
  });

  // ── dishes ────────────────────────────────────────────────────────────
  function categoryName(id) { return categories.find((c) => c.id === id)?.name || '—'; }

  function renderDishes() {
    const wrap = document.getElementById('dishesList');
    wrap.innerHTML = '';
    dishes.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <img src="${d.image || ''}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="info">
          <div class="name">${escapeHtml(d.name)} ${d.available === false ? '<span class="unavailable-pill">нет в наличии</span>' : ''}</div>
          <div class="meta">${categoryName(d.categoryId)} · ${money(d.price)} · ${(d.allergens || []).join(', ') || 'без заявленных аллергенов'}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" type="button" data-act="edit">Изменить</button>
          <button class="icon-btn danger" type="button" data-act="delete">Удалить</button>
        </div>
      `;
      row.querySelector('[data-act="edit"]').addEventListener('click', () => startEditDish(d));
      row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm(`Удалить блюдо "${d.name}"?`)) return;
        await authFetch(`${API}/api/admin/dishes/${d.id}`, { method: 'DELETE' });
        await loadMenu();
        renderDishes();
      });
      wrap.appendChild(row);
    });
  }

  function startEditDish(d) {
    editingDishId = d.id;
    document.getElementById('dishId').value = d.id;
    document.getElementById('dishName').value = d.name;
    document.getElementById('dishCategory').value = d.categoryId || '';
    document.getElementById('dishPrice').value = d.price;
    document.getElementById('dishImage').value = d.image || '';
    document.getElementById('dishDescription').value = d.description || '';
    document.getElementById('dishAllergens').value = (d.allergens || []).join(', ');
    document.getElementById('dishTags').value = (d.tags || []).join(', ');
    document.getElementById('dishAvailable').checked = d.available !== false;
    document.getElementById('dishSubmitBtn').textContent = 'Сохранить изменения';
    document.getElementById('dishCancelEditBtn').classList.remove('hidden');
    document.getElementById('dishForm').scrollIntoView({ behavior: 'smooth' });
  }
  function resetDishForm() {
    editingDishId = null;
    document.getElementById('dishForm').reset();
    document.getElementById('dishId').value = '';
    document.getElementById('dishAvailable').checked = true;
    document.getElementById('dishSubmitBtn').textContent = 'Добавить блюдо';
    document.getElementById('dishCancelEditBtn').classList.add('hidden');
  }
  document.getElementById('dishCancelEditBtn').addEventListener('click', resetDishForm);

  function splitList(str) {
    return str.split(',').map((s) => s.trim()).filter(Boolean);
  }

  document.getElementById('dishForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('dishSubmitBtn');
    submitBtn.disabled = true;
    try {
      let imageUrl = document.getElementById('dishImage').value.trim();
      const file = document.getElementById('dishImageFile').files[0];
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        const upRes = await authFetch(`${API}/api/admin/upload`, { method: 'POST', body: fd });
        const upData = await upRes.json();
        if (upRes.ok) imageUrl = upData.url;
      }

      const payload = {
        name: document.getElementById('dishName').value.trim(),
        categoryId: document.getElementById('dishCategory').value,
        price: Number(document.getElementById('dishPrice').value),
        image: imageUrl,
        description: document.getElementById('dishDescription').value.trim(),
        allergens: splitList(document.getElementById('dishAllergens').value),
        tags: splitList(document.getElementById('dishTags').value),
        available: document.getElementById('dishAvailable').checked,
      };

      if (editingDishId) {
        await authFetch(`${API}/api/admin/dishes/${editingDishId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch(`${API}/api/admin/dishes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      await loadMenu();
      renderDishes();
      resetDishForm();
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ── orders ────────────────────────────────────────────────────────────
  const STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'];
  const STATUS_LABELS = {
    new: 'Новый', confirmed: 'Подтверждён', preparing: 'Готовится',
    ready: 'Готов', served: 'Подан', cancelled: 'Отменён',
  };

  async function loadOrders() {
    try {
      const res = await authFetch(`${API}/api/admin/orders`);
      const orders = await res.json();
      renderOrders(orders);
    } catch (e) {
      // 401 already handled in authFetch
    }
  }
  document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);

  function renderOrders(orders) {
    const wrap = document.getElementById('ordersList');
    if (orders.length === 0) {
      wrap.innerHTML = `<div class="empty-state">Заказов пока нет.</div>`;
      return;
    }
    wrap.innerHTML = '';
    orders.forEach((o) => {
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `
        <div class="order-card-top">
          <span class="oid">№ ${o.id} · Стол ${o.tableNumber || '—'}</span>
          <span class="otime">${new Date(o.createdAt).toLocaleString('ru-RU')}</span>
        </div>
        <div class="order-meta">${o.comment ? `💬 ${escapeHtml(o.comment)}` : ''}</div>
        <div class="order-items">
          ${o.items.map((it) => `<div><span>${escapeHtml(it.name)} × ${it.qty}</span><span>${money(it.subtotal)}</span></div>`).join('')}
        </div>
        <div class="order-total">Итого: ${money(o.total)}</div>
        <select class="status-select status-${o.status}" data-id="${o.id}">
          ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      `;
      card.querySelector('select').addEventListener('change', async (e) => {
        await authFetch(`${API}/api/admin/orders/${o.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: e.target.value }),
        });
        e.target.className = `status-select status-${e.target.value}`;
      });
      wrap.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── boot ──────────────────────────────────────────────────────────────
  if (adminKey) tryEnter();
  else showLogin(false);
})();
