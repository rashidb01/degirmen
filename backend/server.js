require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 4100;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DISHES_FILE = path.join(DATA_DIR, 'dishes.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
for (const [file, def] of [[DISHES_FILE, '[]'], [CATEGORIES_FILE, '[]'], [ORDERS_FILE, '[]']]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, def);
}

// ─── tiny JSON "database" helpers (file-backed, no external DB needed) ────────
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Failed to read ${file}:`, e.message);
    return [];
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : {}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.static(PUBLIC_DIR));

// ─── image upload (dish photos) ────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 8) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

// ─── admin auth ─────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── health ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── public menu ────────────────────────────────────────────────────────────
app.get('/api/menu', (req, res) => {
  const categories = readJSON(CATEGORIES_FILE).sort((a, b) => (a.order || 0) - (b.order || 0));
  const dishes = readJSON(DISHES_FILE);
  res.json({ categories, dishes });
});

app.get('/api/dishes/:id', (req, res) => {
  const dish = readJSON(DISHES_FILE).find((d) => d.id === req.params.id);
  if (!dish) return res.status(404).json({ error: 'Not found' });
  res.json(dish);
});

// ─── admin: categories ──────────────────────────────────────────────────────
app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, order } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  const categories = readJSON(CATEGORIES_FILE);
  const id = String(name).trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/(^-|-$)/g, '') || uuidv4();
  const category = { id: categories.some((c) => c.id === id) ? `${id}-${uuidv4().slice(0, 4)}` : id, name: String(name).trim(), order: order ?? categories.length + 1 };
  categories.push(category);
  writeJSON(CATEGORIES_FILE, categories);
  res.status(201).json(category);
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const categories = readJSON(CATEGORIES_FILE);
  const idx = categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  categories[idx] = { ...categories[idx], ...req.body, id: categories[idx].id };
  writeJSON(CATEGORIES_FILE, categories);
  res.json(categories[idx]);
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const categories = readJSON(CATEGORIES_FILE);
  const next = categories.filter((c) => c.id !== req.params.id);
  writeJSON(CATEGORIES_FILE, next);
  res.json({ ok: true });
});

// ─── admin: dishes ──────────────────────────────────────────────────────────
app.post('/api/admin/dishes', requireAdmin, (req, res) => {
  const { name, description, price, categoryId, image, allergens, tags, available } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (price == null || isNaN(Number(price))) return res.status(400).json({ error: 'price must be a number' });
  const dishes = readJSON(DISHES_FILE);
  const dish = {
    id: `d-${uuidv4()}`,
    categoryId: categoryId || null,
    name: String(name).trim(),
    description: description || '',
    price: Number(price),
    image: image || '',
    allergens: Array.isArray(allergens) ? allergens : [],
    tags: Array.isArray(tags) ? tags : [],
    available: available !== false,
  };
  dishes.push(dish);
  writeJSON(DISHES_FILE, dishes);
  res.status(201).json(dish);
});

app.put('/api/admin/dishes/:id', requireAdmin, (req, res) => {
  const dishes = readJSON(DISHES_FILE);
  const idx = dishes.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const patch = { ...req.body };
  if (patch.price != null) patch.price = Number(patch.price);
  dishes[idx] = { ...dishes[idx], ...patch, id: dishes[idx].id };
  writeJSON(DISHES_FILE, dishes);
  res.json(dishes[idx]);
});

app.delete('/api/admin/dishes/:id', requireAdmin, (req, res) => {
  const dishes = readJSON(DISHES_FILE);
  const next = dishes.filter((d) => d.id !== req.params.id);
  writeJSON(DISHES_FILE, next);
  res.json({ ok: true });
});

app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// ─── orders ─────────────────────────────────────────────────────────────────
// NOTE integration points for later:
//   - sendOrderToRKeeper(order)  -> push order into R-Keeper POS once credentials/API are available
//   - Kaspi Pay: today orders are "pay at the table"; a Kaspi Pay checkout link/QR can be
//     generated here and its status polled/webhooked once the merchant is registered with Kaspi.
function sendOrderToRKeeper(order) {
  // TODO: R-Keeper integration. Requires restaurant's R-Keeper StationAPI/RK7 credentials.
  // Left as a no-op stub so wiring it up later doesn't require touching the order flow.
}

app.post('/api/orders', (req, res) => {
  const { items, tableNumber, customerName, phone, comment } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }
  const dishes = readJSON(DISHES_FILE);
  const dishById = new Map(dishes.map((d) => [d.id, d]));

  const lineItems = [];
  for (const it of items) {
    const dish = dishById.get(it.dishId);
    if (!dish) return res.status(400).json({ error: `Unknown dish: ${it.dishId}` });
    const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
    lineItems.push({
      dishId: dish.id,
      name: dish.name,
      price: dish.price,
      qty,
      subtotal: dish.price * qty,
    });
  }
  const total = lineItems.reduce((sum, li) => sum + li.subtotal, 0);

  const order = {
    id: uuidv4().slice(0, 8),
    createdAt: new Date().toISOString(),
    status: 'new', // new -> confirmed -> preparing -> ready -> served / cancelled
    items: lineItems,
    total,
    tableNumber: tableNumber || null,
    customerName: customerName || null,
    phone: phone || null,
    comment: comment || '',
    payment: { method: 'pay_at_table', status: 'unpaid' }, // Kaspi Pay hooks in later here
  };

  const orders = readJSON(ORDERS_FILE);
  orders.push(order);
  writeJSON(ORDERS_FILE, orders);

  sendOrderToRKeeper(order);

  res.status(201).json(order);
});

app.get('/api/orders/:id', (req, res) => {
  const order = readJSON(ORDERS_FILE).find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_FILE).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body || {};
  const allowed = ['new', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status) orders[idx].status = status;
  writeJSON(ORDERS_FILE, orders);
  res.json(orders[idx]);
});

// ─── AI chat assistant ──────────────────────────────────────────────────────
// The assistant is grounded in the live menu (name/description/price/allergens/tags)
// so it can answer allergen questions and suggest a substitute dish from the real menu.
function buildMenuContext() {
  const categories = readJSON(CATEGORIES_FILE);
  const dishes = readJSON(DISHES_FILE);
  const catName = (id) => categories.find((c) => c.id === id)?.name || id;
  const lines = dishes
    .filter((d) => d.available !== false)
    .map((d) => {
      const allergens = d.allergens?.length ? `аллергены: ${d.allergens.join(', ')}` : 'аллергены: нет данных';
      const tags = d.tags?.length ? `; теги: ${d.tags.join(', ')}` : '';
      return `- [${d.id}] "${d.name}" (${catName(d.categoryId)}), ${d.price} тг. ${d.description || ''} ${allergens}${tags}`;
    });
  return lines.join('\n');
}

const CHAT_SYSTEM_PROMPT = (menuContext) => `Ты — дружелюбный AI-помощник ресторана "Degirmen" на сайте с электронным меню.
Отвечай кратко, по-человечески, на языке пользователя (обычно русский).

