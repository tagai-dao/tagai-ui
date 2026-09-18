import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatEther, isAddress, parseAbi, type Address } from 'viem'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { get, post } from '@/apis/axios'
import { BACKEND_API_URL } from '@/config'
import { getPreparedWalletClient, getReadOnlyClient } from '@/utils/wallets'
import { writeContract, SubmittedTransactionError } from '@/utils/contract'
import { commentBuyAmount, commentBuyBps, commentBuyLimitIssue } from '@/utils/commentBuyForm'

type Action = 'deposit' | 'authorize' | 'withdraw' | 'revoke'
type Dialog = '' | Action
const abi = parseAbi([
  'function deposit(uint256 fees) payable', 'function withdraw(uint256 principal,uint256 fees)',
  'function authorize(uint256 budget,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint16 maxPlatformBps,uint16 maxSlippageBps,uint256 expiresAt,uint256 fees) payable',
  'function revoke()', 'function paused() view returns(bool)',
  'function principalBalance(address) view returns(uint256)', 'function feeBalance(address) view returns(uint256)',
  'function grants(address) view returns(uint256 remaining,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint256 expiresAt,uint256 version,uint256 startsAt,uint256 spentDay,uint256 day,uint16 maxPlatformBps,uint16 maxSlippageBps,bool enabled)',
])
type Grant = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, number, boolean]
interface BuyConfig { enabled: boolean; vault: Address; platformFeeBps: number; executionFeeWei: string }
export interface CommentBuyOrder { replyId: string; state: string; reason?: string; txHash?: string; createdAt?: string; settlement?: Record<string, any> | null }

