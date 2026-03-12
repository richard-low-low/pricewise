// PriceWise Popup Script

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await renderProductList();
}

async function renderProductList() {
  const [products, alerts] = await Promise.all([
    getAllTrackedProducts(),
    getAllAlerts(),
  ]);

  const listEl = document.getElementById('productList');
  const emptyEl = document.getElementById('emptyState');
  const countEl = document.getElementById('productCount');

  // Update badge count
  countEl.textContent = products.length;

  // Toggle empty state
  if (products.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = '';
    return;
  }

  listEl.style.display = '';
  emptyEl.style.display = 'none';

  // Build product cards
  listEl.innerHTML = products.map(product => {
    const alert = alerts[product.asin];
    const symbol = product.currencySymbol || '$';
    const currentPriceText = product.currentPrice != null
      ? symbol + product.currentPrice.toFixed(2)
      : 'N/A';
    const lowestPriceText = product.lowestPrice != null
      ? 'Low: ' + symbol + product.lowestPrice.toFixed(2)
      : '';

    let alertHtml = '';
    if (alert) {
      alertHtml = `
        <div class="pw-card-alert">
          <span class="pw-alert-text">Alert: ${symbol}${alert.targetPrice.toFixed(2)}</span>
          <button class="pw-btn-remove-alert" data-asin="${product.asin}" data-action="remove-alert" title="Remove alert">&times;</button>
        </div>`;
    }

    let lowestTag = '';
    if (product.isAtLowest && product.priceCount > 1) {
      lowestTag = '<span class="pw-tag-lowest">Lowest!</span>';
    }

    return `
      <div class="pw-card" data-asin="${product.asin}" data-url="${escapeAttr(product.url || '')}">
        <img class="pw-card-img" src="${escapeAttr(product.image || '')}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="pw-card-info">
          <div class="pw-card-title">${escapeHtml(product.title || 'Untitled')}</div>
          <div class="pw-card-prices">
            <span class="pw-price-current">${currentPriceText}</span>
            <span class="pw-price-lowest">${lowestPriceText}</span>
            ${lowestTag}
          </div>
          ${alertHtml}
        </div>
        <div class="pw-card-actions">
          <button class="pw-btn-delete" data-asin="${product.asin}" data-action="delete" title="Stop tracking">&times;</button>
        </div>
      </div>`;
  }).join('');
}

// Event delegation for clicks
document.getElementById('productList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');

  if (btn) {
    e.stopPropagation();
    const asin = btn.dataset.asin;
    const action = btn.dataset.action;

    if (action === 'delete') {
      await deleteTrackedProduct(asin);
      await renderProductList();
    } else if (action === 'remove-alert') {
      await removeAlert(asin);
      await renderProductList();
    }
    return;
  }

  // Click on card -> open product page
  const card = e.target.closest('.pw-card');
  if (card && card.dataset.url) {
    chrome.tabs.create({ url: card.dataset.url });
  }
});

// Refresh Prices button
document.getElementById('refreshPrices').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.disabled = true;
  btn.textContent = 'Checking...';

  chrome.runtime.sendMessage({ type: 'FETCH_ALL_PRICES' }, () => {
    btn.textContent = 'Done!';
    setTimeout(async () => {
      btn.disabled = false;
      btn.textContent = 'Refresh Prices';
      await renderProductList();
    }, 2000);
  });
});

// Helpers
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
