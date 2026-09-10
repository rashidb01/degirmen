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
    ordersTimer = setInterval(() => { loadOrders(); loadFeedback(); }, 15000);

    await loadSettings();
    await Promise.all([loadBranches(), loadPromocodes(), loadGuests(), loadFeedback()]);
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
    const submitBtn = document.getElementById('categorySubmitBtn');
    submitBtn.disabled = true;
    try {
      submitBtn.textContent = 'Переводим…';
      await fillTranslations({
        nameEl: input,
        nameKkEl: document.getElementById('categoryNameKk'),
        nameEnEl: document.getElementById('categoryNameEn'),
      });
      await authFetch(`${API}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          name_kk: document.getElementById('categoryNameKk').value.trim(),
          name_en: document.getElementById('categoryNameEn').value.trim(),
          order: categories.length + 1,
        }),
      });
      document.getElementById('categoryForm').reset();
      await loadMenu();
      renderCategoryOptions();
      renderDishes();
      renderCategories();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Добавить';
    }
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
    document.getElementById('dishNameKk').value = d.name_kk || '';
    document.getElementById('dishNameEn').value = d.name_en || '';
    document.getElementById('dishDescriptionKk').value = d.description_kk || '';
    document.getElementById('dishDescriptionEn').value = d.description_en || '';
    document.getElementById('dishAllergens').value = (d.allergens || []).join(', ');
    document.getElementById('dishTags').value = (d.tags || []).join(', ');
    document.getElementById('dishAvailable').checked = d.available !== false;
    document.getElementById('dishSubmitBtn').textContent = 'Сохранить изменения';
    document.getElementById('dishCancelEditBtn').classList.remove('hidden');
    document.getElementById('dishImageFile').value = '';
    setPhotoPreview(d.image || '');
    document.getElementById('dishForm').scrollIntoView({ behavior: 'smooth' });
  }
  function resetDishForm() {
    editingDishId = null;
    document.getElementById('dishForm').reset();
    document.getElementById('dishId').value = '';
    document.getElementById('dishImage').value = '';
    document.getElementById('dishAvailable').checked = true;
    document.getElementById('dishSubmitBtn').textContent = 'Добавить блюдо';
    document.getElementById('dishCancelEditBtn').classList.add('hidden');
    setPhotoPreview('');
  }
  document.getElementById('dishCancelEditBtn').addEventListener('click', resetDishForm);

  // ── photo upload tile ─────────────────────────────────────────────────
  // Photos are uploaded from the device only (no URL field) — the tile is
  // the "+ Добавить фото" placeholder until there's an image to show.
  const photoUpload = document.getElementById('dishPhotoUpload');
  const photoPreview = document.getElementById('dishPhotoPreview');
  const photoPlaceholder = document.getElementById('dishPhotoPlaceholder');
  const photoChange = document.getElementById('dishPhotoChange');
  const photoFileInput = document.getElementById('dishImageFile');

  function setPhotoPreview(url) {
    const has = Boolean(url);
    photoPreview.src = url || '';
    photoPreview.classList.toggle('hidden', !has);
    photoPlaceholder.classList.toggle('hidden', has);
    photoChange.classList.toggle('hidden', !has);
  }

  photoUpload.addEventListener('click', () => photoFileInput.click());
  photoUpload.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoFileInput.click(); }
  });
  photoFileInput.addEventListener('change', () => {
    const file = photoFileInput.files[0];
    if (file) setPhotoPreview(URL.createObjectURL(file));
  });

  // ── auto-translation ──────────────────────────────────────────────────
  // Fills the KK/EN fields from the Russian text, but never overwrites
  // anything staff typed by hand.
  async function fillTranslations({ nameEl, descEl, nameKkEl, nameEnEl, descKkEl, descEnEl }) {
    const name = nameEl.value.trim();
    const description = descEl ? descEl.value.trim() : '';
    if (!name) return;

    const targets = [nameKkEl, nameEnEl, descKkEl, descEnEl].filter(Boolean);
    const allFilled = targets.every((el) => el.value.trim());
    if (allFilled) return; // nothing to auto-fill

    try {
      const res = await authFetch(`${API}/api/admin/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) return; // translation is best-effort — never block saving
      const t = await res.json();
      if (nameKkEl && !nameKkEl.value.trim()) nameKkEl.value = t.name_kk || '';
      if (nameEnEl && !nameEnEl.value.trim()) nameEnEl.value = t.name_en || '';
      if (descKkEl && !descKkEl.value.trim()) descKkEl.value = t.description_kk || '';
      if (descEnEl && !descEnEl.value.trim()) descEnEl.value = t.description_en || '';
    } catch (e) {
      console.error('auto-translate failed', e);
    }
  }

  function splitList(str) {
    return str.split(',').map((s) => s.trim()).filter(Boolean);
  }

  document.getElementById('dishForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('dishSubmitBtn');
    const submitLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    try {
      submitBtn.textContent = 'Переводим…';
      await fillTranslations({
        nameEl: document.getElementById('dishName'),
        descEl: document.getElementById('dishDescription'),
        nameKkEl: document.getElementById('dishNameKk'),
        nameEnEl: document.getElementById('dishNameEn'),
        descKkEl: document.getElementById('dishDescriptionKk'),
        descEnEl: document.getElementById('dishDescriptionEn'),
      });
      submitBtn.textContent = 'Сохраняем…';

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
        name_kk: document.getElementById('dishNameKk').value.trim(),
        name_en: document.getElementById('dishNameEn').value.trim(),
        categoryId: document.getElementById('dishCategory').value,
        price: Number(document.getElementById('dishPrice').value),
        image: imageUrl,
        description: document.getElementById('dishDescription').value.trim(),
        description_kk: document.getElementById('dishDescriptionKk').value.trim(),
        description_en: document.getElementById('dishDescriptionEn').value.trim(),
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
      if (submitBtn.textContent === 'Переводим…' || submitBtn.textContent === 'Сохраняем…') {
        submitBtn.textContent = submitLabel;
      }
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

  // ── settings ("Бот и фичи") ──────────────────────────────────────────
  let settings = null;
  let upsellRules = [];
  let faqItems = [];

  async function loadSettings() {
    const res = await authFetch(`${API}/api/admin/settings`);
    settings = await res.json();
    upsellRules = (settings.upsell?.rules || []).map((r) => ({ ...r }));
    faqItems = (settings.faq?.items || []).map((f) => ({ ...f }));
    fillSettingsForm();
    renderUpsellRules();
    renderFaqItems();
  }

  function fillSettingsForm() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    setChecked('s-negativeFeedback-enabled', settings.negativeFeedback?.enabled);
    set('s-negativeFeedback-replyHint', settings.negativeFeedback?.replyHint);

    setChecked('s-orderHistory-enabled', settings.orderHistory?.enabled);
    set('s-orderHistory-maxOrders', settings.orderHistory?.maxOrders ?? 5);

    setChecked('s-abandonedCart-enabled', settings.abandonedCart?.enabled);
    set('s-abandonedCart-delayMinutes', settings.abandonedCart?.delayMinutes ?? 3);
    set('s-abandonedCart-text', settings.abandonedCart?.text);
    set('s-abandonedCart-text_kk', settings.abandonedCart?.text_kk);
    set('s-abandonedCart-text_en', settings.abandonedCart?.text_en);

    setChecked('s-upsell-enabled', settings.upsell?.enabled);

    setChecked('s-customization-enabled', settings.customization?.enabled);
    set('s-customization-quickOptions', (settings.customization?.quickOptions || []).join(', '));

    setChecked('s-loyalty-enabled', settings.loyalty?.enabled);
    set('s-loyalty-earnPercent', settings.loyalty?.earnPercent ?? 5);
    set('s-loyalty-redeemMaxPercent', settings.loyalty?.redeemMaxPercent ?? 50);
    set('s-loyalty-minRedeem', settings.loyalty?.minRedeem ?? 100);
    set('s-loyalty-welcomeBonus', settings.loyalty?.welcomeBonus ?? 0);

    setChecked('s-promo-enabled', settings.promo?.enabled);

    set('s-venueInfo-workingHours', settings.venueInfo?.workingHours);
    set('s-venueInfo-address', settings.venueInfo?.address);
    set('s-venueInfo-phone', settings.venueInfo?.phone);
    set('s-venueInfo-wifi', settings.venueInfo?.wifi);
    set('s-venueInfo-extra', settings.venueInfo?.extra);

    setChecked('s-faq-enabled', settings.faq?.enabled);
  }

  function renderUpsellRules() {
    const wrap = document.getElementById('upsellRulesList');
    wrap.innerHTML = '';
    const catOptions = () => categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    upsellRules.forEach((rule, i) => {
      const row = document.createElement('div');
      row.className = 'rule-row';
      row.innerHTML = `
        <button type="button" class="row-remove-btn" data-i="${i}">✕ убрать</button>
        <div class="rule-grid">
          <select data-f="mode">
            <option value="missing_category" ${rule.mode !== 'has_category' ? 'selected' : ''}>Если НЕТ категории…</option>
            <option value="has_category" ${rule.mode === 'has_category' ? 'selected' : ''}>Если ЕСТЬ категория…</option>
          </select>
          <select data-f="targetId">${catOptions()}</select>
        </div>
        <input type="text" data-f="title" placeholder="Заголовок предложения (RU)" value="${escapeHtml(rule.title || '')}" />
        <select data-f="suggestCategory">
          <option value="">— предложить категорию —</option>
          ${catOptions()}
        </select>
      `;
      row.querySelector('[data-f="targetId"]').value = rule.targetId || '';
      row.querySelector('[data-f="suggestCategory"]').value = rule.suggestCategory || '';
      row.querySelectorAll('[data-f]').forEach((el) => {
        el.addEventListener('input', () => { upsellRules[i][el.dataset.f] = el.value; });
        el.addEventListener('change', () => { upsellRules[i][el.dataset.f] = el.value; });
      });
      row.querySelector('.row-remove-btn').addEventListener('click', () => {
        upsellRules.splice(i, 1);
        renderUpsellRules();
      });
      wrap.appendChild(row);
    });
  }
  document.getElementById('addUpsellRuleBtn').addEventListener('click', () => {
    upsellRules.push({ id: `rule-${Date.now()}`, mode: 'missing_category', targetId: categories[0]?.id || '', title: '', suggestCategory: categories[0]?.id || '' });
    renderUpsellRules();
  });

  function renderFaqItems() {
    const wrap = document.getElementById('faqList');
    wrap.innerHTML = '';
    faqItems.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'faq-row';
      row.innerHTML = `
        <button type="button" class="row-remove-btn" data-i="${i}">✕ убрать</button>
        <input type="text" data-f="question" placeholder="Вопрос (RU)" value="${escapeHtml(item.question || '')}" />
        <textarea data-f="answer" placeholder="Ответ (RU)">${escapeHtml(item.answer || '')}</textarea>
      `;
      row.querySelectorAll('[data-f]').forEach((el) => {
        el.addEventListener('input', () => { faqItems[i][el.dataset.f] = el.value; });
      });
      row.querySelector('.row-remove-btn').addEventListener('click', () => {
        faqItems.splice(i, 1);
        renderFaqItems();
      });
      wrap.appendChild(row);
    });
  }
  document.getElementById('addFaqBtn').addEventListener('click', () => {
    faqItems.push({ id: `faq-${Date.now()}`, question: '', answer: '' });
    renderFaqItems();
  });

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('settingsSubmitBtn');
    const label = btn.textContent;
    btn.disabled = true;
    try {
      const val = (id) => document.getElementById(id).value.trim();
      const checked = (id) => document.getElementById(id).checked;
      const num = (id, def) => Number(document.getElementById(id).value) || def;

      // Auto-translate any upsell titles / FAQ items missing KK or EN before saving.
      btn.textContent = 'Переводим…';
      for (const rule of upsellRules) {
        if (rule.title && (!rule.title_kk || !rule.title_en)) {
          const t = await translateText(rule.title);
          if (t) { rule.title_kk = rule.title_kk || t.name_kk; rule.title_en = rule.title_en || t.name_en; }
        }
      }
      for (const item of faqItems) {
        if (item.question && (!item.question_kk || !item.answer_kk || !item.question_en || !item.answer_en)) {
          const t = await translateText(item.question, item.answer);
          if (t) {
            item.question_kk = item.question_kk || t.name_kk;
            item.answer_kk = item.answer_kk || t.description_kk;
            item.question_en = item.question_en || t.name_en;
            item.answer_en = item.answer_en || t.description_en;
          }
        }
      }

      btn.textContent = 'Сохраняем…';
      const patch = {
        negativeFeedback: { enabled: checked('s-negativeFeedback-enabled'), replyHint: val('s-negativeFeedback-replyHint') },
        orderHistory: { enabled: checked('s-orderHistory-enabled'), maxOrders: num('s-orderHistory-maxOrders', 5) },
        abandonedCart: {
          enabled: checked('s-abandonedCart-enabled'),
          delayMinutes: num('s-abandonedCart-delayMinutes', 3),
          text: val('s-abandonedCart-text'), text_kk: val('s-abandonedCart-text_kk'), text_en: val('s-abandonedCart-text_en'),
        },
        upsell: { enabled: checked('s-upsell-enabled'), rules: upsellRules },
        customization: { enabled: checked('s-customization-enabled'), quickOptions: splitList(val('s-customization-quickOptions')) },
        loyalty: {
          enabled: checked('s-loyalty-enabled'),
          earnPercent: num('s-loyalty-earnPercent', 5),
          redeemMaxPercent: num('s-loyalty-redeemMaxPercent', 50),
          minRedeem: num('s-loyalty-minRedeem', 100),
          welcomeBonus: num('s-loyalty-welcomeBonus', 0),
        },
        promo: { enabled: checked('s-promo-enabled') },
        venueInfo: {
          workingHours: val('s-venueInfo-workingHours'), address: val('s-venueInfo-address'),
          phone: val('s-venueInfo-phone'), wifi: val('s-venueInfo-wifi'), extra: val('s-venueInfo-extra'),
        },
        faq: { enabled: checked('s-faq-enabled'), items: faqItems },
      };
      const res = await authFetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      settings = await res.json();
      upsellRules = (settings.upsell?.rules || []).map((r) => ({ ...r }));
      faqItems = (settings.faq?.items || []).map((f) => ({ ...f }));
      renderUpsellRules();
      renderFaqItems();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  // Shared with the dish/category translate-on-save flow.
  async function translateText(name, description) {
    try {
      const res = await authFetch(`${API}/api/admin/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || '' }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ── branches (network points + tables) ───────────────────────────────
  let branches = [];
  async function loadBranches() {
    const res = await authFetch(`${API}/api/admin/branches`);
    branches = await res.json();
    renderBranches();
  }
  function renderBranches() {
    const wrap = document.getElementById('branchesList');
    if (branches.length === 0) { wrap.innerHTML = `<div class="empty-state">Пока одна точка по умолчанию — добавьте свою.</div>`; return; }
    wrap.innerHTML = '';
    branches.forEach((b) => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <div class="info">
          <div class="name">${escapeHtml(b.name)} ${b.active === false ? '<span class="unavailable-pill">выключена</span>' : ''}</div>
          <div class="meta">ID: <code>${escapeHtml(b.id)}</code> · ${escapeHtml(b.address || 'без адреса')} · столов: ${b.tables || 0}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" type="button" data-act="toggle">${b.active === false ? 'Включить' : 'Выключить'}</button>
          <button class="icon-btn danger" type="button" data-act="delete">Удалить</button>
        </div>
      `;
      row.querySelector('[data-act="toggle"]').addEventListener('click', async () => {
        await authFetch(`${API}/api/admin/branches/${b.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: b.active === false }),
        });
        await loadBranches();
      });
      row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm(`Удалить точку "${b.name}"?`)) return;
        await authFetch(`${API}/api/admin/branches/${b.id}`, { method: 'DELETE' });
        await loadBranches();
      });
      wrap.appendChild(row);
    });
  }
  document.getElementById('branchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('branchName').value.trim();
    if (!name) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const t = await translateText(name);
      await authFetch(`${API}/api/admin/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          name_kk: t?.name_kk || '',
          name_en: t?.name_en || '',
          address: document.getElementById('branchAddress').value.trim(),
          tables: document.getElementById('branchTables').value,
        }),
      });
      document.getElementById('branchForm').reset();
      await loadBranches();
    } finally {
      btn.disabled = false;
    }
  });

  // ── promo codes ────────────────────────────────────────────────────────
  let promocodes = [];
  async function loadPromocodes() {
    const res = await authFetch(`${API}/api/admin/promocodes`);
    promocodes = await res.json();
    renderPromocodes();
  }
  function renderPromocodes() {
    const wrap = document.getElementById('promocodesList');
    if (promocodes.length === 0) { wrap.innerHTML = `<div class="empty-state">Промокодов пока нет.</div>`; return; }
    wrap.innerHTML = '';
    promocodes.forEach((p) => {
      const valueLabel = p.type === 'percent' ? `${p.value}%` : money(p.value);
      const limitLabel = p.usageLimit > 0 ? `${p.usedCount || 0} / ${p.usageLimit}` : `использован ${p.usedCount || 0} раз`;
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <div class="info">
          <div class="name">${escapeHtml(p.code)} ${p.active === false ? '<span class="unavailable-pill">выключен</span>' : ''}</div>
          <div class="meta">${valueLabel} · ${limitLabel}${p.minOrder ? ` · от ${money(p.minOrder)}` : ''}${p.expiresAt ? ` · до ${p.expiresAt}` : ''}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" type="button" data-act="toggle">${p.active === false ? 'Включить' : 'Выключить'}</button>
          <button class="icon-btn danger" type="button" data-act="delete">Удалить</button>
        </div>
      `;
      row.querySelector('[data-act="toggle"]').addEventListener('click', async () => {
        await authFetch(`${API}/api/admin/promocodes/${p.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: p.active === false }),
        });
        await loadPromocodes();
      });
      row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm(`Удалить промокод "${p.code}"?`)) return;
        await authFetch(`${API}/api/admin/promocodes/${p.id}`, { method: 'DELETE' });
        await loadPromocodes();
      });
      wrap.appendChild(row);
    });
  }
  document.getElementById('promoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('promoCode').value.trim();
    if (!code) return;
    const res = await authFetch(`${API}/api/admin/promocodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        type: document.getElementById('promoType').value,
        value: document.getElementById('promoValue').value,
        minOrder: document.getElementById('promoMinOrder').value,
        usageLimit: document.getElementById('promoUsageLimit').value,
        expiresAt: document.getElementById('promoExpiresAt').value,
      }),
    });
    if (res.ok) {
      document.getElementById('promoForm').reset();
      document.getElementById('promoType').value = 'percent';
      await loadPromocodes();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error === 'code already exists' ? 'Такой код уже есть' : 'Не удалось создать промокод');
    }
  });

  // ── guests (loyalty wallets) ──────────────────────────────────────────
  async function loadGuests() {
    const res = await authFetch(`${API}/api/admin/guests`);
    const guests = await res.json();
    renderGuests(guests);
  }
  document.getElementById('refreshGuestsBtn').addEventListener('click', loadGuests);
  function renderGuests(guests) {
    const wrap = document.getElementById('guestsList');
    if (guests.length === 0) { wrap.innerHTML = `<div class="empty-state">Гостей пока нет — появятся после первого заказа.</div>`; return; }
    wrap.innerHTML = '';
    guests.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'guest-row';
      row.innerHTML = `
        <div>
          <div class="gid">${escapeHtml(g.id.slice(0, 22))}</div>
          <div class="gmeta">${g.ordersCount || 0} заказ(ов) · ${money(g.totalSpent || 0)} всего${g.lastOrderAt ? ` · ${new Date(g.lastOrderAt).toLocaleDateString('ru-RU')}` : ''}</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px">
          <div class="gpoints">${g.points || 0} ★</div>
          <button class="icon-btn" type="button" data-act="adjust">± баллы</button>
        </div>
      `;
      row.querySelector('[data-act="adjust"]').addEventListener('click', async () => {
        const delta = prompt('На сколько изменить баланс баллов? (можно отрицательное число)', '0');
        if (delta === null || !delta.trim() || isNaN(Number(delta))) return;
        await authFetch(`${API}/api/admin/guests/${g.id}/points`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta: Number(delta) }),
        });
        await loadGuests();
      });
      wrap.appendChild(row);
    });
  }

  // ── negative feedback ──────────────────────────────────────────────────
  async function loadFeedback() {
    const res = await authFetch(`${API}/api/admin/feedback`);
    const list = await res.json();
    renderFeedback(list);
    const newCount = list.filter((f) => f.status === 'new').length;
    const badge = document.getElementById('feedbackBadge');
    badge.textContent = newCount;
    badge.classList.toggle('hidden', newCount === 0);
  }
  document.getElementById('refreshFeedbackBtn').addEventListener('click', loadFeedback);
  function renderFeedback(list) {
    const wrap = document.getElementById('feedbackList');
    if (list.length === 0) { wrap.innerHTML = `<div class="empty-state">Жалоб не поймано — и это хорошо 🙂</div>`; return; }
    wrap.innerHTML = '';
    list.forEach((f) => {
      const item = document.createElement('div');
      item.className = `feedback-item status-${f.status}`;
      item.innerHTML = `
        <div class="ftext">${escapeHtml(f.text)}</div>
        <div class="fmeta">
          <span>${new Date(f.createdAt).toLocaleString('ru-RU')}${f.tableNumber ? ` · стол ${escapeHtml(f.tableNumber)}` : ''}</span>
          ${f.status !== 'resolved' ? `<button class="icon-btn" type="button" data-act="resolve">Отметить решённым</button>` : '<span>✅ решено</span>'}
        </div>
      `;
      const resolveBtn = item.querySelector('[data-act="resolve"]');
      if (resolveBtn) {
        resolveBtn.addEventListener('click', async () => {
          await authFetch(`${API}/api/admin/feedback/${f.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'resolved' }),
          });
          await loadFeedback();
        });
      }
      wrap.appendChild(item);
    });
  }

  // ── boot ──────────────────────────────────────────────────────────────
  if (adminKey) tryEnter();
  else showLogin(false);
})();
