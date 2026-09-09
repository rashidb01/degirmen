(() => {
  const API = '';
  const panel = document.getElementById('chatPanel');
  const toggleBtn = document.getElementById('chatToggle');
  const closeBtn = document.getElementById('chatCloseBtn');
  const messagesEl = document.getElementById('chatMessages');
  const suggestionsEl = document.getElementById('chatSuggestions');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const notice = document.getElementById('chatNotice');

  const SUGGESTIONS = [
    'Что вы посоветуете?',
    'Есть блюда без глютена?',
    'У меня аллергия на орехи',
    'Предложите замену блюду',
  ];

  let history = []; // { role: 'user' | 'assistant', content }
  let opened = false;
  let sending = false;

  function open() {
    panel.classList.add('open');
    opened = true;
    if (history.length === 0) greet();
    input.focus();
    window.Degirmen?.cancelIdleNudge();
  }
  function close() { panel.classList.remove('open'); }
  toggleBtn.addEventListener('click', () => (panel.classList.contains('open') ? close() : open()));
  closeBtn.addEventListener('click', close);

  function greet() {
    addMessage('assistant', 'Привет! 👋 Я помощник Degirmen. Спросите про состав, аллергены или попросите что-то посоветовать — с удовольствием помогу выбрать блюдо.');
    renderSuggestions();
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    SUGGESTIONS.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'chip-btn';
      b.type = 'button';
      b.textContent = s;
      b.addEventListener('click', () => sendMessage(s));
      suggestionsEl.appendChild(b);
    });
  }

  function addMessage(role, content) {
    const el = document.createElement('div');
    el.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
    el.textContent = content;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'msg bot typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  async function sendMessage(text) {
    if (!text || sending) return;
    sending = true;
    suggestionsEl.innerHTML = '';
    notice.textContent = '';
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    input.value = '';
    const typingEl = addTyping();

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      typingEl.remove();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          notice.textContent = 'AI-помощник временно недоступен (не настроен ключ).';
        } else {
          addMessage('assistant', 'Извините, что-то пошло не так. Попробуйте ещё раз чуть позже.');
        }
        console.error('chat error', data);
      } else {
        const data = await res.json();
        addMessage('assistant', data.reply);
        history.push({ role: 'assistant', content: data.reply });
      }
    } catch (e) {
      typingEl.remove();
      addMessage('assistant', 'Не получилось связаться с сервером. Проверьте соединение и попробуйте снова.');
      console.error(e);
    } finally {
      sending = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value.trim());
  });

  // Called from app.js when the user taps "Спросить AI про это блюдо" on a dish.
  function askAbout(dish) {
    open();
    sendMessage(`Расскажи подробнее про блюдо "${dish.name}": состав, аллергены, и если есть аллергия — что взять взамен из меню?`);
  }

  // Called from the idle "помочь с выбором?" nudge: opens the chat and walks
  // the guest through a couple of quick questions instead of a blank input.
  function startGuidedPick() {
    open();
    addMessage('assistant', 'Конечно! Что вам хочется — выберите категорию, и я подберу пару вариантов 👇');
    renderCategoryPicker();
  }

  function renderCategoryPicker() {
    const categories = window.Degirmen?.getMenuContext()?.categories || [];
    suggestionsEl.innerHTML = '';
    categories.forEach((cat) => {
      const b = document.createElement('button');
      b.className = 'chip-btn';
      b.type = 'button';
      b.textContent = cat.name;
      b.addEventListener('click', () => sendMessage(`Хочу что-нибудь из категории "${cat.name}", посоветуй пару блюд и почему.`));
      suggestionsEl.appendChild(b);
    });
    const surprise = document.createElement('button');
    surprise.className = 'chip-btn';
    surprise.type = 'button';
    surprise.textContent = 'Удивите меня 🎲';
    surprise.addEventListener('click', () => sendMessage('Не знаю, что выбрать — удивите, посоветуйте что-нибудь популярное.'));
    suggestionsEl.appendChild(surprise);
  }

  window.DegirmenChat = { open, close, askAbout, startGuidedPick };
})();
