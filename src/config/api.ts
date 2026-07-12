/**
 * Unified API gateway for every supported chain.
 * Chain routing is selected by the X-Chain-Id request header.
 */
console.log(53, import.meta.env.DEV);
export const API_BASE_URL = import.meta.env.DEV
  ? 'https://bsc-api.tagai.fun'
  : 'https://bsc-api.tagai.fun';