export function useCommentBuyAuthorization() {
  const { locale } = useI18n()
  const text = (cn: string, en: string) => locale.value.startsWith('zh') ? cn : en
  const account = useAccountStore(), chain = useChainStore(), modal = useModalStore()
  const config = ref<BuyConfig>(), grant = ref<Grant>()
  const principalBalance = ref(0n), feeBalance = ref(0n), paused = ref(false)
  const checked = ref(false), refreshing = ref(false), busy = ref(false)
  const error = ref(''), loadError = ref(''), historyError = ref(false), success = ref('')
  const submitted = ref(''), submittedKind = ref<Action>(), transactionStage = ref('')
  const dialog = ref<Dialog>(''), dialogVisible = ref(false), advanced = ref(false)
  const orders = ref<CommentBuyOrder[]>([]), now = ref(Date.now())
  const form = reactive({ principal: '0.001', fees: '0.0001', budget: '0.0011', perTrade: '0.0011', perDay: '0.0011', executionFee: '0', feePercent: '3', slippagePercent: '1', days: '7' })
  const user = computed(() => account.getAccountInfo?.ethAddr as Address | undefined)
  const twitterId = computed(() => account.getAccountInfo?.twitterId)
  const onBsc = computed(() => chain.activeChainId === 56)
  const signedIn = computed(() => !!twitterId.value && !!account.getAccountInfo?.accessToken && Number(account.getAccountInfo?.accountType) === 0)
  const connected = computed(() => !!user.value && account.ethConnectState === EthWalletState.Connected && account.ethConnectAddress?.toLowerCase() === user.value.toLowerCase())
  const ready = computed(() => onBsc.value && checked.value && connected.value && Number(account.getAccountInfo?.accountType) === 0)
  const tradingAvailable = computed(() => checked.value && config.value?.enabled && !paused.value)
  const activeGrant = computed(() => !!grant.value?.[11] && grant.value[4] * 1000n > BigInt(now.value) && grant.value[0] > 0n)
  const funded = computed(() => principalBalance.value > 0n && feeBalance.value > 0n)
  const locked = computed(() => busy.value || !!submitted.value)
  const depositTotal = computed(() => {
    const p = commentBuyAmount(form.principal), f = commentBuyAmount(form.fees)
    return p === null || f === null ? null : p + f
  })
  const formIssue = computed(() => {
    if (dialog.value === 'deposit') return depositTotal.value === null || depositTotal.value <= 0n ? text('请输入有效的充值金额。', 'Enter a valid deposit amount.') : ''
    if (dialog.value !== 'authorize') return ''
    const issue = commentBuyLimitIssue(form.budget, form.perTrade, form.perDay)
    if (issue === 'amount') return text('所有授权额度必须大于 0。', 'All spending limits must be greater than zero.')
    if (issue === 'total') return text('单笔限额不能超过总授权额度。', 'Per-order limit cannot exceed the total budget.')
    if (issue === 'daily') return text('单笔限额不能超过每日限额。', 'Per-order limit cannot exceed the daily limit.')
    if (commentBuyBps(form.feePercent) === null || commentBuyBps(form.slippagePercent) === null) return text('费率与滑点须为 0–10%，最多两位小数。', 'Fee and slippage caps must be 0–10%, with up to two decimals.')
    if (commentBuyAmount(form.executionFee) === null) return text('请输入有效的执行费上限。', 'Enter a valid execution fee cap.')
    if (!/^\d+$/.test(form.days) || Number(form.days) < 1 || Number(form.days) > 90) return text('有效期须为 1–90 天。', 'Choose an expiry of 1–90 days.')
    return ''
  })
  const needsConnection = computed(() => !onBsc.value || !signedIn.value || !connected.value)
  const connectionLabel = computed(() => !onBsc.value ? text('切换到 BNB Chain', 'Switch to BNB Chain') : !signedIn.value ? text('登录 X 账号', 'Sign in with X') : !user.value ? text('绑定钱包', 'Link wallet') : text('连接绑定钱包', 'Connect linked wallet'))
  const connectionHint = computed(() => !onBsc.value ? text('评论买币目前仅支持 BNB Chain。', 'Comment buys are available on BNB Chain.') : !signedIn.value ? text('使用发评论的 X 账号登录，买入代币将进入该账号绑定的钱包。', 'Sign in with the X account you will comment from. Tokens arrive in its linked wallet.') : text('请连接下方接收钱包，才能充值或修改授权。', 'Connect the recipient wallet below to fund or change authorization.'))

  function connect() {
    if (!onBsc.value) {
      chain.setActiveChain(56, { reload: false })
      window.location.assign('/bsc/wallet')
      return
    }
    modal.setModalVisible(true, !signedIn.value ? GlobalModalType.Login : !user.value ? GlobalModalType.BondEth : GlobalModalType.ChoseWallet)
  }
  let generation = 0, timer: ReturnType<typeof setInterval> | undefined
  async function refresh() {
    const current = ++generation
    if (!onBsc.value) { refreshing.value = false; return }
    refreshing.value = true; loadError.value = ''
    const wallet = user.value, id = twitterId.value
    try {
      const c: BuyConfig = await get(BACKEND_API_URL + '/commentBuy/config') as any
      if (current !== generation) return
      if (!isAddress(c.vault ?? '') || /^0x0{40}$/i.test(c.vault)) throw new Error('Invalid vault')
      if (config.value && c.vault.toLowerCase() !== config.value.vault.toLowerCase()) { checked.value = false; grant.value = undefined; principalBalance.value = 0n; feeBalance.value = 0n }
      config.value = c
      const client = getReadOnlyClient(56)
      const code = await client.getBytecode({ address: c.vault })
      if (!code || code === '0x') throw new Error('Vault is not deployed')
      const isPaused = await client.readContract({ address: c.vault, abi, functionName: 'paused' })
      if (current !== generation) return
      paused.value = isPaused
      if (!wallet || !isAddress(wallet)) { checked.value = true; return }
      const [p, f, g] = await Promise.all([
        client.readContract({ address: c.vault, abi, functionName: 'principalBalance', args: [wallet] }),
        client.readContract({ address: c.vault, abi, functionName: 'feeBalance', args: [wallet] }),
        client.readContract({ address: c.vault, abi, functionName: 'grants', args: [wallet] }),
      ])
      if (current !== generation) return
      principalBalance.value = p; feeBalance.value = f; grant.value = g; checked.value = true
      if (c.enabled && signedIn.value) {
        try {
          const history: any = await get(BACKEND_API_URL + '/commentBuy/orders', { twitterId: id })
          if (current !== generation) return
          const rows = Array.isArray(history) ? history : history?.data
          if (!Array.isArray(rows)) throw new Error('Invalid history')
          orders.value = rows.map((item: any) => {
            try { return { ...item, settlement: typeof item.settlement === 'string' ? JSON.parse(item.settlement) : item.settlement } }
            catch { return { ...item, settlement: null } }
          })
          historyError.value = false
        } catch { if (current === generation) historyError.value = true }
      }
    } catch { if (current === generation) { checked.value = false; loadError.value = text('暂时无法读取交易数据，请重试。不会提交任何交易。', 'Could not load trading data. Retry to continue; no transaction has been sent.') } }
    finally { if (current === generation) refreshing.value = false }
  }
  watch(() => [chain.activeChainId, user.value, twitterId.value], () => {
    config.value = undefined; checked.value = false; grant.value = undefined; orders.value = []
    principalBalance.value = 0n; feeBalance.value = 0n; historyError.value = false
    if (!locked.value) dialogVisible.value = false
    void refresh()
  }, { immediate: true })
  onMounted(() => { timer = setInterval(() => { now.value = Date.now(); if (!document.hidden && !busy.value && !refreshing.value && !dialogVisible.value) void refresh() }, 15000) })
  onUnmounted(() => { generation++; clearInterval(timer) })

  function open(kind: Action) {
    if (locked.value) return
    error.value = ''; success.value = ''; advanced.value = false
    if (kind === 'authorize') {
      const g = grant.value
      if (g && g[5] > 0n) {
        // Editing starts from the user's actual caps, never silently raises an existing grant.
        form.budget = formatEther(g[0]); form.perTrade = formatEther(g[1]); form.perDay = formatEther(g[2])
        form.executionFee = formatEther(g[3]); form.feePercent = String(g[9] / 100); form.slippagePercent = String(g[10] / 100)
        form.days = String(Math.max(1, Math.min(90, Math.ceil((Number(g[4]) * 1000 - Date.now()) / 86400000))))
      } else {
        const total = principalBalance.value + feeBalance.value
        const budget = total > 0n ? total : 1100000000000000n
        form.budget = formatEther(budget)
        form.perTrade = formatEther(budget < 1100000000000000n ? budget : 1100000000000000n)
        form.perDay = formatEther(budget < 11000000000000000n ? budget : 11000000000000000n)
        form.executionFee = formatEther(BigInt(config.value?.executionFeeWei ?? '0'))
        form.feePercent = '3'; form.slippagePercent = '1'; form.days = '7'
      }
    }
    dialog.value = kind; dialogVisible.value = true
  }
  const actionSuccess = (kind: Action) => ({
    deposit: text('充值成功，资金已进入买币账户。', 'Deposit confirmed. Funds are in your trading account.'),
    authorize: text('授权已生效，现在可以去 X 发一条新的买币评论。', 'Authorization is active. You can now post a new buy comment on X.'),
    withdraw: text('已提取全部买币资金到绑定钱包。授权状态未改变。', 'Trading funds returned to your linked wallet. Authorization is unchanged.'),
    revoke: text('已关闭评论买币，账户余额不会自动提取。', 'Comment buys are disabled. Your funds remain available to withdraw.'),
  })[kind]
  async function action(kind: Action) {
    if (!ready.value || locked.value || formIssue.value) return
    if ((kind === 'authorize' || kind === 'deposit') && !tradingAvailable.value) return
    if (kind === 'authorize' && !signedIn.value) { connect(); return }
    busy.value = true; error.value = ''; success.value = ''
    const address = config.value!.vault, wallet = user.value!, id = twitterId.value
    const ensureContext = () => {
      if (!ready.value || user.value !== wallet || twitterId.value !== id || config.value?.vault !== address) throw new Error(text('账号或网络已切换，请重新打开操作。', 'Account or network changed. Reopen this action.'))
    }
    try {
      let args: any[] = [], value = 0n
      if (kind === 'authorize') {
        const amounts = [form.budget, form.perTrade, form.perDay, form.executionFee].map(commentBuyAmount)
        if (amounts.some(v => v === null)) return
        transactionStage.value = text('请在钱包签名，验证 X 账号与钱包关联…', 'Sign in your wallet to verify the X account link…')
        const challenge: any = await post(BACKEND_API_URL + '/commentBuy/challenge', { twitterId: id })
        ensureContext()
        if (challenge.wallet?.toLowerCase() !== wallet.toLowerCase() || typeof challenge.message !== 'string') throw new Error(text('钱包验证信息不匹配，请重新登录。', 'Wallet verification mismatch. Sign in again.'))
        const client = await getPreparedWalletClient(56)
        const signature = await client.signMessage({ account: wallet, message: challenge.message })
        await post(BACKEND_API_URL + '/commentBuy/verify', { twitterId: id, nonce: challenge.nonce, signature })
        ensureContext()
        args = [...amounts, commentBuyBps(form.feePercent), commentBuyBps(form.slippagePercent), BigInt(Math.floor(Date.now() / 1000) + Number(form.days) * 86400), 0n]
      } else if (kind === 'deposit') {
        const p = commentBuyAmount(form.principal), f = commentBuyAmount(form.fees)
        if (p === null || f === null || p + f === 0n) return
        args = [f]; value = p + f
      } else if (kind === 'withdraw') args = [principalBalance.value, feeBalance.value]
      ensureContext()
      transactionStage.value = text('请在钱包确认交易…', 'Confirm the transaction in your wallet…')
      submittedKind.value = kind
      await writeContract({ contractName: 'CommentTradeVault', address, abi, functionName: kind, args, value,
        beforeWrite: ensureContext, onSubmitted: hash => { submitted.value = hash; transactionStage.value = text('交易已提交，等待链上确认…', 'Transaction submitted. Waiting for confirmation…') } })
      submitted.value = ''; success.value = actionSuccess(kind); dialogVisible.value = false
      await refresh()
    } catch (e) {
      if (e instanceof SubmittedTransactionError || submitted.value) {
        error.value = text('交易已提交，但确认尚未完成。请检查结果，不要重复提交。', 'Transaction submitted but not yet confirmed. Check its result; do not resubmit.')
      } else {
        const message = String((e as Error)?.message ?? '')
        error.value = /reject|denied|cancel/i.test(message) ? text('已取消，没有提交交易。', 'Cancelled. No transaction was submitted.') : text('操作未完成。请检查钱包余额、网络或登录状态后重试。', 'Action incomplete. Check wallet balance, network and sign-in, then retry.')
      }
    } finally { busy.value = false; transactionStage.value = '' }
  }
  async function checkSubmitted() {
    if (!submitted.value || busy.value) return
    busy.value = true
    try {
      const receipt = await getReadOnlyClient(56).getTransactionReceipt({ hash: submitted.value as `0x${string}` })
      submitted.value = ''
      error.value = receipt.status === 'success' ? '' : text('交易已回滚，操作未生效；链上 gas 可能已消耗。', 'Transaction reverted; the action did not take effect. Network gas may have been spent.')
      if (receipt.status === 'success') { success.value = actionSuccess(submittedKind.value!); dialogVisible.value = false }
      await refresh()
    } catch { error.value = text('尚未查到交易结果，请稍后检查，不要重复提交。', 'No receipt yet. Check again later; do not resubmit.') }
    finally { busy.value = false }
  }
  return { text, account, config, grant, principalBalance, feeBalance, paused, checked, refreshing, busy, error, loadError, historyError, success, submitted, transactionStage, dialog, dialogVisible, advanced, orders, form, user, onBsc, signedIn, connected, ready, tradingAvailable, activeGrant, funded, locked, depositTotal, formIssue, needsConnection, connectionLabel, connectionHint, connect, refresh, open, action, checkSubmitted }
}
