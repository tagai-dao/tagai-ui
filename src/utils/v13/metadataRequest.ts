// Retry only read-only metadata discovery. Never retry a transaction submission.
export async function requestMetadata(
  request: () => Promise<any>, signal: AbortSignal,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 750)),
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new Error('V13_QUOTE_CANCELLED')
    try {
      const result = await request()
      if (signal.aborted) throw new Error('V13_QUOTE_CANCELLED')
      if (result?.c !== 0 && ['V13_BUSY', 'V13_METADATA_UNAVAILABLE'].includes(result?.d?.code ?? result?.code ?? result?.m)) {
        throw { status: 503 }
      }
      return result
    } catch (error: any) {
      if (signal.aborted) throw new Error('V13_QUOTE_CANCELLED')
      // Background cache preparation is not a transport failure; honor its retry hint in the UI.
      if ((error?.data?.error ?? error?.response?.data?.error) === 'V13_METADATA_PREPARING') throw error
      const status = Number(error?.status ?? error?.response?.status)
      if (attempt === 2 || !(status === 408 || status === 429 || status >= 500 || error?.code === 'ECONNABORTED')) throw error
      await pause()
    }
  }
}
