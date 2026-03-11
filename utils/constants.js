// PriceWise Constants

const PW_STORAGE_PREFIX = 'pw_';
const PW_HISTORY_PREFIX = 'pw_history_';
const PW_ALERTS_KEY = 'pw_alerts';
const PW_SETTINGS_KEY = 'pw_settings';

// Price check interval (minutes)
const PW_CHECK_INTERVAL = 60;

// Max history entries per product (1 per day for 2 years)
const PW_MAX_HISTORY = 730;

// Chart colors
const PW_COLORS = {
  primary: '#2563eb',       // Blue - Amazon price line
  primaryBg: 'rgba(37, 99, 235, 0.1)',
  alert: '#ef4444',         // Red - alert line
  success: '#22c55e',       // Green - lowest price
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  background: '#ffffff',
};

// Amazon domain to locale mapping
const PW_AMAZON_DOMAINS = {
  'amazon.com': { locale: 'US', currency: 'USD', symbol: '$' },
  'amazon.co.uk': { locale: 'UK', currency: 'GBP', symbol: '£' },
  'amazon.de': { locale: 'DE', currency: 'EUR', symbol: '€' },
  'amazon.fr': { locale: 'FR', currency: 'EUR', symbol: '€' },
  'amazon.it': { locale: 'IT', currency: 'EUR', symbol: '€' },
  'amazon.es': { locale: 'ES', currency: 'EUR', symbol: '€' },
  'amazon.co.jp': { locale: 'JP', currency: 'JPY', symbol: '¥' },
  'amazon.ca': { locale: 'CA', currency: 'CAD', symbol: 'CA$' },
  'amazon.com.au': { locale: 'AU', currency: 'AUD', symbol: 'A$' },
};
