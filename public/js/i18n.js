// ─── i18n: language switcher + translations (ru / kk / en) ───────────────────
// Loaded before app.js and chat.js. Exposes window.I18N.
(() => {
  const LANG_KEY = 'degirmen_lang';
  const LANGS = ['ru', 'kk', 'en'];
  const DEFAULT_LANG = 'ru';

  const STRINGS = {
    tagline: { ru: 'электронное меню', kk: 'электронды мәзір', en: 'digital menu' },
    searchPlaceholder: { ru: 'Найти блюдо…', kk: 'Тағамды іздеу…', en: 'Search dishes…' },
    loadingMenu: { ru: 'Загружаем меню…', kk: 'Мәзір жүктелуде…', en: 'Loading menu…' },
    loadMenuError: { ru: 'Не удалось загрузить меню. Обновите страницу.', kk: 'Мәзірді жүктеу мүмкін болмады. Бетті жаңартыңыз.', en: "Couldn't load the menu. Please refresh the page." },
    unavailableBadge: { ru: 'нет в наличии', kk: 'қазір жоқ', en: 'sold out' },
    allergensLabel: { ru: 'Аллергены:', kk: 'Аллергендер:', en: 'Allergens:' },
    allergensHeading: { ru: 'Аллергены', kk: 'Аллергендер', en: 'Allergens' },
    allergensNone: { ru: 'Аллергены не заявлены', kk: 'Аллергендер көрсетілмеген', en: 'No allergens listed' },
    allergensNoneModal: { ru: 'Не заявлены. Если сомневаетесь — спросите у AI-помощника.', kk: 'Көрсетілмеген. Күмәніңіз болса — AI-көмекшіден сұраңыз.', en: 'Not listed. If unsure, ask our AI assistant.' },
    addToCartLabel: { ru: 'Добавить', kk: 'Себетке қосу', en: 'Add' },
    addToCartAriaLabel: { ru: 'Добавить в корзину', kk: 'Себетке қосу', en: 'Add to cart' },
    noResultsLabel: { ru: 'Ничего не найдено', kk: 'Ештеңе табылмады', en: 'No results' },
    tableWord: { ru: 'Стол', kk: 'Үстел', en: 'Table' },
    orderNumberWord: { ru: '№', kk: '№', en: 'No.' },
    askAi: { ru: '🤖 Спросить AI про это блюдо', kk: '🤖 Осы тағам туралы AI-дан сұрау', en: '🤖 Ask AI about this dish' },
    cartTitle: { ru: 'Ваш заказ', kk: 'Сіздің тапсырысыңыз', en: 'Your order' },
    cartEmpty: { ru: 'Корзина пуста.<br>Добавьте блюда из меню 🍽️', kk: 'Себет бос.<br>Мәзірден тағам қосыңыз 🍽️', en: 'Your cart is empty.<br>Add something from the menu 🍽️' },
    tableNumberLabel: { ru: 'Номер стола', kk: 'Үстел нөмірі', en: 'Table number' },
    tableNumberPlaceholder: { ru: 'напр. 5', kk: 'мыс. 5', en: 'e.g. 5' },
    commentLabel: { ru: 'Комментарий / аллергии', kk: 'Пікір / аллергия', en: 'Comment / allergies' },
    commentPlaceholder: { ru: 'Например: без орехов, острое', kk: 'Мысалы: жаңғақсыз, өткір', en: 'E.g.: no nuts, spicy' },
    total: { ru: 'Итого', kk: 'Барлығы', en: 'Total' },
    checkout: { ru: 'Оформить заказ', kk: 'Тапсырысты рәсімдеу', en: 'Place order' },
    sending: { ru: 'Отправляем…', kk: 'Жіберілуде…', en: 'Sending…' },
    paymentNote: { ru: 'Оплата на кассе · онлайн-оплата через Kaspi скоро появится', kk: 'Кассада төлеу · Kaspi арқылы онлайн төлем жақында қосылады', en: 'Pay at the table · online payment via Kaspi coming soon' },
    removeItem: { ru: 'Удалить', kk: 'Жою', en: 'Remove' },
    orderFailed: { ru: 'Не удалось отправить заказ. Попробуйте ещё раз.', kk: 'Тапсырысты жіберу мүмкін болмады. Қайтадан көріңіз.', en: "Couldn't send the order. Please try again." },
    orderSuccessTitle: { ru: 'Заказ принят!', kk: 'Тапсырыс қабылданды!', en: 'Order placed!' },
    orderSuccessNote: { ru: 'Оплата на кассе. Онлайн-оплата через Kaspi скоро появится.', kk: 'Кассада төлеу. Kaspi арқылы онлайн төлем жақында қосылады.', en: 'Pay at the table. Online payment via Kaspi is coming soon.' },
    orderMore: { ru: 'Заказать ещё', kk: 'Тағы тапсырыс беру', en: 'Order more' },
    suggestSoup: { ru: 'Не хотите первое?', kk: 'Бірінші тағам алмайсыз ба?', en: 'How about a starter?' },
    suggestDrink: { ru: 'Не забудьте про напиток', kk: 'Сусын туралы ұмытпаңыз', en: "Don't forget a drink" },
    footerLine1: { ru: 'Degirmen · электронное меню и приём заказов', kk: 'Degirmen · электронды мәзір және тапсырыс қабылдау', en: 'Degirmen · digital menu and online ordering' },
    footerLine2: { ru: 'Скоро: оплата через Kaspi и синхронизация заказов с R-Keeper', kk: 'Жақында: Kaspi арқылы төлем және R-Keeper-мен синхрондау', en: 'Coming soon: Kaspi payments and R-Keeper sync' },
    nudgeText: { ru: 'Помочь вам с выбором? 👋', kk: 'Таңдауға көмектесейік пе? 👋', en: 'Need help choosing? 👋' },
    nudgeBtn: { ru: 'Да, помогите', kk: 'Иә, көмектесіңіз', en: 'Yes, help me' },
    quizQ1: { ru: 'Что хотите заказать?', kk: 'Не тапсырғыңыз келеді?', en: 'What would you like?' },
    quizOptSoup: { ru: '🍲 Первое', kk: '🍲 Бірінші тағам', en: '🍲 A starter' },
    quizOptMains: { ru: '🍽️ Основное', kk: '🍽️ Негізгі тағам', en: '🍽️ A main dish' },
    quizOptPizza: { ru: '🍕 Пиццу', kk: '🍕 Пицца', en: '🍕 Pizza' },
    quizOptDesserts: { ru: '🍰 Сладкое', kk: '🍰 Тәтті', en: '🍰 Something sweet' },
    quizOptDrinks: { ru: '🥤 Просто попить', kk: '🥤 Тек ішімдік', en: '🥤 Just a drink' },
    quizOptSurprise: { ru: '🤷 Удивите меня', kk: '🤷 Өзіңіз таңдаңыз', en: '🤷 Surprise me' },
    quizQ2: { ru: 'С мясом или рыбой, или без?', kk: 'Етпен/балықпен бе, әлде онсыз ба?', en: 'With meat or fish, or without?' },
    quizOptMeat: { ru: '🥩 С мясом или рыбой', kk: '🥩 Етпен немесе балықпен', en: '🥩 With meat or fish' },
    quizOptVeg: { ru: '🥦 Без мяса', kk: '🥦 Етсіз', en: '🥦 No meat' },
    quizOptAny: { ru: '🤷 Не важно', kk: '🤷 Бәрібір', en: "🤷 Doesn't matter" },
    quizQ3: { ru: 'Любите поострее?', kk: 'Өткір тағамды ұнатасыз ба?', en: 'Do you like it spicy?' },
    quizOptSpicy: { ru: '🌶️ Да, поострее', kk: '🌶️ Иә, өткірірек', en: '🌶️ Yes, spicy' },
    quizOptMild: { ru: '😌 Нет, помягче', kk: '😌 Жоқ, жұмсағырақ', en: '😌 No, mild' },
    quizResultTitle: { ru: 'Вот что подойдёт 👇', kk: 'Міне не сәйкес келеді 👇', en: "Here's what fits 👇" },
    quizNoResults: { ru: 'Ничего не нашлось под эти пожелания — загляните в меню целиком 🙂', kk: 'Бұл талаптарға сай ештеңе табылмады — мәзірдің толық нұсқасын қараңыз 🙂', en: 'Nothing matched — check out the full menu 🙂' },
    quizRestart: { ru: '↻ Спросить заново', kk: '↻ Қайтадан сұрау', en: '↻ Start over' },
    chatTitle: { ru: 'Помощник Degirmen', kk: 'Degirmen көмекшісі', en: 'Degirmen Assistant' },
    chatSubtitle: { ru: 'Спросите про блюда, аллергены, замену', kk: 'Тағамдар, аллергендер, алмастыру туралы сұраңыз', en: 'Ask about dishes, allergens, substitutes' },
    chatPlaceholder: { ru: 'Напишите сообщение…', kk: 'Хабарлама жазыңыз…', en: 'Type a message…' },
    chatQuizBtn: { ru: 'Подобрать блюдо', kk: 'Тағам таңдау', en: 'Recommend a dish' },

    // customization (free-text dish notes)
    customizeLabel: { ru: 'Пожелания к блюду', kk: 'Тағамға тілектер', en: 'Special requests' },
    customizePlaceholder: { ru: 'Например: без лука, двойной сыр…', kk: 'Мысалы: пиязсыз, қос ірімшік…', en: 'E.g.: no onion, extra cheese…' },
    cartItemNoteEdit: { ru: 'Пожелание', kk: 'Тілек', en: 'Note' },

    // loyalty wallet
    walletTitle: { ru: 'Бонусный кошелёк', kk: 'Бонус әмиян', en: 'Reward wallet' },
    walletPoints: { ru: 'баллов', kk: 'балл', en: 'points' },
    walletHistoryEmpty: { ru: 'Пока нет заказов', kk: 'Әзірге тапсырыс жоқ', en: 'No orders yet' },
    walletHistoryTitle: { ru: 'Прошлые заказы', kk: 'Өткен тапсырыстар', en: 'Order history' },
    walletClose: { ru: 'Закрыть', kk: 'Жабу', en: 'Close' },
    redeemLabel: { ru: 'Списать баллы', kk: 'Балл есептен шығару', en: 'Redeem points' },
    redeemAvailable: { ru: 'доступно', kk: 'қолжетімді', en: 'available' },

    // promo code
    promoLabel: { ru: 'Промокод', kk: 'Промокод', en: 'Promo code' },
    promoPlaceholder: { ru: 'Введите код', kk: 'Кодты енгізіңіз', en: 'Enter code' },
    promoApply: { ru: 'Применить', kk: 'Қолдану', en: 'Apply' },
    promoApplied: { ru: 'Промокод применён', kk: 'Промокод қолданылды', en: 'Promo code applied' },
    promoInvalid: { ru: 'Промокод не найден или недействителен', kk: 'Промокод табылмады немесе жарамсыз', en: 'Promo code not found or invalid' },
    promoRemove: { ru: 'Убрать', kk: 'Алып тастау', en: 'Remove' },
    discountLabel: { ru: 'Скидка', kk: 'Жеңілдік', en: 'Discount' },
    pointsSpentLabel: { ru: 'Списано баллами', kk: 'Баллмен төленді', en: 'Paid with points' },

    // table/branch badge
    tableBadge: { ru: 'Стол', kk: 'Үстел', en: 'Table' },

    chatGreeting: {
      ru: 'Привет! 👋 Я помощник Degirmen. Спросите про состав, аллергены или попросите что-то посоветовать — с удовольствием помогу выбрать блюдо.',
      kk: 'Сәлем! 👋 Мен Degirmen көмекшісімін. Құрамы, аллергендер туралы сұраңыз немесе кеңес сұраңыз — тағам таңдауға көмектесемін.',
      en: "Hi! 👋 I'm the Degirmen assistant. Ask about ingredients, allergens, or ask me for a recommendation — happy to help you choose.",
    },
    chatUnavailable: { ru: 'AI-помощник временно недоступен (не настроен ключ).', kk: 'AI-көмекші уақытша қолжетімсіз (кілт орнатылмаған).', en: 'The AI assistant is temporarily unavailable (no API key configured).' },
    chatError: { ru: 'Извините, что-то пошло не так. Попробуйте ещё раз чуть позже.', kk: 'Кешіріңіз, бірдеңе дұрыс болмады. Сәл кейінірек қайталап көріңіз.', en: 'Sorry, something went wrong. Please try again shortly.' },
    chatNetError: { ru: 'Не получилось связаться с сервером. Проверьте соединение и попробуйте снова.', kk: 'Сервермен байланысу мүмкін болмады. Байланысты тексеріп, қайта көріңіз.', en: "Couldn't reach the server. Check your connection and try again." },
  };

  const CHAT_SUGGESTIONS = {
    ru: ['Что вы посоветуете?', 'Есть блюда без глютена?', 'У меня аллергия на орехи', 'Предложите замену блюду'],
    kk: ['Не ұсынасыз?', 'Глютенсіз тағам бар ма?', 'Маған жаңғаққа аллергия бар', 'Тағамға балама ұсыныңыз'],
    en: ['What do you recommend?', 'Any gluten-free dishes?', "I'm allergic to nuts", 'Suggest a substitute'],
  };

  // Allergen / tag vocab used across the seed menu — translated once here so
  // admins keep entering them in Russian and the site displays them localized.
  const ALLERGEN_LABELS = {
    'глютен': { ru: 'глютен', kk: 'глютен', en: 'gluten' },
    'молоко': { ru: 'молоко', kk: 'сүт', en: 'milk' },
    'яйца': { ru: 'яйца', kk: 'жұмыртқа', en: 'eggs' },
    'рыба': { ru: 'рыба', kk: 'балық', en: 'fish' },
    'морепродукты': { ru: 'морепродукты', kk: 'теңіз өнімдері', en: 'seafood' },
    'орехи': { ru: 'орехи', kk: 'жаңғақ', en: 'nuts' },
    'арахис': { ru: 'арахис', kk: 'жержаңғақ', en: 'peanuts' },
    'соя': { ru: 'соя', kk: 'соя', en: 'soy' },
    'кунжут': { ru: 'кунжут', kk: 'күнжіт', en: 'sesame' },
  };
  const TAG_LABELS = {
    'вегетарианское': { ru: 'вегетарианское', kk: 'вегетариандық', en: 'vegetarian' },
    'веганское': { ru: 'веганское', kk: 'веган', en: 'vegan' },
    'веганское-опция': { ru: 'веганская опция', kk: 'веган нұсқасы бар', en: 'vegan option' },
    'острое': { ru: 'острое', kk: 'өткір', en: 'spicy' },
    'хит продаж': { ru: 'хит продаж', kk: 'бестселлер', en: 'bestseller' },
    'новинка': { ru: 'новинка', kk: 'жаңа', en: 'new' },
    'без глютена': { ru: 'без глютена', kk: 'глютенсіз', en: 'gluten-free' },
  };

  function getLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (LANGS.includes(stored)) return stored;
    } catch {}
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (!LANGS.includes(lang)) return;
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('degirmen:langchange', { detail: { lang } }));
  }

  function t(key) {
    const lang = getLang();
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[lang] || entry[DEFAULT_LANG] || key;
  }

  function chatSuggestions() {
    const lang = getLang();
    return CHAT_SUGGESTIONS[lang] || CHAT_SUGGESTIONS[DEFAULT_LANG];
  }

  function trLabel(dict, key) {
    const lang = getLang();
    const entry = dict[key];
    if (!entry) return key; // unknown label (e.g. admin typed something new) — show as-is
    return entry[lang] || entry[DEFAULT_LANG] || key;
  }
  const trAllergen = (a) => trLabel(ALLERGEN_LABELS, a);
  const trTag = (tag) => trLabel(TAG_LABELS, tag);

  function trField(obj, baseField) {
    const lang = getLang();
    if (lang === 'ru') return obj[baseField] || '';
    const localized = obj[`${baseField}_${lang}`];
    return localized || obj[baseField] || '';
  }
  const trCategoryName = (cat) => trField(cat, 'name');
  const trDishName = (dish) => trField(dish, 'name');
  const trDishDescription = (dish) => trField(dish, 'description');

  // Apply translations to any static [data-i18n] / [data-i18n-placeholder] elements.
  function applyStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.documentElement.lang = getLang();
  }

  function initLanguageSwitcher() {
    const buttons = document.querySelectorAll('.lang-switch [data-lang]');
    function refresh() {
      const current = getLang();
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.lang === current));
    }
    buttons.forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.lang === getLang()) return;
        setLang(b.dataset.lang);
      });
    });
    window.addEventListener('degirmen:langchange', refresh);
    refresh();
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyStaticTranslations();
    initLanguageSwitcher();
  });
  window.addEventListener('degirmen:langchange', applyStaticTranslations);

  window.I18N = {
    getLang, setLang, t, chatSuggestions,
    trAllergen, trTag, trCategoryName, trDishName, trDishDescription,
  };
})();
