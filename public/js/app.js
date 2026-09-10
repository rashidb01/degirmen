(() => {
  const API = '';
  const CART_KEY = 'degirmen_cart_v1';
  const money = (n) => `${Number(n).toLocaleString('ru-RU')} ₸`;

  let state = {
    categories: [],
    dishes: [],
    activeCategory: null,
    search: '',
    cart: loadCart(),
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
  function dishAllergenLine(dish) {
    if (!dish.allergens || dish.allergens.length === 0) return window.I18N.t('allergensNone');
    return `<b>${window.I18N.t('allergensLabel')}</b> ${dish.allergens.map(window.I18N.trAllergen).join(', ')}`;
  }

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
        <div class="dish-allergens">${dishAllergenLine(dish)}</div>
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

  function openDishModal(dish) {
    modalDish = dish;
    modalQty = 1;
    renderDishModal();
    dishOverlay.classList.add('open');
    updateFabVisibility();
  }
  function closeDishModal() { dishOverlay.classList.remove('open'); updateFabVisibility(); }

  function renderDishModal() {
    const dish = modalDish;
    const name = window.I18N.trDishName(dish);
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
        <div class="allergen-block">
          <div class="allergen-icon">⚠️</div>
          <div>
            <strong>${escapeHtml(window.I18N.t('allergensHeading'))}</strong>
            ${dish.allergens && dish.allergens.length
              ? `<div class="allergen-chip-row">${dish.allergens.map((a) => `<span class="allergen-chip">${escapeHtml(window.I18N.trAllergen(a))}</span>`).join('')}</div>`
              : `<div class="allergen-note">${escapeHtml(window.I18N.t('allergensNoneModal'))}</div>`}
          </div>
        </div>
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
    dishModal.querySelector('#addToCartBtn').addEventListener('click', () => {
      addToCart(dish.id, modalQty);
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

  // ── cart ──────────────────────────────────────────────────────────────
  function addToCart(dishId, qty) {
    state.cart[dishId] = (state.cart[dishId] || 0) + qty;
    saveCart();
    updateCartBadge();
    renderCart();
  }
  function setQty(dishId, qty) {
    if (qty <= 0) delete state.cart[dishId];
    else state.cart[dishId] = qty;
    saveCart();
    updateCartBadge();
    renderCart();
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
    const anyOpen = dishOverlay.classList.contains('open') || cartOverlay.classList.contains('open') || quizOverlay.classList.contains('open');
    fabRow?.classList.toggle('hidden', anyOpen);
  }

  function openCart() { renderCart(); cartOverlay.classList.add('open'); cartDrawer.classList.add('open'); updateFabVisibility(); }
  function closeCart() { cartOverlay.classList.remove('open'); cartDrawer.classList.remove('open'); updateFabVisibility(); }
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartCloseBtn').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', (e) => { if (e.target === cartOverlay) closeCart(); });

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
        </div>
      `;
      row.querySelector('[data-act="minus"]').addEventListener('click', () => setQty(id, qty - 1));
      row.querySelector('[data-act="plus"]').addEventListener('click', () => setQty(id, qty + 1));
      row.querySelector('[data-act="remove"]').addEventListener('click', () => setQty(id, 0));
      cartBody.appendChild(row);
    });

    renderCartSuggestions(entries.map(([id]) => id));

    const formHtml = document.createElement('div');
    formHtml.innerHTML = `
      <div class="field-group">
        <label>${escapeHtml(t('tableNumberLabel'))}</label>
        <input type="text" id="tableNumberInput" placeholder="${escapeHtml(t('tableNumberPlaceholder'))}" value="${sessionStorage.getItem('degirmen_table') || ''}" />
      </div>
      <div class="field-group">
        <label>${escapeHtml(t('commentLabel'))}</label>
        <textarea id="orderCommentInput" placeholder="${escapeHtml(t('commentPlaceholder'))}"></textarea>
      </div>
    `;
    cartBody.appendChild(formHtml);

    cartFooter.classList.remove('hidden');
    document.getElementById('cartTotal').textContent = money(cartTotal());
  }

  // Nudge to complete the order: if there's nothing from a "core" category yet
  // (drink, first course…), show a few pickable cards for it right in the cart.
  function suggestRules() {
    return [
      { categoryId: 'soups', title: window.I18N.t('suggestSoup') },
      { categoryId: 'drinks', title: window.I18N.t('suggestDrink') },
    ];
  }
  function renderCartSuggestions(cartDishIds) {
    const cartCategoryIds = new Set(cartDishIds.map((id) => state.dishes.find((d) => d.id === id)?.categoryId));
    suggestRules().forEach((rule) => {
      if (cartCategoryIds.has(rule.categoryId)) return;
      const category = state.categories.find((c) => c.id === rule.categoryId);
      if (!category) return;
      const options = state.dishes.filter((d) => d.categoryId === rule.categoryId && d.available !== false).slice(0, 6);
      if (options.length === 0) return;

      const block = document.createElement('div');
      block.className = 'cart-suggest';
      block.innerHTML = `<div class="cart-suggest-title">${escapeHtml(rule.title)}</div>`;
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
    if (tableNumber) sessionStorage.setItem('degirmen_table', tableNumber);

    const items = Object.entries(state.cart).map(([dishId, qty]) => ({ dishId, qty }));
    if (items.length === 0) return;

    btn.disabled = true;
    btn.textContent = window.I18N.t('sending');
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, tableNumber, comment }),
      });
      if (!res.ok) throw new Error('order failed');
      const order = await res.json();
      state.cart = {};
      saveCart();
      updateCartBadge();
      showOrderSuccess(order);
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

  // expose minimal API for chat.js
  window.Degirmen = {
    getMenuContext: () => ({ categories: state.categories, dishes: state.dishes }),
    addToCart,
    money,
    cancelIdleNudge: () => {}, // nudge is unconditional now — chat opening no longer cancels it
  };

  setTimeout(showIdleNudge, NUDGE_DELAY_MS);

  loadMenu().catch((e) => {
    document.getElementById('menuWrap').innerHTML = `<div class="empty-state">${escapeHtml(window.I18N.t('loadMenuError'))}</div>`;
    console.error(e);
  });

  // Language switched — re-render everything that has translated content
  // baked into its HTML (dish names/descriptions, categories, cart, quiz).
  window.addEventListener('degirmen:langchange', () => {
    renderCategoryNav();
    renderMenu();
    if (cartOverlay.classList.contains('open')) renderCart();
    if (quizOverlay.classList.contains('open')) renderQuizStep();
  });
})();
