/**
 * Unified API gateway for every supported chain.
 * Chain routing is selected by the X-Chain-Id request header.
 */
export const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:9900'
  : 'https://bsc-api.tagai.fun';
