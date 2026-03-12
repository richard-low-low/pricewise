// PriceWise - Service Worker (MV3)
// Self-contained: no imports allowed in service workers

const PW_HISTORY_PREFIX = 'pw_history_';
const PW_ALERTS_KEY = 'pw_alerts';
const PW_CHECK_INTERVAL = 60; // minutes
const ALARM_NAME = 'price-check';

// Debug helper: writes to storage so content script can display in DOM panel
async function _pw_bgDebug(msg) {
  console.log(`[PriceWise:BG] ${msg}`);
  try {
    await chrome.storage.local.set({
      _pw_bgDebug: `${new Date().toLocaleTimeString('en', { hour12: false })} ${msg}`
    });
  } catch { /* ignore */ }
}

// ─── Installation & Startup ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[PriceWise] Extension installed');
  setupAlarm();
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[PriceWise] Extension started');
  setupAlarm();
  updateBadge();
});

function setupAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: PW_CHECK_INTERVAL,
  });
  console.log(`[PriceWise] Alarm set: every ${PW_CHECK_INTERVAL} minutes`);
}

// ─── Alarm Handler ──────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log('[PriceWise] Running scheduled price check');
  await checkAllAlerts();
});

async function checkAllAlerts() {
  const alertsResult = await chrome.storage.local.get(PW_ALERTS_KEY);
  const alerts = alertsResult[PW_ALERTS_KEY] || {};
  const asins = Object.keys(alerts);

  if (asins.length === 0) {
    console.log('[PriceWise] No alerts configured');
    return;
  }

  // Fetch history for all products with alerts
  const historyKeys = asins.map((asin) => PW_HISTORY_PREFIX + asin);
  const historyResult = await chrome.storage.local.get(historyKeys);

  for (const asin of asins) {
    const alert = alerts[asin];
    const history = historyResult[PW_HISTORY_PREFIX + asin];

    if (!history || !history.prices || history.prices.length === 0) continue;

    const latestPrice = history.prices[history.prices.length - 1].price;

    if (latestPrice <= alert.targetPrice) {
      const product = history.product || {};
      const title = product.title || `Product ${asin}`;
      const symbol = product.currencySymbol || '$';

      sendPriceAlert(asin, title, latestPrice, alert.targetPrice, symbol, product.url);
    }
  }
}

function sendPriceAlert(asin, title, currentPrice, targetPrice, symbol, url) {
  const notificationId = `pw_alert_${asin}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Price Drop Alert!',
    message: `${title}\nNow: ${symbol}${currentPrice.toFixed(2)} (Target: ${symbol}${targetPrice.toFixed(2)})`,
    priority: 2,
  });

  console.log(`[PriceWise] Alert triggered for ${asin}: ${symbol}${currentPrice} <= ${symbol}${targetPrice}`);
}

// ─── Notification Click ─────────────────────────────────────────────

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith('pw_alert_')) return;

  const asin = notificationId.replace('pw_alert_', '');
  const historyResult = await chrome.storage.local.get(PW_HISTORY_PREFIX + asin);
  const history = historyResult[PW_HISTORY_PREFIX + asin];

  let url = `https://www.amazon.com/dp/${asin}`;
  if (history && history.product && history.product.url) {
    url = history.product.url;
  }

  chrome.tabs.create({ url });
  chrome.notifications.clear(notificationId);
});

// ─── Message Handler ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_ALERT') {
    handleCheckAlert(message.asin).then(sendResponse);
    return true; // async response
  }

  if (message.type === 'GET_PRODUCT_COUNT') {
    getProductCount().then((count) => sendResponse({ count }));
    return true;
  }
});

async function handleCheckAlert(asin) {
  if (!asin) return { triggered: false };

  const alertsResult = await chrome.storage.local.get(PW_ALERTS_KEY);
  const alerts = alertsResult[PW_ALERTS_KEY] || {};
  const alert = alerts[asin];

  if (!alert) return { triggered: false };

  const historyResult = await chrome.storage.local.get(PW_HISTORY_PREFIX + asin);
  const history = historyResult[PW_HISTORY_PREFIX + asin];

  if (!history || !history.prices || history.prices.length === 0) {
    return { triggered: false };
  }

  const latestPrice = history.prices[history.prices.length - 1].price;

  if (latestPrice <= alert.targetPrice) {
    const product = history.product || {};
    const symbol = product.currencySymbol || '$';
    sendPriceAlert(asin, product.title || asin, latestPrice, alert.targetPrice, symbol, product.url);
    return { triggered: true, currentPrice: latestPrice, targetPrice: alert.targetPrice };
  }

  return { triggered: false, currentPrice: latestPrice, targetPrice: alert.targetPrice };
}

// ─── Badge ──────────────────────────────────────────────────────────

async function getProductCount() {
  const all = await chrome.storage.local.get(null);
  let count = 0;
  for (const key of Object.keys(all)) {
    if (key.startsWith(PW_HISTORY_PREFIX) && all[key].product) {
      count++;
    }
  }
  return count;
}

async function updateBadge() {
  const count = await getProductCount();
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

// Update badge when storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  // Check if any tracked product keys changed
  const relevantChange = Object.keys(changes).some(
    (key) => key.startsWith(PW_HISTORY_PREFIX) || key === PW_ALERTS_KEY
  );

  if (relevantChange) {
    updateBadge();
  }
});
