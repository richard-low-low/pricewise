// PriceWise - Chrome Storage Wrapper

/**
 * Save a price data point to history
 * Deduplicates: only saves if price changed or >24h since last record
 */
async function savePriceHistory(productData) {
  const key = PW_HISTORY_PREFIX + productData.asin;
  const result = await chrome.storage.local.get(key);
  const history = result[key] || { product: null, prices: [] };

  // Update product metadata
  history.product = {
    asin: productData.asin,
    title: productData.title,
    image: productData.image,
    rating: productData.rating,
    reviewCount: productData.reviewCount,
    currency: productData.currency,
    currencySymbol: productData.currencySymbol,
    locale: productData.locale,
    url: productData.url,
    lastSeen: productData.timestamp,
  };

  const prices = history.prices;
  const lastEntry = prices[prices.length - 1];

  // Only add if price changed or >24h since last entry
  const shouldAdd = !lastEntry
    || lastEntry.price !== productData.price
    || (productData.timestamp - lastEntry.timestamp) > 24 * 60 * 60 * 1000;

  if (shouldAdd) {
    prices.push({
      price: productData.price,
      originalPrice: productData.originalPrice,
      timestamp: productData.timestamp,
    });

    // Keep history within limit
    if (prices.length > PW_MAX_HISTORY) {
      prices.splice(0, prices.length - PW_MAX_HISTORY);
    }
  }

  await chrome.storage.local.set({ [key]: history });
  return history;
}

/**
 * Get price history for a product
 */
async function getPriceHistory(asin) {
  const key = PW_HISTORY_PREFIX + asin;
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

/**
 * Get all tracked products (for popup)
 */
async function getAllTrackedProducts() {
  const all = await chrome.storage.local.get(null);
  const products = [];

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PW_HISTORY_PREFIX) && value.product) {
      const prices = value.prices || [];
      const currentPrice = prices.length > 0 ? prices[prices.length - 1].price : null;
      const lowestPrice = prices.length > 0 ? Math.min(...prices.map(p => p.price)) : null;
      const highestPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : null;

      products.push({
        ...value.product,
        currentPrice,
        lowestPrice,
        highestPrice,
        priceCount: prices.length,
        isAtLowest: currentPrice !== null && currentPrice <= lowestPrice,
      });
    }
  }

  // Sort by last seen (most recent first)
  products.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  return products;
}

/**
 * Delete a tracked product
 */
async function deleteTrackedProduct(asin) {
  const key = PW_HISTORY_PREFIX + asin;
  await chrome.storage.local.remove(key);
  // Also remove any alert
  await removeAlert(asin);
}

/**
 * Save a price alert
 */
async function saveAlert(asin, targetPrice) {
  const result = await chrome.storage.local.get(PW_ALERTS_KEY);
  const alerts = result[PW_ALERTS_KEY] || {};
  alerts[asin] = { targetPrice, createdAt: Date.now() };
  await chrome.storage.local.set({ [PW_ALERTS_KEY]: alerts });
}

/**
 * Remove a price alert
 */
async function removeAlert(asin) {
  const result = await chrome.storage.local.get(PW_ALERTS_KEY);
  const alerts = result[PW_ALERTS_KEY] || {};
  delete alerts[asin];
  await chrome.storage.local.set({ [PW_ALERTS_KEY]: alerts });
}

/**
 * Get all alerts
 */
async function getAllAlerts() {
  const result = await chrome.storage.local.get(PW_ALERTS_KEY);
  return result[PW_ALERTS_KEY] || {};
}

/**
 * Get alert for specific product
 */
async function getAlert(asin) {
  const alerts = await getAllAlerts();
  return alerts[asin] || null;
}
