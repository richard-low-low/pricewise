// PriceWise - Price History Chart Panel (Shadow DOM)

/**
 * Create and inject the price history panel into the page.
 * Uses Shadow DOM to isolate styles from Amazon's CSS.
 * @param {HTMLElement} container - The element to insert the panel after
 * @returns {ShadowRoot} The shadow root for later updates
 */
function createPricePanel(container) {
  // Avoid duplicate injection
  if (document.getElementById('pricewise-panel-host')) {
    return document.getElementById('pricewise-panel-host').shadowRoot;
  }

  const host = document.createElement('div');
  host.id = 'pricewise-panel-host';
  container.insertAdjacentElement('afterend', host);

  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>${_pw_panelStyles()}</style>
    <div class="pw-panel">
      <div class="pw-header">
        <span class="pw-title">PriceWise Price History</span>
        <div class="pw-range-buttons">
          <button class="pw-range-btn" data-range="1M">1M</button>
          <button class="pw-range-btn" data-range="3M">3M</button>
          <button class="pw-range-btn" data-range="6M">6M</button>
          <button class="pw-range-btn" data-range="1Y">1Y</button>
          <button class="pw-range-btn pw-range-active" data-range="ALL">ALL</button>
        </div>
      </div>
      <div class="pw-chart-container">
        <canvas id="pw-chart"></canvas>
      </div>
      <div class="pw-stats">
        <div class="pw-stat">
          <span class="pw-stat-label">Current</span>
          <span class="pw-stat-value" id="pw-stat-current">--</span>
        </div>
        <div class="pw-stat">
          <span class="pw-stat-label">Lowest</span>
          <span class="pw-stat-value pw-stat-lowest" id="pw-stat-lowest">--</span>
        </div>
        <div class="pw-stat">
          <span class="pw-stat-label">Highest</span>
          <span class="pw-stat-value pw-stat-highest" id="pw-stat-highest">--</span>
        </div>
        <div class="pw-stat">
          <span class="pw-stat-label">Average</span>
          <span class="pw-stat-value" id="pw-stat-avg">--</span>
        </div>
      </div>
      <div class="pw-badge-container" id="pw-badge-container" style="display:none;">
        <span class="pw-badge-lowest">Lowest Price!</span>
      </div>
      <div class="pw-alert-section">
        <label class="pw-alert-label">Price Alert:</label>
        <input type="number" class="pw-alert-input" id="pw-alert-input" placeholder="Target price" step="0.01" min="0">
        <button class="pw-alert-btn" id="pw-alert-btn">Set Alert</button>
        <span class="pw-alert-status" id="pw-alert-status"></span>
      </div>
    </div>
  `;

  // Wire up range buttons
  const rangeButtons = shadow.querySelectorAll('.pw-range-btn');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      rangeButtons.forEach(b => b.classList.remove('pw-range-active'));
      btn.classList.add('pw-range-active');
      const range = btn.getAttribute('data-range');
      _pw_applyRange(shadow, range);
    });
  });

  return shadow;
}

// ---- Internal state ----
let _pw_chartInstance = null;
let _pw_fullHistory = null;
let _pw_alertPrice = null;
let _pw_currencySymbol = '$';

/**
 * Update the price panel with history data and optional alert.
 * @param {ShadowRoot} shadow - The shadow root returned by createPricePanel
 * @param {{ product: Object, prices: Array<{price: number, timestamp: number}> }} history
 * @param {{ targetPrice: number }|null} alert - Current alert, if any
 */
function updatePricePanel(shadow, history, alert) {
  if (!shadow || !history || !history.prices || history.prices.length === 0) return;

  _pw_fullHistory = history;
  _pw_alertPrice = alert ? alert.targetPrice : null;
  _pw_currencySymbol = (history.product && history.product.currencySymbol) || '$';

  // Show existing alert in input
  if (alert && alert.targetPrice) {
    const input = shadow.getElementById('pw-alert-input');
    if (input) input.value = alert.targetPrice;
    const status = shadow.getElementById('pw-alert-status');
    if (status) {
      status.textContent = `Alert set at ${_pw_currencySymbol}${alert.targetPrice}`;
      status.style.color = PW_COLORS.alert;
    }
  }

  // Apply current range (default ALL)
  const activeBtn = shadow.querySelector('.pw-range-btn.pw-range-active');
  const range = activeBtn ? activeBtn.getAttribute('data-range') : 'ALL';
  _pw_applyRange(shadow, range);
}

/**
 * Filter history by range and render chart + stats.
 */
function _pw_applyRange(shadow, range) {
  if (!_pw_fullHistory || !_pw_fullHistory.prices) return;

  const now = Date.now();
  const rangeMs = {
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    'ALL': Infinity,
  };

  const cutoff = range === 'ALL' ? 0 : now - (rangeMs[range] || Infinity);
  const filtered = _pw_fullHistory.prices.filter(p => p.timestamp >= cutoff);

  // Use all prices if filter is empty (e.g., all data older than range)
  const prices = filtered.length > 0 ? filtered : _pw_fullHistory.prices;

  _pw_renderChart(shadow, prices);
  _pw_renderStats(shadow, prices);
}

/**
 * Render the Chart.js line chart.
 */
function _pw_renderChart(shadow, prices) {
  const canvas = shadow.getElementById('pw-chart');
  if (!canvas) return;

  // Destroy existing chart
  if (_pw_chartInstance) {
    _pw_chartInstance.destroy();
    _pw_chartInstance = null;
  }

  const labels = prices.map(p => {
    const d = new Date(p.timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });
  const data = prices.map(p => p.price);
  const sym = _pw_currencySymbol;

  const datasets = [
    {
      label: 'Price',
      data: data,
      borderColor: PW_COLORS.primary,
      backgroundColor: PW_COLORS.primaryBg,
      fill: true,
      tension: 0.3,
      pointRadius: prices.length > 60 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    },
  ];

  // Alert line plugin data
  const alertAnnotation = _pw_alertPrice != null ? _pw_alertPrice : null;

  _pw_chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(items) {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const d = new Date(prices[idx].timestamp);
              return d.toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              });
            },
            label: function(item) {
              return `${sym}${item.parsed.y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 8,
            font: { size: 11 },
            color: PW_COLORS.textSecondary,
          },
        },
        y: {
          grid: { color: PW_COLORS.border },
          ticks: {
            callback: function(value) { return sym + value; },
            font: { size: 11 },
            color: PW_COLORS.textSecondary,
          },
        },
      },
    },
    plugins: alertAnnotation != null ? [{
      id: 'alertLine',
      afterDraw(chart) {
        const yScale = chart.scales.y;
        const y = yScale.getPixelForValue(alertAnnotation);
        if (y < yScale.top || y > yScale.bottom) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = PW_COLORS.alert;
        ctx.lineWidth = 1.5;
        ctx.moveTo(chart.chartArea.left, y);
        ctx.lineTo(chart.chartArea.right, y);
        ctx.stroke();
        // Label
        ctx.fillStyle = PW_COLORS.alert;
        ctx.font = '10px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`Alert: ${sym}${alertAnnotation}`, chart.chartArea.right, y - 4);
        ctx.restore();
      },
    }] : [],
  });
}

