// PriceWise - Amazon DOM Price Parser

/**
 * Extract ASIN from current page URL or DOM
 */
function extractASIN() {
  // Try URL first: /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
  const urlMatch = window.location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  if (urlMatch) return urlMatch[1];

  // Fallback: hidden input
  const asinInput = document.getElementById('ASIN');
  if (asinInput) return asinInput.value;

  // Fallback: data attribute
  const asinEl = document.querySelector('[data-asin]');
  if (asinEl) return asinEl.getAttribute('data-asin');

  return null;
}

/**
 * Extract current price from Amazon product page
 * Returns price as float or null
 */
function extractPrice() {
  const selectors = [
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#price_inside_buybox',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim();
      const price = parsePrice(text);
      if (price !== null) return price;
    }
  }
  return null;
}

/**
 * Extract original/list price (strikethrough price)
 */
function extractOriginalPrice() {
  const selectors = [
    '.basisPrice .a-price .a-offscreen',
    '#priceblock_ourprice_row .priceBlockStrikePriceString',
    '.a-text-strike .a-offscreen',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const price = parsePrice(el.textContent.trim());
      if (price !== null) return price;
    }
  }
  return null;
}

/**
 * Extract product title
 */
function extractTitle() {
  const el = document.getElementById('productTitle');
  return el ? el.textContent.trim() : '';
}

/**
 * Extract product image URL
 */
function extractImage() {
  const el = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
  return el ? el.src : '';
}

/**
 * Extract rating (e.g., "4.7 out of 5 stars" -> 4.7)
 */
function extractRating() {
  const el = document.querySelector('#acrPopover');
  if (el) {
    const title = el.getAttribute('title') || '';
    const match = title.match(/([\d.]+)/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

/**
 * Extract review count
 */
function extractReviewCount() {
  const el = document.getElementById('acrCustomerReviewText');
  if (el) {
    const text = el.textContent.replace(/[^0-9]/g, '');
    return parseInt(text, 10) || 0;
  }
  return 0;
}

/**
 * Detect current Amazon domain info
 */
function detectAmazonDomain() {
  const hostname = window.location.hostname.replace('www.', '');
  return PW_AMAZON_DOMAINS[hostname] || PW_AMAZON_DOMAINS['amazon.com'];
}

/**
 * Parse price string to float
 * Handles: "$257.92", "£19.99", "€29,99", "¥2,580"
 */
function parsePrice(text) {
  if (!text) return null;
  // Remove currency symbols and whitespace
  let cleaned = text.replace(/[^0-9.,]/g, '').trim();
  if (!cleaned) return null;

  // Handle European format: 1.234,56 -> 1234.56
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // 1.234,56 format
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 format
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be 29,99 (decimal) or 2,580 (thousands)
    const parts = cleaned.split(',');
    if (parts[parts.length - 1].length === 2) {
      // 29,99 -> 29.99
      cleaned = cleaned.replace(',', '.');
    } else {
      // 2,580 -> 2580
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * Extract all product data from current page
 */
function extractProductData() {
  const asin = extractASIN();
  if (!asin) return null;

  const price = extractPrice();
  if (price === null) return null;

  const domain = detectAmazonDomain();

  return {
    asin,
    price,
    originalPrice: extractOriginalPrice(),
    title: extractTitle(),
    image: extractImage(),
    rating: extractRating(),
    reviewCount: extractReviewCount(),
    currency: domain.currency,
    currencySymbol: domain.symbol,
    locale: domain.locale,
    url: window.location.href,
    timestamp: Date.now(),
  };
}
