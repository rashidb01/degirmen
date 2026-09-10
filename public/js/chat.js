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

  let history = []; // { role: 'user' | 'assistant', content }
  let opened = false;
  let sending = false;

  function open() {
    panel.classList.add('open');
    opened = true;
    if (history.length === 0) greet();
    // Don't auto-focus the input — that pops the on-screen keyboard up
    // immediately on mobile. Let the guest open it themselves by tapping
    // the field.
    window.Degirmen?.cancelIdleNudge();
  }
  function close() { panel.classList.remove('open'); }
  toggleBtn.addEventListener('click', () => (panel.classList.contains('open') ? close() : open()));
  closeBtn.addEventListener('click', close);

  function greet() {
    messagesEl.innerHTML = '';
    addMessage('assistant', window.I18N.t('chatGreeting'));
    renderSuggestions();
  }

  // If the guest switches language before typing anything, refresh the
  // greeting + suggestion chips into the new language too.
  window.addEventListener('degirmen:langchange', () => {
    if (opened && history.length === 0) greet();
  });

  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    window.I18N.chatSuggestions().forEach((s) => {
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
        body: JSON.stringify({ messages: history, lang: window.I18N.getLang() }),
      });
      typingEl.remove();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          notice.textContent = window.I18N.t('chatUnavailable');
        } else {
          addMessage('assistant', window.I18N.t('chatError'));
        }
        console.error('chat error', data);
      } else {
        const data = await res.json();
        addMessage('assistant', data.reply);
        history.push({ role: 'assistant', content: data.reply });
      }
    } catch (e) {
      typingEl.remove();
      addMessage('assistant', window.I18N.t('chatNetError'));
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
    const name = window.I18N.trDishName(dish);
    const prompts = {
      ru: `Расскажи подробнее про блюдо "${name}": состав, аллергены, и если есть аллергия — что взять взамен из меню?`,
      kk: `"${name}" тағамы туралы толығырақ айт: құрамы, аллергендер, және аллергия болса — мәзірден не алуға болады?`,
      en: `Tell me more about "${name}": ingredients, allergens, and if there's an allergy — what to get instead from the menu?`,
    };
    sendMessage(prompts[window.I18N.getLang()] || prompts.ru);
  }

  window.DegirmenChat = { open, close, askAbout };
})();