/**
 * Render statistics below the chart.
 */
function _pw_renderStats(shadow, prices) {
  const data = prices.map(p => p.price);
  const current = data[data.length - 1];
  const lowest = Math.min(...data);
  const highest = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const sym = _pw_currencySymbol;

  const setVal = (id, text) => {
    const el = shadow.getElementById(id);
    if (el) el.textContent = text;
  };

  setVal('pw-stat-current', `${sym}${current.toFixed(2)}`);
  setVal('pw-stat-lowest', `${sym}${lowest.toFixed(2)}`);
  setVal('pw-stat-highest', `${sym}${highest.toFixed(2)}`);
  setVal('pw-stat-avg', `${sym}${avg.toFixed(2)}`);

  // Lowest price badge
  const badgeContainer = shadow.getElementById('pw-badge-container');
  if (badgeContainer) {
    badgeContainer.style.display = current <= lowest ? 'block' : 'none';
  }
}

/**
 * Return panel CSS as a string.
 */
function _pw_panelStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .pw-panel {
      font-family: system-ui, -apple-system, sans-serif;
      background: ${PW_COLORS.background};
      border: 1px solid ${PW_COLORS.border};
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      padding: 16px;
      margin: 12px 0;
      width: 100%;
    }

    .pw-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .pw-title {
      font-size: 14px;
      font-weight: 600;
      color: ${PW_COLORS.text};
    }

    .pw-range-buttons {
      display: flex;
      gap: 4px;
    }

    .pw-range-btn {
      background: transparent;
      border: 1px solid ${PW_COLORS.border};
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      color: ${PW_COLORS.textSecondary};
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
      transition: all 0.15s;
    }

    .pw-range-btn:hover {
      border-color: ${PW_COLORS.primary};
      color: ${PW_COLORS.primary};
    }

    .pw-range-btn.pw-range-active {
      background: ${PW_COLORS.primary};
      border-color: ${PW_COLORS.primary};
      color: #fff;
    }

    .pw-chart-container {
      width: 100%;
      height: 200px;
      position: relative;
    }

    .pw-chart-container canvas {
      width: 100% !important;
      height: 100% !important;
    }

    .pw-stats {
      display: flex;
      justify-content: space-around;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid ${PW_COLORS.border};
    }

    .pw-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .pw-stat-label {
      font-size: 11px;
      color: ${PW_COLORS.textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .pw-stat-value {
      font-size: 14px;
      font-weight: 600;
      color: ${PW_COLORS.text};
    }

    .pw-stat-lowest {
      color: ${PW_COLORS.success};
    }

    .pw-stat-highest {
      color: ${PW_COLORS.alert};
    }

    .pw-badge-container {
      text-align: center;
      margin-top: 8px;
    }

    .pw-badge-lowest {
      display: inline-block;
      background: ${PW_COLORS.success};
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 12px;
    }

    .pw-alert-section {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid ${PW_COLORS.border};
      flex-wrap: wrap;
    }

    .pw-alert-label {
      font-size: 13px;
      font-weight: 500;
      color: ${PW_COLORS.text};
      white-space: nowrap;
    }

    .pw-alert-input {
      border: 1px solid ${PW_COLORS.border};
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 13px;
      width: 120px;
      outline: none;
      font-family: system-ui, -apple-system, sans-serif;
      color: ${PW_COLORS.text};
    }

    .pw-alert-input:focus {
      border-color: ${PW_COLORS.primary};
      box-shadow: 0 0 0 2px ${PW_COLORS.primaryBg};
    }

    .pw-alert-btn {
      background: ${PW_COLORS.primary};
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
      transition: background 0.15s;
      white-space: nowrap;
    }

    .pw-alert-btn:hover {
      background: #1d4ed8;
    }

    .pw-alert-status {
      font-size: 12px;
      color: ${PW_COLORS.textSecondary};
    }
  `;
}