Твои задачи:
1. Отвечать на вопросы про блюда: состав, аллергены, острота, калорийность (если известно), время готовки.
2. Если у гостя аллергия или непереносимость — четко предупреждать, какие блюда из меню ему НЕ подходят, и предлагать 1-3 конкретные альтернативы из меню, которые подходят.
3. Помогать с выбором и предлагать блюда под настроение/бюджет/повод.
4. Если просят замену блюду (не понравилось, нет в наличии, аллергия) — предлагай похожее блюдо из этого же меню (по категории/составу/цене).
5. Никогда не выдумывай блюда, цены или аллергены, которых нет в списке ниже — используй только реальные данные меню.
6. Если вопрос не про еду/ресторан — вежливо верни разговор к меню.
7. Не используй markdown-разметку (никаких **, #, нумерованных/маркированных списков) — только обычный текст, при необходимости с переносами строк.

Актуальное меню (используй только это):
${menuContext}

Отвечай коротко (2-5 предложений), можно использовать эмодзи по одному, простым текстом без markdown.`;

app.post('/api/chat', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: 'AI chat is not configured (missing GROQ_API_KEY on the server)' });
  }
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  const safeMessages = messages
    .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
    .slice(-20);

  try {
    const menuContext = buildMenuContext();
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT(menuContext) }, ...safeMessages],
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => '');
      console.error('Groq API error:', groqRes.status, text);
      return res.status(502).json({ error: 'AI provider error' });
    }
    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Извините, не получилось сформировать ответ. Попробуйте ещё раз.';
    res.json({ reply });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Degirmen backend running on http://localhost:${PORT}`);
  if (!GROQ_API_KEY) console.warn('  ! GROQ_API_KEY not set — /api/chat will be disabled');
  if (!ADMIN_KEY) console.warn('  ! ADMIN_KEY not set — admin routes will reject all requests');
});
