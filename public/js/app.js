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
      btn.textContent = cat.name;
      btn.addEventListener('click', () => {
        document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(btn);
    });
  }

  // ── menu render ───────────────────────────────────────────────────────
  function dishAllergenLine(dish) {
    if (!dish.allergens || dish.allergens.length === 0) return 'Аллергены не заявлены';
    return `<b>Аллергены:</b> ${dish.allergens.join(', ')}`;
  }

  function dishCard(dish) {
    const unavailable = dish.available === false;
    const card = document.createElement('div');
    card.className = 'dish-card' + (unavailable ? ' dish-unavailable' : '');
    card.innerHTML = `
      <div class="dish-img-wrap">
        <img src="${dish.image || placeholderImg()}" alt="${escapeHtml(dish.name)}" loading="lazy" />
        <div class="dish-badges">
          ${(dish.tags || []).slice(0, 2).map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join('')}
          ${unavailable ? '<span class="badge">нет в наличии</span>' : ''}
        </div>
      </div>
      <div class="dish-body">
        <div class="dish-name">${escapeHtml(dish.name)}</div>
        <div class="dish-desc">${escapeHtml(dish.description || '')}</div>
        <div class="dish-allergens">${dishAllergenLine(dish)}</div>
        <div class="dish-footer">
          <div class="dish-price">${money(dish.price)}</div>
          <button class="add-btn" type="button" aria-label="Добавить в корзину">+</button>
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
      if (q) dishes = dishes.filter((d) => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q));
      if (dishes.length === 0) return;
      anyResults = true;

      const section = document.createElement('section');
      section.className = 'category-section';
      section.id = `cat-${cat.id}`;
      section.innerHTML = `<h2>${escapeHtml(cat.name)} <span class="cat-count">${dishes.length}</span></h2>`;
      const grid = document.createElement('div');
      grid.className = 'dish-grid';
      dishes.forEach((d) => grid.appendChild(dishCard(d)));
      section.appendChild(grid);
      wrap.appendChild(section);
    });

    if (!anyResults) {
      wrap.innerHTML = `<div class="empty-state">Ничего не найдено${q ? ` по запросу «${escapeHtml(q)}»` : ''}.</div>`;
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
    dishModal.innerHTML = `
      <div class="modal-header">
        <img class="modal-img" src="${dish.image || placeholderImg()}" alt="${escapeHtml(dish.name)}" />
        <button class="modal-close" id="modalCloseBtn" type="button">✕</button>
      </div>
      <div class="modal-body">
        <h3>${escapeHtml(dish.name)}</h3>
        <div class="modal-price">${money(dish.price)}</div>
        <div class="modal-desc">${escapeHtml(dish.description || '')}</div>
        ${(dish.tags || []).length ? `<div class="tag-row">${dish.tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="allergen-block">
          <div class="allergen-icon">⚠️</div>
          <div>
            <strong>Аллергены</strong>
            ${dish.allergens && dish.allergens.length
              ? `<div class="allergen-chip-row">${dish.allergens.map((a) => `<span class="allergen-chip">${escapeHtml(a)}</span>`).join('')}</div>`
              : `<div class="allergen-note">Не заявлены. Если сомневаетесь — спросите у AI-помощника.</div>`}
          </div>
        </div>
        <div class="qty-add-row">
          <div class="qty-stepper">
            <button type="button" id="qtyMinus">−</button>
            <span id="qtyVal">${modalQty}</span>
            <button type="button" id="qtyPlus">+</button>
          </div>
          <button class="btn-primary" id="addToCartBtn" type="button">Добавить · ${money(dish.price * modalQty)}</button>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" id="askAiBtn" type="button">🤖 Спросить AI про это блюдо</button>
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
    dishModal.querySelector('#addToCartBtn').textContent = `Добавить · ${money(modalDish.price * modalQty)}`;
  }
  dishOverlay.addEventListener('click', (e) => { if (e.target === dishOverlay) closeDishModal(); });

  // ── cart ──────────────────────────────────────────────────────────────
  function addToCart(dishId, qty) {
    state.cart[dishId] = (state.cart[dishId] || 0) + qty;
    saveCart();
    updateCartBadge();
    renderCart();
    hideIdleNudge();
  }
  function setQty(dishId, qty) {
    if (qty <= 0) delete state.cart[dishId];
    else state.cart[dishId] = qty;
    saveCart();
    updateCartBadge();
    renderCart();
    // Cart emptied out again (guest removed everything) — give the nudge
    // another chance to offer help after a fresh minute of inactivity.
    if (cartCount() === 0) scheduleIdleNudge();
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
    const anyOpen = dishOverlay.classList.contains('open') || cartOverlay.classList.contains('open');
    fabRow?.classList.toggle('hidden', anyOpen);
  }

  function openCart() { renderCart(); cartOverlay.classList.add('open'); cartDrawer.classList.add('open'); updateFabVisibility(); }
  function closeCart() { cartOverlay.classList.remove('open'); cartDrawer.classList.remove('open'); updateFabVisibility(); }
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartCloseBtn').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', (e) => { if (e.target === cartOverlay) closeCart(); });

  function renderCart() {
    const entries = Object.entries(state.cart).filter(([id]) => state.dishes.some((d) => d.id === id));
    if (entries.length === 0) {
      cartBody.innerHTML = `<div class="cart-empty">Корзина пуста.<br>Добавьте блюда из меню 🍽️</div>`;
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
          <div class="cart-item-name">${escapeHtml(dish.name)}</div>
          <div class="cart-item-price">${money(dish.price)} × ${qty}</div>
          <div class="cart-item-controls">
            <button type="button" data-act="minus">−</button>
            <span>${qty}</span>
            <button type="button" data-act="plus">+</button>
            <button class="cart-item-remove" type="button" data-act="remove">Удалить</button>
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
        <label>Номер стола</label>
        <input type="text" id="tableNumberInput" placeholder="напр. 5" value="${sessionStorage.getItem('degirmen_table') || ''}" />
      </div>
      <div class="field-group">
        <label>Комментарий / аллергии</label>
        <textarea id="orderCommentInput" placeholder="Например: без орехов, острое"></textarea>
      </div>
    `;
    cartBody.appendChild(formHtml);

    cartFooter.classList.remove('hidden');
    document.getElementById('cartTotal').textContent = money(cartTotal());
  }

  // Nudge to complete the order: if there's nothing from a "core" category yet
  // (drink, first course…), show a few pickable cards for it right in the cart.
  const SUGGEST_RULES = [
    { categoryId: 'soups', title: 'Не хотите первое?' },
    { categoryId: 'drinks', title: 'Не забудьте про напиток' },
  ];
  function renderCartSuggestions(cartDishIds) {
    const cartCategoryIds = new Set(cartDishIds.map((id) => state.dishes.find((d) => d.id === id)?.categoryId));
    SUGGEST_RULES.forEach((rule) => {
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
            <div class="name">${escapeHtml(dish.name)}</div>
            <div class="row">
              <span class="price">${money(dish.price)}</span>
              <button type="button" class="add" aria-label="Добавить">+</button>
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
    btn.textContent = 'Отправляем…';
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
      // Cart is empty again after this order — let the nudge offer help
      // with the next round if the guest goes quiet again.
      scheduleIdleNudge();
    } catch (e) {
      alert('Не удалось отправить заказ. Попробуйте ещё раз.');
      btn.disabled = false;
      btn.textContent = 'Оформить заказ';
    }
  });

  function showOrderSuccess(order) {
    cartBody.innerHTML = `
      <div class="order-success">
        <div class="big-check">✅</div>
        <h3>Заказ принят!</h3>
        <div class="order-id">№ ${order.id}</div>
        <p style="color:var(--ink-soft)">Стол ${order.tableNumber || '—'} · Итого ${money(order.total)}</p>
        <p style="color:var(--ink-soft); font-size:0.85rem">Оплата на кассе. Онлайн-оплата через Kaspi скоро появится.</p>
        <button class="btn-primary" id="newOrderBtn" type="button" style="margin-top:10px">Заказать ещё</button>
      </div>
    `;
    cartFooter.classList.add('hidden');
    document.getElementById('newOrderBtn').addEventListener('click', closeCart);
  }

  // ── idle "need help choosing?" nudge ────────────────────────────────────
  // Re-arms every time the cart goes back to empty (fresh page load, guest
  // cleared their cart, or right after checkout) — not just once per session —
  // so it can help again on a second round of ordering, too.
  const NUDGE_DELAY_MS = 60000;
  const NUDGE_OPTED_OUT_KEY = 'degirmen_nudge_opted_out';
  const idleNudge = document.getElementById('idleNudge');
  let idleTimer = null;

  function scheduleIdleNudge() {
    if (sessionStorage.getItem(NUDGE_OPTED_OUT_KEY)) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (cartCount() === 0) showIdleNudge();
    }, NUDGE_DELAY_MS);
  }
  function showIdleNudge() { idleNudge.classList.remove('hidden'); }
  // Hides/cancels the nudge for now (e.g. the guest just added something, or
  // opened the chat themselves) — it can still come back later.
  function hideIdleNudge() {
    idleNudge.classList.add('hidden');
    clearTimeout(idleTimer);
  }
  // Explicit "no thanks" (✕) — don't offer it again for the rest of this visit.
  function optOutOfIdleNudge() {
    hideIdleNudge();
    try { sessionStorage.setItem(NUDGE_OPTED_OUT_KEY, '1'); } catch {}
  }
  document.getElementById('idleNudgeClose').addEventListener('click', optOutOfIdleNudge);
  document.getElementById('idleNudgeBtn').addEventListener('click', () => {
    hideIdleNudge();
    window.DegirmenChat?.startGuidedPick();
  });

  // expose minimal API for chat.js
  window.Degirmen = {
    getMenuContext: () => ({ categories: state.categories, dishes: state.dishes }),
    addToCart,
    money,
    cancelIdleNudge: hideIdleNudge,
  };

  scheduleIdleNudge();

  loadMenu().catch((e) => {
    document.getElementById('menuWrap').innerHTML = `<div class="empty-state">Не удалось загрузить меню. Обновите страницу.</div>`;
    console.error(e);
  });
})();
