/**
 * Unified API gateway for every supported chain.
 * Chain routing is selected by the X-Chain-Id request header.
 */
const configuredApiUrl = (import.meta.env.VITE_APP_BACKEND_API_URL as string | undefined)?.trim()

export const API_BASE_URL = (configuredApiUrl || 'https://bsc-api.tagai.fun').replace(/\/$/, '')
