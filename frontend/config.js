// Relative API endpoint in production on Vercel, localhost:5000 for local standalone dev.
const isLocalStandalone = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  (window.location.port === '3001' || window.location.port === '3002');

const apiBaseUrl = isLocalStandalone ? 'http://localhost:5000/api' : '/api';
window.RKR_CONFIG = Object.freeze({ apiBaseUrl });
