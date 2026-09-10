(() => {
  const API = '';
  const CART_KEY = 'degirmen_cart_v1';
  const CART_NOTES_KEY = 'degirmen_cart_notes_v1';
  const GUEST_KEY = 'degirmen_guest_id';
  const TABLE_KEY = 'degirmen_table';
  const BRANCH_KEY = 'degirmen_branch';
  const money = (n) => `${Number(n).toLocaleString('ru-RU')} ₸`;

  // ── guest identity + automatic branch/table detection ──────────────────
  // A QR code on a table points here with ?table=5&branch=main — no manual
  // entry needed. The guest id is a stable per-browser id used for the
  // loyalty wallet, order history and abandoned-cart tracking.
  function getGuestId() {
    try {
      let id = localStorage.getItem(GUEST_KEY);
      if (!id) {
        id = 'g-' + (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(GUEST_KEY, id);
      }
      return id;
    } catch {
      return 'g-anon';
    }
  }
  function detectBranchAndTable() {
    const params = new URLSearchParams(location.search);
    const table = params.get('table') || params.get('t');
    const branch = params.get('branch') || params.get('b');
    try {
      if (table) sessionStorage.setItem(TABLE_KEY, table);
      if (branch) sessionStorage.setItem(BRANCH_KEY, branch);
      return {
        tableNumber: table || sessionStorage.getItem(TABLE_KEY) || '',
        branchId: branch || sessionStorage.getItem(BRANCH_KEY) || '',
      };
    } catch {
      return { tableNumber: table || '', branchId: branch || '' };
    }
  }

  let state = {
    categories: [],
    dishes: [],
    activeCategory: null,
    search: '',
    cart: loadCart(),
    cartNotes: loadCartNotes(),
    settings: null,
    guest: null,
    guestId: getGuestId(),
    ...detectBranchAndTable(),
    appliedPromo: null,
    redeemPoints: false,
  };

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {}
  }
  function loadCartNotes() {
    try {
      return JSON.parse(localStorage.getItem(CART_NOTES_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveCartNotes() {
    try { localStorage.setItem(CART_NOTES_KEY, JSON.stringify(state.cartNotes)); } catch {}
  }

  // ── data load ────────────────────────────────────────────────────────
  async function loadMenu() {
    const res = await fetch(`${API}/api/menu`);
    const data = await res.json();
    state.categories = data.categories || [];
    state.dishes = data.dishes || [];
    state.activeCategory = state.categories[0]?.id || null;
    renderCategoryNav();
    renderMenu();
    updateCartBadge();
  }

  async function loadSettings() {
    try {
      const res = await fetch(`${API}/api/settings`);
      state.settings = await res.json();
    } catch (e) {
      console.error('settings load failed', e);
      state.settings = null;
    }
  }

  async function loadGuest() {
    try {
      const res = await fetch(`${API}/api/guest/${encodeURIComponent(state.guestId)}`);
      state.guest = await res.json();
      updateWalletBadge();
    } catch (e) {
      console.error('guest load failed', e);
    }
  }

  function renderTableBadge() {
    const el = document.getElementById('tableBadge');
    if (!state.tableNumber) { el.classList.add('hidden'); return; }
    el.textContent = `📍 ${window.I18N.t('tableBadge')} ${state.tableNumber}`;
    el.classList.remove('hidden');
  }

  function updateWalletBadge() {
    const btn = document.getElementById('walletBtn');
    if (!state.settings?.loyalty?.enabled || !state.guest) { btn.classList.add('hidden'); return; }
    document.getElementById('walletBtnPoints').textContent = state.guest.points || 0;
    btn.classList.remove('hidden');
  }

  // ── category nav ─────────────────────────────────────────────────────
  function renderCategoryNav() {
    const nav = document.getElementById('categoryNav');
    nav.innerHTML = '';
    state.categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'category-chip' + (cat.id === state.activeCategory ? ' active' : '');
      btn.type = 'button';
      btn.textContent = window.I18N.trCategoryName(cat);
      btn.addEventListener('click', () => {
        document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(btn);
    });
  }

  // ── menu render ───────────────────────────────────────────────────────
  function dishCard(dish) {
    const unavailable = dish.available === false;
    const name = window.I18N.trDishName(dish);
    const card = document.createElement('div');
    card.className = 'dish-card' + (unavailable ? ' dish-unavailable' : '');
    card.innerHTML = `
      <div class="dish-img-wrap">
        <img src="${dish.image || placeholderImg()}" alt="${escapeHtml(name)}" loading="lazy" />
        <div class="dish-badges">
          ${(dish.tags || []).slice(0, 2).map((t) => `<span class="badge">${escapeHtml(window.I18N.trTag(t))}</span>`).join('')}
          ${unavailable ? `<span class="badge">${escapeHtml(window.I18N.t('unavailableBadge'))}</span>` : ''}
        </div>
      </div>
      <div class="dish-body">
        <div class="dish-name">${escapeHtml(name)}</div>
        <div class="dish-desc">${escapeHtml(window.I18N.trDishDescription(dish))}</div>
        <div class="dish-footer">
          <div class="dish-price">${money(dish.price)}</div>
          <button class="add-btn" type="button" aria-label="${escapeHtml(window.I18N.t('addToCartAriaLabel'))}">+</button>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn')) {
        e.stopPropagation();
        if (!unavailable) { addToCart(dish.id, 1); pulse(e.target.closest('.add-btn')); }
        return;
      }
      openDishModal(dish);
    });
    return card;
  }

  function placeholderImg() {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="%23F3DCC7"/></svg>`
    );
  }

  function pulse(el) {
    el.style.transform = 'scale(1.25)';
    setTimeout(() => { el.style.transform = ''; }, 150);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderMenu() {
    const wrap = document.getElementById('menuWrap');
    const q = state.search.trim().toLowerCase();
    wrap.innerHTML = '';

    let anyResults = false;
    state.categories.forEach((cat) => {
      let dishes = state.dishes.filter((d) => d.categoryId === cat.id);
      if (q) {
        dishes = dishes.filter((d) => {
          const name = window.I18N.trDishName(d).toLowerCase();
          const desc = window.I18N.trDishDescription(d).toLowerCase();
          return name.includes(q) || desc.includes(q);
        });
      }
      if (dishes.length === 0) return;
      anyResults = true;

      const section = document.createElement('section');
      section.className = 'category-section';
      section.id = `cat-${cat.id}`;
      section.innerHTML = `<h2>${escapeHtml(window.I18N.trCategoryName(cat))} <span class="cat-count">${dishes.length}</span></h2>`;
      const grid = document.createElement('div');
      grid.className = 'dish-grid';
      dishes.forEach((d) => grid.appendChild(dishCard(d)));
      section.appendChild(grid);
      wrap.appendChild(section);
    });

    if (!anyResults) {
      wrap.innerHTML = `<div class="empty-state">${escapeHtml(window.I18N.t('noResultsLabel'))}${q ? `: "${escapeHtml(q)}"` : '.'}</div>`;
    }
  }

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderMenu();
  });

  // ── dish modal ───────────────────────────────────────────────────────
  const dishOverlay = document.getElementById('dishOverlay');
  const dishModal = document.getElementById('dishModal');
  let modalQty = 1;
  let modalDish = null;
  let modalNote = '';

  function openDishModal(dish) {
    modalDish = dish;
    modalQty = 1;
    modalNote = state.cartNotes[dish.id] || '';
    renderDishModal();
    dishOverlay.classList.add('open');
    updateFabVisibility();
  }
  function closeDishModal() { dishOverlay.classList.remove('open'); updateFabVisibility(); }

  function renderDishModal() {
    const dish = modalDish;
    const name = window.I18N.trDishName(dish);
    const customizationOn = state.settings?.customization?.enabled !== false;
    const quickOptions = state.settings?.customization?.quickOptions || [];
    dishModal.innerHTML = `
      <div class="modal-header">
        <img class="modal-img" src="${dish.image || placeholderImg()}" alt="${escapeHtml(name)}" />
        <button class="modal-close" id="modalCloseBtn" type="button">✕</button>
      </div>
      <div class="modal-body">
        <h3>${escapeHtml(name)}</h3>
        <div class="modal-price">${money(dish.price)}</div>
        <div class="modal-desc">${escapeHtml(window.I18N.trDishDescription(dish))}</div>
        ${(dish.tags || []).length ? `<div class="tag-row">${dish.tags.map((t) => `<span class="tag-pill">${escapeHtml(window.I18N.trTag(t))}</span>`).join('')}</div>` : ''}
        ${customizationOn ? `
        <div class="field-group">
          <label>${escapeHtml(window.I18N.t('customizeLabel'))}</label>
          <textarea id="dishNoteInput" placeholder="${escapeHtml(window.I18N.t('customizePlaceholder'))}">${escapeHtml(modalNote)}</textarea>
          ${quickOptions.length ? `<div class="chat-suggestions" style="padding:8px 0 0">${quickOptions.map((o) => `<button type="button" class="chip-btn" data-opt="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}</div>` : ''}
        </div>` : ''}
        <div class="qty-add-row">
          <div class="qty-stepper">
            <button type="button" id="qtyMinus">−</button>
            <span id="qtyVal">${modalQty}</span>
            <button type="button" id="qtyPlus">+</button>
          </div>
          <button class="btn-primary" id="addToCartBtn" type="button">${escapeHtml(window.I18N.t('addToCartLabel'))} · ${money(dish.price * modalQty)}</button>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" id="askAiBtn" type="button">${escapeHtml(window.I18N.t('askAi'))}</button>
        </div>
      </div>
    `;
    dishModal.querySelector('#modalCloseBtn').addEventListener('click', closeDishModal);
    dishModal.querySelector('#qtyMinus').addEventListener('click', () => { modalQty = Math.max(1, modalQty - 1); refreshQty(); });
    dishModal.querySelector('#qtyPlus').addEventListener('click', () => { modalQty = Math.min(20, modalQty + 1); refreshQty(); });
    const noteInput = dishModal.querySelector('#dishNoteInput');
    if (noteInput) {
      noteInput.addEventListener('input', () => { modalNote = noteInput.value; });
      dishModal.querySelectorAll('[data-opt]').forEach((chip) => {
        chip.addEventListener('click', () => {
          const opt = chip.dataset.opt;
          const parts = noteInput.value.split(',').map((s) => s.trim()).filter(Boolean);
          if (parts.includes(opt)) return;
          parts.push(opt);
          noteInput.value = parts.join(', ');
          modalNote = noteInput.value;
        });
      });
    }
    dishModal.querySelector('#addToCartBtn').addEventListener('click', () => {
      addToCart(dish.id, modalQty, modalNote);
      closeDishModal();
    });
    dishModal.querySelector('#askAiBtn').addEventListener('click', () => {
      closeDishModal();
      window.DegirmenChat?.askAbout(dish);
    });
  }
  function refreshQty() {
    dishModal.querySelector('#qtyVal').textContent = modalQty;
    dishModal.querySelector('#addToCartBtn').textContent = `${window.I18N.t('addToCartLabel')} · ${money(modalDish.price * modalQty)}`;
  }
  dishOverlay.addEventListener('click', (e) => { if (e.target === dishOverlay) closeDishModal(); });

  // ── guided picker quiz (separate window: question-by-question, then result cards) ──
  const quizOverlay = document.getElementById('quizOverlay');
  const quizModal = document.getElementById('quizModal');
  let quizAnswers = {};

  // Built fresh from I18N on every call so the quiz always reflects the
  // currently selected language, even mid-flow.
  function quizCategoryStep() {
    const t = window.I18N.t;
    const have = new Set(state.dishes.filter((d) => d.available !== false).map((d) => d.categoryId));
    const allOptions = [
      { label: t('quizOptSoup'), value: 'soups' },
      { label: t('quizOptMains'), value: 'mains' },
      { label: t('quizOptPizza'), value: 'pizza' },
      { label: t('quizOptDesserts'), value: 'desserts' },
      { label: t('quizOptDrinks'), value: 'drinks' },
      { label: t('quizOptSurprise'), value: null },
    ];
    return { key: 'category', question: t('quizQ1'), options: allOptions.filter((o) => o.value === null || have.has(o.value)) };
  }
  function quizMeatStep() {
    const t = window.I18N.t;
    return {
      key: 'meat',
      question: t('quizQ2'),
      options: [
        { label: t('quizOptMeat'), value: 'meat' },
        { label: t('quizOptVeg'), value: 'veg' },
        { label: t('quizOptAny'), value: null },
      ],
    };
  }
  function quizSpiceStep() {
    const t = window.I18N.t;
    return {
      key: 'spice',
      question: t('quizQ3'),
      options: [
        { label: t('quizOptSpicy'), value: 'spicy' },
        { label: t('quizOptMild'), value: 'mild' },
        { label: t('quizOptAny'), value: null },
      ],
    };
  }

  function nextQuizStep() {
    if (!('category' in quizAnswers)) return quizCategoryStep();
    const cat = quizAnswers.category;
    const needsMeat = cat === null || ['mains', 'soups', 'pizza'].includes(cat);
    const needsSpice = cat !== 'drinks';
    if (needsMeat && !('meat' in quizAnswers)) return quizMeatStep();
    if (needsSpice && !('spice' in quizAnswers)) return quizSpiceStep();
    return null; // done — show results
  }

  function openQuiz() {
    quizAnswers = {};
    renderQuizStep();
    quizOverlay.classList.add('open');
    updateFabVisibility();
  }
  function closeQuiz() { quizOverlay.classList.remove('open'); updateFabVisibility(); }
  quizOverlay.addEventListener('click', (e) => { if (e.target === quizOverlay) closeQuiz(); });

  function renderQuizStep() {
    const step = nextQuizStep();
    if (!step) { renderQuizResults(); return; }
    quizModal.innerHTML = `
      <button class="modal-close" id="quizCloseBtn" type="button">✕</button>
      <div class="quiz-body">
        <div class="quiz-question">${escapeHtml(step.question)}</div>
        <div class="quiz-options">
          ${step.options.map((o, i) => `<button type="button" class="quiz-option" data-i="${i}">${o.label}</button>`).join('')}
        </div>
      </div>
    `;
    quizModal.querySelector('#quizCloseBtn').addEventListener('click', closeQuiz);
    quizModal.querySelectorAll('.quiz-option').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        quizAnswers[step.key] = step.options[i].value;
        renderQuizStep();
      });
    });
  }

  function matchQuizDishes() {
    let list = state.dishes.filter((d) => d.available !== false);
    if (quizAnswers.category) list = list.filter((d) => d.categoryId === quizAnswers.category);

    let result = list;
    if (quizAnswers.meat === 'veg') {
      const veg = list.filter((d) => (d.tags || []).some((t) => /вегетар|веган/i.test(t)));
      if (veg.length) result = veg;
    } else if (quizAnswers.meat === 'meat') {
      const meat = list.filter((d) => !(d.tags || []).some((t) => /вегетар|веган/i.test(t)));
      if (meat.length) result = meat;
    }
    if (quizAnswers.spice === 'spicy') {
      const spicy = result.filter((d) => (d.tags || []).some((t) => /остр/i.test(t)));
      if (spicy.length) result = spicy;
    } else if (quizAnswers.spice === 'mild') {
      const mild = result.filter((d) => !(d.tags || []).some((t) => /остр/i.test(t)));
      if (mild.length) result = mild;
    }
    return result
      .slice()
      .sort((a, b) => {
        const aHit = (a.tags || []).some((t) => /хит/i.test(t)) ? 1 : 0;
        const bHit = (b.tags || []).some((t) => /хит/i.test(t)) ? 1 : 0;
        return bHit - aHit;
      })
      .slice(0, 6);
  }

  function renderQuizResults() {
    const results = matchQuizDishes();
    const t = window.I18N.t;
    quizModal.innerHTML = `
      <button class="modal-close" id="quizCloseBtn" type="button">✕</button>
      <div class="quiz-body">
        <div class="quiz-question">${escapeHtml(t('quizResultTitle'))}</div>
        ${results.length === 0
          ? `<div class="empty-state">${escapeHtml(t('quizNoResults'))}</div>`
          : `<div class="quiz-result-grid">
              ${results.map((d) => `
                <div class="quiz-result-card" data-id="${d.id}">
                  <img src="${d.image || placeholderImg()}" alt="" />
                  <div class="info">
                    <div class="name">${escapeHtml(window.I18N.trDishName(d))}</div>
                    <div class="row">
                      <span class="price">${money(d.price)}</span>
                      <button type="button" class="add" aria-label="${escapeHtml(t('addToCartAriaLabel'))}">+</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>`}
        <div class="quiz-actions">
          <button class="btn-ghost" id="quizRestartBtn" type="button">${escapeHtml(t('quizRestart'))}</button>
        </div>
      </div>
    `;
    quizModal.querySelector('#quizCloseBtn').addEventListener('click', closeQuiz);
    quizModal.querySelector('#quizRestartBtn').addEventListener('click', openQuiz);
    quizModal.querySelectorAll('.quiz-result-card').forEach((card) => {
      const dish = results.find((d) => d.id === card.dataset.id);
      card.querySelector('.add').addEventListener('click', (e) => {
        e.stopPropagation();
        addToCart(dish.id, 1);
        pulse(e.target);
      });
      card.addEventListener('click', () => {
        closeQuiz();
        openDishModal(dish);
      });
    });
  }

  // ── loyalty wallet ───────────────────────────────────────────────────
  const walletOverlay = document.getElementById('walletOverlay');
  const walletModal = document.getElementById('walletModal');

  function openWallet() {
    renderWallet();
    walletOverlay.classList.add('open');
    updateFabVisibility();
    loadGuest(); // refresh balance in case an order just posted elsewhere
  }
  function closeWallet() { walletOverlay.classList.remove('open'); updateFabVisibility(); }
  walletOverlay.addEventListener('click', (e) => { if (e.target === walletOverlay) closeWallet(); });
  document.getElementById('walletBtn').addEventListener('click', openWallet);

  function renderWallet() {
    const t = window.I18N.t;
    const g = state.guest;
    const history = g?.history || [];
    walletModal.innerHTML = `
      <button class="modal-close" id="walletCloseBtn" type="button">✕</button>
      <div class="wallet-body">
        <div class="wallet-card">
          <div class="label">${escapeHtml(t('walletTitle'))}</div>
          <div class="points">${g?.points ?? 0} <small>${escapeHtml(t('walletPoints'))}</small></div>
          <div class="guest-id">ID: ${escapeHtml((g?.id || state.guestId).slice(0, 18))}</div>
        </div>
        <div class="wallet-history-title">${escapeHtml(t('walletHistoryTitle'))}</div>
        ${history.length === 0
          ? `<div class="empty-state" style="padding:20px 0">${escapeHtml(t('walletHistoryEmpty'))}</div>`
          : history.map((o) => `
              <div class="wallet-history-item">
                <div>
                  <div>${escapeHtml((o.items || []).map((i) => `${i.name} ×${i.qty}`).join(', '))}</div>
                  <div class="date">${new Date(o.createdAt).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="meta">
                  <div>${money(o.total)}</div>
                  ${o.pointsEarned ? `<div class="date">+${o.pointsEarned} ★</div>` : ''}
                </div>
              </div>
            `).join('')}
      </div>
    `;
    walletModal.querySelector('#walletCloseBtn').addEventListener('click', closeWallet);
  }

  // ── cart ──────────────────────────────────────────────────────────────
  function addToCart(dishId, qty, note) {
    state.cart[dishId] = (state.cart[dishId] || 0) + qty;
    if (note != null) {
      const trimmed = note.trim();
      if (trimmed) state.cartNotes[dishId] = trimmed;
      else delete state.cartNotes[dishId];
      saveCartNotes();
    }
    saveCart();
    updateCartBadge();
    renderCart();
    reportCartForAbandonment();
    armAbandonedCartTimer();
  }
  function setNote(dishId, note) {
    const trimmed = (note || '').trim();
    if (trimmed) state.cartNotes[dishId] = trimmed;
    else delete state.cartNotes[dishId];
    saveCartNotes();
    renderCart();
  }
  function setQty(dishId, qty) {
    if (qty <= 0) { delete state.cart[dishId]; delete state.cartNotes[dishId]; saveCartNotes(); }
    else state.cart[dishId] = qty;
    saveCart();
    updateCartBadge();
    renderCart();
    reportCartForAbandonment();
    if (cartCount() > 0) armAbandonedCartTimer();
  }
  function cartCount() { return Object.values(state.cart).reduce((a, b) => a + b, 0); }
  function cartTotal() {
    return Object.entries(state.cart).reduce((sum, [id, qty]) => {
      const dish = state.dishes.find((d) => d.id === id);
      return sum + (dish ? dish.price * qty : 0);
    }, 0);
  }
  function updateCartBadge() {
    const el = document.getElementById('cartCount');
    const n = cartCount();
    el.textContent = n;
    el.classList.toggle('hidden', n === 0);
  }

  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBody = document.getElementById('cartBody');
  const cartFooter = document.getElementById('cartFooter');

  const fabRow = document.querySelector('.fab-row');
  function updateFabVisibility() {
    const anyOpen = dishOverlay.classList.contains('open') || cartOverlay.classList.contains('open') || quizOverlay.classList.contains('open') || walletOverlay.classList.contains('open');
    fabRow?.classList.toggle('hidden', anyOpen);
  }

  function openCart() {
    renderCart();
    cartOverlay.classList.add('open');
    cartDrawer.classList.add('open');
    updateFabVisibility();
    cancelAbandonedCartTimer(); // they're looking at it right now
  }
  function closeCart() {
    cartOverlay.classList.remove('open');
    cartDrawer.classList.remove('open');
    updateFabVisibility();
    armAbandonedCartTimer(); // closed without checking out — re-arm the reminder
  }
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartCloseBtn').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', (e) => { if (e.target === cartOverlay) closeCart(); });

  function computePromoDiscount(promo, subtotal) {
    if (!promo) return 0;
    const raw = promo.type === 'percent' ? (subtotal * promo.value) / 100 : promo.value;
    return Math.max(0, Math.min(Math.round(raw), subtotal));
  }
  function cartTotals() {
    const subtotal = cartTotal();
    const discount = computePromoDiscount(state.appliedPromo, subtotal);
    const afterPromo = Math.max(0, subtotal - discount);
    let pointsSpend = 0;
    const loyalty = state.settings?.loyalty;
    if (state.redeemPoints && state.guest && loyalty?.enabled) {
      const maxByPercent = Math.floor((afterPromo * loyalty.redeemMaxPercent) / 100);
      pointsSpend = Math.min(state.guest.points || 0, maxByPercent, afterPromo);
      if (pointsSpend < loyalty.minRedeem) pointsSpend = 0;
    }
    return { subtotal, discount, pointsSpend, total: Math.max(0, afterPromo - pointsSpend) };
  }

  function renderCart() {
    const t = window.I18N.t;
    const entries = Object.entries(state.cart).filter(([id]) => state.dishes.some((d) => d.id === id));
    if (entries.length === 0) {
      cartBody.innerHTML = `<div class="cart-empty">${t('cartEmpty')}</div>`;
      cartFooter.classList.add('hidden');
      return;
    }
    cartBody.innerHTML = '';
    entries.forEach(([id, qty]) => {
      const dish = state.dishes.find((d) => d.id === id);
      const note = state.cartNotes[id] || '';
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${dish.image || placeholderImg()}" alt="" />
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(window.I18N.trDishName(dish))}</div>
          <div class="cart-item-price">${money(dish.price)} × ${qty}</div>
          <div class="cart-item-controls">
            <button type="button" data-act="minus">−</button>
            <span>${qty}</span>
            <button type="button" data-act="plus">+</button>
            <button class="cart-item-remove" type="button" data-act="remove">${escapeHtml(t('removeItem'))}</button>
          </div>
          ${state.settings?.customization?.enabled !== false ? (
            note
              ? `<div class="cart-item-note" data-act="edit-note">✎ ${escapeHtml(note)}</div>`
              : `<button type="button" class="cart-item-note-add" data-act="edit-note">+ ${escapeHtml(t('customizeLabel'))}</button>`
          ) : ''}
        </div>
      `;
      row.querySelector('[data-act="minus"]').addEventListener('click', () => setQty(id, qty - 1));
      row.querySelector('[data-act="plus"]').addEventListener('click', () => setQty(id, qty + 1));
      row.querySelector('[data-act="remove"]').addEventListener('click', () => setQty(id, 0));
      const noteEl = row.querySelector('[data-act="edit-note"]');
      if (noteEl) {
        noteEl.addEventListener('click', () => {
          const next = prompt(t('cartItemNoteEdit'), note);
          if (next !== null) setNote(id, next);
        });
      }
      cartBody.appendChild(row);
    });

    renderCartSuggestions(entries.map(([id]) => id));

    const totals = cartTotals();
    const formHtml = document.createElement('div');
    formHtml.innerHTML = `
      <div class="field-group">
        <label>${escapeHtml(t('tableNumberLabel'))}</label>
        <input type="text" id="tableNumberInput" placeholder="${escapeHtml(t('tableNumberPlaceholder'))}" value="${escapeHtml(state.tableNumber || '')}" />
      </div>
      <div class="field-group">
        <label>${escapeHtml(t('commentLabel'))}</label>
        <textarea id="orderCommentInput" placeholder="${escapeHtml(t('commentPlaceholder'))}"></textarea>
      </div>
      ${state.settings?.promo?.enabled !== false ? `
      <div class="field-group">
        <label>${escapeHtml(t('promoLabel'))}</label>
        ${state.appliedPromo
          ? `<div class="promo-applied"><span>${escapeHtml(state.appliedPromo.code)} · −${money(totals.discount)}</span><button type="button" id="promoRemoveBtn">${escapeHtml(t('promoRemove'))}</button></div>`
          : `<div class="promo-row"><input type="text" id="promoInput" placeholder="${escapeHtml(t('promoPlaceholder'))}" /><button type="button" class="btn-ghost" id="promoApplyBtn">${escapeHtml(t('promoApply'))}</button></div>
             <div class="promo-error hidden" id="promoError"></div>`}
      </div>` : ''}
      ${state.settings?.loyalty?.enabled && state.guest?.points >= state.settings?.loyalty?.minRedeem ? `
      <div class="redeem-row">
        <div class="info">${escapeHtml(t('redeemLabel'))}<div class="sub">${state.guest.points} ★ ${escapeHtml(t('redeemAvailable'))}</div></div>
        <label class="switch">
          <input type="checkbox" id="redeemToggle" ${state.redeemPoints ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
      </div>` : ''}
    `;
    cartBody.appendChild(formHtml);

    const promoBtn = formHtml.querySelector('#promoApplyBtn');
    if (promoBtn) {
      promoBtn.addEventListener('click', async () => {
        const input = formHtml.querySelector('#promoInput');
        const errEl = formHtml.querySelector('#promoError');
        const code = input.value.trim();
        if (!code) return;
        promoBtn.disabled = true;
        try {
          const res = await fetch(`${API}/api/promo/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, subtotal: cartTotal() }),
          });
          const data = await res.json();
          if (!res.ok) {
            errEl.textContent = data.error === 'min_order'
              ? `${t('promoInvalid')} (${t('total')} ${money(data.minOrder)}+)`
              : t('promoInvalid');
            errEl.classList.remove('hidden');
            return;
          }
          state.appliedPromo = { code: data.code, type: data.type, value: data.value };
          renderCart();
        } catch {
          errEl.textContent = t('promoInvalid');
          errEl.classList.remove('hidden');
        } finally {
          promoBtn.disabled = false;
        }
      });
    }
    const promoRemoveBtn = formHtml.querySelector('#promoRemoveBtn');
    if (promoRemoveBtn) promoRemoveBtn.addEventListener('click', () => { state.appliedPromo = null; renderCart(); });
    const redeemToggle = formHtml.querySelector('#redeemToggle');
    if (redeemToggle) redeemToggle.addEventListener('change', () => { state.redeemPoints = redeemToggle.checked; renderCart(); });

    cartFooter.classList.remove('hidden');
    renderCartTotals(totals);
  }

  function renderCartTotals(totals) {
    const t = window.I18N.t;
    const rows = [];
    if (totals.discount > 0) rows.push(`<div class="cart-discount-row"><span>${escapeHtml(t('discountLabel'))}</span><span>−${money(totals.discount)}</span></div>`);
    if (totals.pointsSpend > 0) rows.push(`<div class="cart-discount-row"><span>${escapeHtml(t('pointsSpentLabel'))}</span><span>−${money(totals.pointsSpend)}</span></div>`);
    cartFooter.querySelectorAll('.cart-discount-row').forEach((el) => el.remove());
    const totalRow = cartFooter.querySelector('.cart-total-row');
    rows.reverse().forEach((html) => totalRow.insertAdjacentHTML('beforebegin', html));
    document.getElementById('cartTotal').textContent = money(totals.total);
  }

  // Nudge to complete the order: if there's nothing from a "core" category yet
  // (drink, first course…), show a few pickable cards for it right in the cart.
  // Falls back to the built-in "missing soup/drink" rules if the admin
  // hasn't configured anything yet — settings.json ships with those two by
  // default anyway, so in practice this only matters before /api/settings
  // has loaded for the first time.
  function suggestRules() {
    if (state.settings?.upsell?.enabled === false) return [];
    const configured = state.settings?.upsell?.rules;
    if (Array.isArray(configured) && configured.length) return configured;
    return [
      { mode: 'missing_category', targetId: 'soups', title: window.I18N.t('suggestSoup'), suggestCategory: 'soups' },
      { mode: 'missing_category', targetId: 'drinks', title: window.I18N.t('suggestDrink'), suggestCategory: 'drinks' },
    ];
  }
  function localizedRuleField(rule, base) {
    const lang = window.I18N.getLang();
    if (lang === 'ru') return rule[base] || '';
    return rule[`${base}_${lang}`] || rule[base] || '';
  }
  function renderCartSuggestions(cartDishIds) {
    const cartCategoryIds = new Set(cartDishIds.map((id) => state.dishes.find((d) => d.id === id)?.categoryId));
    const cartDishIdSet = new Set(cartDishIds);
    suggestRules().forEach((rule) => {
      const matches = rule.mode === 'has_category' ? cartCategoryIds.has(rule.targetId)
        : rule.mode === 'has_dish' ? cartDishIdSet.has(rule.targetId)
        : rule.mode === 'missing_dish' ? !cartDishIdSet.has(rule.targetId)
        : !cartCategoryIds.has(rule.targetId); // missing_category (default)
      if (!matches) return;

      let options = [];
      if (rule.suggestDishes?.length) {
        options = rule.suggestDishes.map((id) => state.dishes.find((d) => d.id === id)).filter(Boolean);
      } else if (rule.suggestCategory) {
        options = state.dishes.filter((d) => d.categoryId === rule.suggestCategory && d.available !== false);
      }
      options = options.filter((d) => !cartDishIdSet.has(d.id)).slice(0, 6);
      if (options.length === 0) return;

      const block = document.createElement('div');
      block.className = 'cart-suggest';
      block.innerHTML = `<div class="cart-suggest-title">${escapeHtml(localizedRuleField(rule, 'title'))}</div>`;
      const row = document.createElement('div');
      row.className = 'cart-suggest-row';
      options.forEach((dish) => {
        const card = document.createElement('div');
        card.className = 'cart-suggest-card';
        card.innerHTML = `
          <img src="${dish.image || placeholderImg()}" alt="" />
          <div class="info">
            <div class="name">${escapeHtml(window.I18N.trDishName(dish))}</div>
            <div class="row">
              <span class="price">${money(dish.price)}</span>
              <button type="button" class="add" aria-label="${escapeHtml(window.I18N.t('addToCartAriaLabel'))}">+</button>
            </div>
          </div>
        `;
        card.querySelector('.add').addEventListener('click', (e) => {
          e.stopPropagation();
          addToCart(dish.id, 1);
        });
        card.addEventListener('click', () => {
          closeCart();
          openDishModal(dish);
        });
        row.appendChild(card);
      });
      block.appendChild(row);
      cartBody.appendChild(block);
    });
  }

  document.getElementById('checkoutBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkoutBtn');
    const tableNumber = document.getElementById('tableNumberInput')?.value?.trim() || '';
    const comment = document.getElementById('orderCommentInput')?.value?.trim() || '';
    if (tableNumber) { state.tableNumber = tableNumber; try { sessionStorage.setItem(TABLE_KEY, tableNumber); } catch {} renderTableBadge(); }

    const items = Object.entries(state.cart).map(([dishId, qty]) => ({ dishId, qty, note: state.cartNotes[dishId] || '' }));
    if (items.length === 0) return;

    const totals = cartTotals();
    btn.disabled = true;
    btn.textContent = window.I18N.t('sending');
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, tableNumber, comment,
          branchId: state.branchId || null,
          guestId: state.guestId,
          promoCode: state.appliedPromo?.code || null,
          redeemPoints: totals.pointsSpend > 0 ? totals.pointsSpend : 0,
        }),
      });
      if (!res.ok) throw new Error('order failed');
      const order = await res.json();
      state.cart = {};
      state.cartNotes = {};
      state.appliedPromo = null;
      state.redeemPoints = false;
      saveCart();
      saveCartNotes();
      updateCartBadge();
      showOrderSuccess(order);
      cancelAbandonedCartTimer();
      loadGuest();
    } catch (e) {
      alert(window.I18N.t('orderFailed'));
      btn.disabled = false;
      btn.textContent = window.I18N.t('checkout');
    }
  });

  function showOrderSuccess(order) {
    const t = window.I18N.t;
    cartBody.innerHTML = `
      <div class="order-success">
        <div class="big-check">✅</div>
        <h3>${escapeHtml(t('orderSuccessTitle'))}</h3>
        <div class="order-id">${escapeHtml(t('orderNumberWord'))} ${order.id}</div>
        <p style="color:var(--ink-soft)">${escapeHtml(t('tableWord'))} ${order.tableNumber || '—'} · ${escapeHtml(t('total'))} ${money(order.total)}</p>
        <p style="color:var(--ink-soft); font-size:0.85rem">${escapeHtml(t('orderSuccessNote'))}</p>
        <button class="btn-primary" id="newOrderBtn" type="button" style="margin-top:10px">${escapeHtml(t('orderMore'))}</button>
      </div>
    `;
    cartFooter.classList.add('hidden');
    document.getElementById('newOrderBtn').addEventListener('click', closeCart);
  }

  // ── idle "need help choosing?" nudge ────────────────────────────────────
  // Unconditional: fires once, exactly 60s after the page loads, no matter
  // what's in the cart, whether the guest is chatting, or anything else.
  const NUDGE_DELAY_MS = 60000;
  const idleNudge = document.getElementById('idleNudge');

  function showIdleNudge() { idleNudge.classList.remove('hidden'); }
  function hideIdleNudge() { idleNudge.classList.add('hidden'); }

  document.getElementById('idleNudgeClose').addEventListener('click', hideIdleNudge);
  document.getElementById('idleNudgeBtn').addEventListener('click', () => {
    hideIdleNudge();
    openQuiz();
  });

  // "Подобрать блюдо" button inside the chat panel — same quiz, just
  // reachable on demand instead of only via the idle nudge.
  document.getElementById('chatQuizBtn').addEventListener('click', () => {
    window.DegirmenChat?.close();
    openQuiz();
  });

  // ── abandoned-cart reminder ──────────────────────────────────────────
  // Items sat in the cart for N minutes (admin-configured) with no
  // checkout — a soft nudge to finish, plus the cart is reported to the
  // backend so staff can see "table 5 filled a cart but never sent it".
  const cartNudge = document.getElementById('cartNudge');
  let abandonedTimer = null;
  let reportTimer = null;

  function showCartNudge() {
    if (cartCount() === 0) return;
    hideIdleNudge(); // don't stack two bubbles at once
    const s = state.settings?.abandonedCart;
    const lang = window.I18N.getLang();
    const text = (s && (lang !== 'ru' ? s[`text_${lang}`] : s.text)) || s?.text || window.I18N.t('nudgeText');
    document.getElementById('cartNudgeText').textContent = text;
    cartNudge.classList.remove('hidden');
  }
  function hideCartNudge() { cartNudge.classList.add('hidden'); }
  function armAbandonedCartTimer() {
    clearTimeout(abandonedTimer);
    const s = state.settings?.abandonedCart;
    if (!s?.enabled || cartCount() === 0) return;
    const delayMs = Math.max(1, Number(s.delayMinutes) || 3) * 60000;
    abandonedTimer = setTimeout(showCartNudge, delayMs);
  }
  function cancelAbandonedCartTimer() {
    clearTimeout(abandonedTimer);
    hideCartNudge();
  }
  function reportCartForAbandonment() {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => {
      const items = Object.entries(state.cart).map(([dishId, qty]) => ({ dishId, qty }));
      fetch(`${API}/api/carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: state.guestId, items, total: cartTotal(), tableNumber: state.tableNumber, branchId: state.branchId }),
      }).catch(() => {});
    }, 800);
  }

  document.getElementById('cartNudgeClose').addEventListener('click', cancelAbandonedCartTimer);
  document.getElementById('cartNudgeBtn').addEventListener('click', () => {
    hideCartNudge();
    openCart();
  });

  // expose minimal API for chat.js
  window.Degirmen = {
    getMenuContext: () => ({ categories: state.categories, dishes: state.dishes }),
    addToCart,
    money,
    cancelIdleNudge: () => {}, // nudge is unconditional now — chat opening no longer cancels it
    openQuiz,
    getGuestContext: () => ({ guestId: state.guestId, tableNumber: state.tableNumber, branchId: state.branchId }),
  };

  setTimeout(showIdleNudge, NUDGE_DELAY_MS);
  renderTableBadge();

  loadMenu().catch((e) => {
    document.getElementById('menuWrap').innerHTML = `<div class="empty-state">${escapeHtml(window.I18N.t('loadMenuError'))}</div>`;
    console.error(e);
  });
  loadSettings().then(() => { updateWalletBadge(); armAbandonedCartTimer(); });
  loadGuest();

  // Language switched — re-render everything that has translated content
  // baked into its HTML (dish names/descriptions, categories, cart, quiz).
  window.addEventListener('degirmen:langchange', () => {
    renderCategoryNav();
    renderMenu();
    renderTableBadge();
    if (cartOverlay.classList.contains('open')) renderCart();
    if (quizOverlay.classList.contains('open')) renderQuizStep();
  });
})();
