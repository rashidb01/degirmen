// ─── R-Keeper integration adapter ──────────────────────────────────────────
//
// R-Keeper doesn't have a public cloud API — access goes through StationAPI /
// RK7 XML-Server, a module enabled on the restaurant's own POS server by
// your R-Keeper reseller (UCS or their local partner). Until that's set up
// and we have real credentials + the XML/WSDL spec for this specific
// installation, everything here is a safe no-op with clear TODOs.
//
// What you need from the R-Keeper reseller before this can go live:
//   1. StationAPI / RK7 XML-Server enabled on the POS server (often a paid
//      add-on they have to switch on).
//   2. A reachable endpoint: either a local network address the restaurant
//      can whitelist/VPN to us, or their own cloud gateway if they have one.
//      If it's only reachable on the restaurant's LAN, we'll need a small
//      bridge agent running on-site that calls out to our backend instead
//      of us calling in.
//   3. Login/API key + the XML schema docs for menu export and order/sale
//      import — these vary a bit between R-Keeper installations.
//
// Once you have those, fill in RKEEPER_* in backend/.env and implement the
// two methods below against the real API. Nothing else in the app needs to
// change — server.js already calls these at the right points.

const RKEEPER_ENABLED = process.env.RKEEPER_ENABLED === 'true';
const RKEEPER_API_URL = process.env.RKEEPER_API_URL || '';
const RKEEPER_LOGIN = process.env.RKEEPER_LOGIN || '';
const RKEEPER_PASSWORD = process.env.RKEEPER_PASSWORD || '';

function isConfigured() {
  return RKEEPER_ENABLED && RKEEPER_API_URL && RKEEPER_LOGIN;
}

/**
 * Pull the current menu (categories + dishes/prices/availability) from
 * R-Keeper. Called on a timer by the menu-sync job (see startMenuSync below)
 * once RKEEPER_ENABLED=true.
 *
 * TODO: replace with a real call to the StationAPI/RK7 XML-Server menu
 * export endpoint for this installation, then map its category/dish shape
 * onto ours: { categories: [{id,name,order}], dishes: [{id,categoryId,name,
 * description,price,image,allergens,tags,available}] }.
 */
async function fetchMenuFromRKeeper() {
  if (!isConfigured()) return null;
  console.warn('[rkeeper] fetchMenuFromRKeeper() is not implemented yet — needs real StationAPI details.');
  return null;
}

/**
 * Push a placed website order into R-Keeper as a sale, so it shows up on
 * the same reports/kitchen flow as orders taken at the till.
 *
 * TODO: replace with a real call to the StationAPI/RK7 order-import
 * endpoint. `order` is the same object saved in backend/data/orders.json
 * (id, items[{name, price, qty}], total, tableNumber, comment, ...).
 */
async function pushOrderToRKeeper(order) {
  if (!isConfigured()) return { sent: false, reason: 'not_configured' };
  console.warn(`[rkeeper] pushOrderToRKeeper() is not implemented yet — order ${order.id} was NOT sent to R-Keeper.`);
  return { sent: false, reason: 'not_implemented' };
}

/**
 * Starts a periodic menu pull if RKEEPER_ENABLED=true. Safe to call always —
 * it's a no-op otherwise. `onMenu(menu)` is called with whatever
 * fetchMenuFromRKeeper() returns whenever it returns something non-null.
 */
function startMenuSync(onMenu, intervalMs = 10 * 60 * 1000) {
  if (!isConfigured()) return null;
  const tick = async () => {
    try {
      const menu = await fetchMenuFromRKeeper();
      if (menu) onMenu(menu);
    } catch (e) {
      console.error('[rkeeper] menu sync failed:', e.message);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { isConfigured, fetchMenuFromRKeeper, pushOrderToRKeeper, startMenuSync };
