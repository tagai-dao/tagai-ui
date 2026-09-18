import { reactive } from 'vue'
const params = new URLSearchParams(location.search)
export const mode = params.get('state') || 'new'
const wallet = '0x0000000000000000000000000000000000000001'
const vault = '0xAB2A0FF3BDbdD68E7100B6875Ac4a58db851d363'
export const EthWalletState = { Disconnect: 0, Connected: 1, Connecting: 2 }
const account = reactive({
  getAccountInfo: { twitterId: 'fixture', ethAddr: wallet, accessToken: 'local-preview-only', accountType: 0 },
  ethConnectAddress: mode === 'disconnected' ? '' : wallet, ethConnectState: mode === 'disconnected' ? 0 : 1,
})
export const useAccountStore = () => account
export const useChainStore = () => ({ activeChainId: mode === 'wrong-chain' ? 4663 : 56, setActiveChain: () => {} })
export const useModalStore = () => ({ setModalVisible: () => { account.ethConnectAddress = wallet; account.ethConnectState = 1 } })
export const GlobalModalType = { Login: 0, ChoseWallet: 1, BondEth: 2 }
export const BACKEND_API_URL = '/fixture'
let principal = mode === 'active' ? 9600000000000000n : mode === 'funded' ? 1000000000000000n : 0n
let fees = principal > 0n ? 100000000000000n : 0n
let grant: any[] = mode === 'active' ? [10000000000000000n, 1100000000000000n, 5000000000000000n, 0n, BigInt(Math.floor(Date.now() / 1000) + 86400 * 7), 1n, 0n, 0n, 0n, 300, 100, true] : [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0, 0, false]
export async function get(url: string) {
  if (mode === 'error') throw new Error('Fixture offline')
  if (url.endsWith('/config')) return { enabled: mode !== 'disabled', vault, platformFeeBps: 100, executionFeeWei: '0' }
  if (mode !== 'active') return []
  return [
    { replyId: '123', state: 'confirmed', createdAt: new Date().toISOString(), settlement: { token: wallet, principal: '1000000000000000', total: '1030000000000000' } },
    { replyId: '124', state: 'rejected', reason: 'PROTOCOL_FEE_CAP', createdAt: new Date().toISOString() },
    { replyId: '125', state: 'submitted', createdAt: new Date().toISOString() },
  ]
}
export async function post(url: string) { return url.endsWith('/challenge') ? { wallet, message: 'LOCAL DESIGN PREVIEW — NO REAL SIGNATURE', nonce: 'fixture' } : {} }
export const getReadOnlyClient = () => ({
  getBytecode: async () => '0x01',
  readContract: async ({ functionName }: { functionName: string }) => ({ principalBalance: principal, feeBalance: fees, grants: grant, paused: mode === 'paused' })[functionName],
  getTransactionReceipt: async () => ({ status: 'success' }),
})
export const getPreparedWalletClient = async () => ({ signMessage: async () => 'LOCAL_PREVIEW_NOT_A_SIGNATURE' })
export class SubmittedTransactionError extends Error {}
export async function writeContract(options: any) {
  options.beforeWrite()
  if (mode === 'rejected') throw new Error('User rejected request')
  if (mode === 'pending') {
    options.onSubmitted(`0x${'1'.repeat(64)}`)
    throw new SubmittedTransactionError('LOCAL PREVIEW: pending receipt')
  }
  if (options.functionName === 'deposit') { fees += options.args[0]; principal += options.value - options.args[0] }
  if (options.functionName === 'withdraw') { fees = principal = 0n }
  if (options.functionName === 'revoke') grant[11] = false
  if (options.functionName === 'authorize') grant = [options.args[0], options.args[1], options.args[2], options.args[3], options.args[6], 1n, 0n, 0n, 0n, options.args[4], options.args[5], true]
  // No provider, real signature, hash or network transaction exists in this fixture.
}
