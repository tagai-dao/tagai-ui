export class SubmittedTransactionError extends Error {
    transactionHash: `0x${string}`
    originalError: unknown

    constructor(transactionHash: `0x${string}`, cause: unknown) {
        super(`Transaction submitted; confirmation is pending. Do not submit it again. Check transaction: ${transactionHash}`)
        this.name = 'SubmittedTransactionError'
        this.transactionHash = transactionHash
        this.originalError = cause
    }
}

/** Read by hash only: replacement detection can require unavailable archive reads.
 * A missing receipt or RPC failure is NOT proof that a submitted transaction failed.
 * This helper never signs or resends a transaction.
 */
export async function confirmTransaction(
    hash: `0x${string}`,
    readReceipt: () => Promise<{ status: 'success' | 'reverted' } | null>,
    timeout = 120_000,
    interval = 2_000,
): Promise<`0x${string}` | null> {
    const deadline = Date.now() + timeout
    let lastError: unknown
    while (Date.now() < deadline) {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            const receipt = await Promise.race([
                readReceipt(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Receipt lookup timed out')), Math.max(1, deadline - Date.now()))
                }),
            ])
            if (receipt) return receipt.status === 'success' ? hash : null
        } catch (error) {
            lastError = error
        } finally {
            clearTimeout(timer)
        }
        const remaining = deadline - Date.now()
        if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(interval, remaining)))
    }
    throw new SubmittedTransactionError(hash, lastError)
}
