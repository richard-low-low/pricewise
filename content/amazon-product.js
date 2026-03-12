// PriceWise - Amazon Product Page Controller

(async function PriceWiseMain() {
  'use strict';

  let _pw_currentASIN = null;
  let _pw_shadow = null;

  // ---- Debug Panel (DOM-based, readable by Claude in Chrome) ----
  function _pw_debug(msg) {
    console.log(`[PriceWise] ${msg}`);
    if (!PW_DEBUG) return;
    let el = document.getElementById('pricewise-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pricewise-debug';
      el.style.cssText =
        'position:fixed;bottom:0;right:0;z-index:99999;max-width:380px;' +
        'background:#1a1a2e;color:#0f0;font:11px/1.4 monospace;padding:6px 8px;' +
        'border-radius:6px 0 0 0;opacity:0.85;pointer-events:none;' +
        'white-space:pre-wrap;max-height:200px;overflow:auto;';
      document.body.appendChild(el);
    }
    const time = new Date().toLocaleTimeString('en', { hour12: false });
    el.textContent = (el.textContent ? el.textContent + '\n' : '') + `[${time}] ${msg}`;
    const lines = el.textContent.split('\n');
    if (lines.length > 15) el.textContent = lines.slice(-15).join('\n');
  }

  // Listen for background debug messages via storage
  chrome.storage.onChanged.addListener((changes) => {
    if (changes['_pw_bgDebug']) {
      const val = changes['_pw_bgDebug'].newValue;
      if (val) _pw_debug(`BG: ${val}`);
    }
  });

  /**
   * Main initialization: extract data, save history, render panel.
   */
  async function init() {
    _pw_debug('init() started');
    const productData = extractProductData();
    if (!productData) {
      _pw_debug('No product data found (no ASIN or no price)');
      return;
    }
    _pw_debug(`ASIN=${productData.asin} price=${productData.currencySymbol}${productData.price}`);

    // Skip if already initialized for this ASIN
    if (_pw_currentASIN === productData.asin) return;
    _pw_currentASIN = productData.asin;

    // Remove previous panel if navigating between products
    const existingHost = document.getElementById('pricewise-panel-host');
    if (existingHost) {
      existingHost.remove();
      _pw_shadow = null;
    }

    // Save current price to history
    const history = await savePriceHistory(productData);
    _pw_debug(`History saved, ${history.prices.length} entries`);

    // Find injection point
    const container = findInjectionPoint();
    if (!container) {
      _pw_debug('No injection point found');
      return;
    }
    _pw_debug(`Injection point: ${container.id || container.className}`);

    // Create panel
    _pw_shadow = createPricePanel(container);
    _pw_debug('Panel created');

    // Load alert for this product
    const alert = await getAlert(productData.asin);

    // Render chart with history
    updatePricePanel(_pw_shadow, history, alert);
    _pw_debug('Chart rendered' + (alert ? ` (alert: ${productData.currencySymbol}${alert.targetPrice})` : ''));

    // Wire up alert button
    setupAlertButton(productData);

    // Notify service worker
    notifyServiceWorker(productData);
    _pw_debug('Init complete');
  }

  /**
   * Find the best DOM element to inject the panel after.
   */
  function findInjectionPoint() {
    const selectors = [
      '#corePriceDisplay_desktop_feature_div',
      '#corePrice_feature_div',
      '#price_inside_buybox',
      '#priceblock_ourprice_row',
      '#unifiedPrice_feature_div',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Set up the "Set Alert" button click handler.
   */
  function setupAlertButton(productData) {
    if (!_pw_shadow) return;

    const btn = _pw_shadow.getElementById('pw-alert-btn');
    const input = _pw_shadow.getElementById('pw-alert-input');
    const status = _pw_shadow.getElementById('pw-alert-status');

    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      const targetPrice = parseFloat(input.value);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        if (status) {
          status.textContent = 'Please enter a valid price';
          status.style.color = PW_COLORS.alert;
        }
        return;
      }

      await saveAlert(productData.asin, targetPrice);

      if (status) {
        const sym = productData.currencySymbol || '$';
        status.textContent = `Alert set at ${sym}${targetPrice.toFixed(2)}`;
        status.style.color = PW_COLORS.success;
      }

      // Re-render chart with alert line
      const history = await getPriceHistory(productData.asin);
      const alert = await getAlert(productData.asin);
      if (history) {
        updatePricePanel(_pw_shadow, history, alert);
      }

      // Notify service worker about the new alert
      chrome.runtime.sendMessage({
        type: 'ALERT_SET',
        asin: productData.asin,
        targetPrice: targetPrice,
        currentPrice: productData.price,
      });
    });
  }

  /**
   * Notify the service worker about the current product visit.
   * The service worker can check if any alert should fire.
   */
  function notifyServiceWorker(productData) {
    chrome.runtime.sendMessage({
      type: 'PRODUCT_VISITED',
      asin: productData.asin,
      price: productData.price,
      title: productData.title,
      url: productData.url,
    });
  }

  /**
   * Handle SPA-style navigation on Amazon.
   * Amazon sometimes updates content without a full page reload.
   */
  function watchForNavigation() {
    let lastUrl = window.location.href;

    // Use MutationObserver to detect DOM changes that indicate navigation
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        _pw_currentASIN = null; // Reset so init() will run again
        // Delay to let Amazon finish rendering the new page
        setTimeout(() => init(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      _pw_currentASIN = null;
      setTimeout(() => init(), 1000);
    });
  }

  // ---- Entry point ----
  try {
    await init();
    watchForNavigation();
  } catch (err) {
    console.error('[PriceWise] Error initializing:', err);
  }
})();
