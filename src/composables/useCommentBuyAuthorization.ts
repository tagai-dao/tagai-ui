import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatEther, isAddress, parseAbi, type Address } from 'viem'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { get } from '@/apis/axios'
import { BACKEND_API_URL } from '@/config'
import { getReadOnlyClient } from '@/utils/wallets'
import { writeContract, SubmittedTransactionError } from '@/utils/contract'
import { commentBuyAmount, commentBuyExecutionFee, commentBuyGrantChanged, commentBuyFundingPlan, commentBuyLimitIssue, normalizeLegacyCommentBuyGrant, COMMENT_BUY_SLIPPAGE_BPS, type CommentBuyGrant } from '@/utils/commentBuyForm'

type Action = 'deposit' | 'authorize' | 'withdraw' | 'revoke'
type Dialog = '' | Action
const abi = parseAbi([
  'function deposit() payable', 'function withdraw(uint256 amount)',
  'function authorize(uint256 budget,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint16 maxSlippageBps,uint256 expiresAt) payable',
  'function revoke()', 'function paused() view returns(bool)',
  'function vaultVersion() view returns(uint256)', 'function balanceOf(address) view returns(uint256)',
  'function grants(address) view returns(uint256 remaining,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint256 expiresAt,uint256 version,uint256 startsAt,uint256 spentDay,uint256 day,uint16 maxSlippageBps,bool enabled)',
])
const legacyAbi = parseAbi(['function principalBalance(address) view returns(uint256)', 'function feeBalance(address) view returns(uint256)', 'function withdraw(uint256 principal,uint256 fees)', 'function revoke()',
  'function grants(address) view returns(uint256 remaining,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint256 expiresAt,uint256 version,uint256 startsAt,uint256 spentDay,uint256 day,uint16 maxPlatformBps,uint16 maxSlippageBps,bool enabled)',
])
interface BuyConfig { enabled: boolean; vault: Address; platformFeeBps: number; executionFeeWei: string }
export interface CommentBuyOrder { replyId: string; state: string; reason?: string; txHash?: string; createdAt?: string; settlement?: Record<string, any> | null }

export function useCommentBuyAuthorization() {
  const { locale } = useI18n()
  const text = (cn: string, en: string) => locale.value.startsWith('zh') ? cn : en
  const account = useAccountStore(), chain = useChainStore(), modal = useModalStore()
  const config = ref<BuyConfig>(), grant = ref<CommentBuyGrant>(), openedGrant = ref<CommentBuyGrant>()
  const balance = ref(0n), legacyBalances = ref<readonly [bigint, bigint]>([0n, 0n]), unified = ref(false), paused = ref(false)
  const checked = ref(false), refreshing = ref(false), busy = ref(false)
  const error = ref(''), loadError = ref(''), historyError = ref(false), success = ref('')
  const submitted = ref(''), submittedKind = ref<Action>(), transactionStage = ref('')
  const submittedCombined = ref(false)
  const dialog = ref<Dialog>(''), dialogVisible = ref(false)
  const orders = ref<CommentBuyOrder[]>([]), now = ref(Date.now())
  const form = reactive({ amount: '0.01', budget: '0', perTrade: '0', perDay: '0', days: '7' })
  const user = computed(() => account.getAccountInfo?.ethAddr as Address | undefined)
  const twitterId = computed(() => account.getAccountInfo?.twitterId)
  const onBsc = computed(() => chain.activeChainId === 56)
  const signedIn = computed(() => !!twitterId.value && !!account.getAccountInfo?.accessToken && Number(account.getAccountInfo?.accountType) === 0)
  const connected = computed(() => !!user.value && account.ethConnectState === EthWalletState.Connected && account.ethConnectAddress?.toLowerCase() === user.value.toLowerCase())
  const wrongWallet = computed(() => !!user.value && account.ethConnectState === EthWalletState.Connected && !!account.ethConnectAddress && account.ethConnectAddress.toLowerCase() !== user.value.toLowerCase())
  const ready = computed(() => onBsc.value && checked.value && connected.value && signedIn.value)
  const tradingAvailable = computed(() => checked.value && unified.value && config.value?.enabled && !paused.value)
  const activeGrant = computed(() => !!grant.value?.[10] && grant.value[4] * 1000n > BigInt(now.value) && grant.value[0] > 0n)
  const executionFeeWei = computed(() => commentBuyExecutionFee(config.value?.executionFeeWei))
  const needsReauthorization = computed(() => activeGrant.value && executionFeeWei.value !== null && grant.value![3] < executionFeeWei.value)
  const funded = computed(() => executionFeeWei.value !== null && balance.value > executionFeeWei.value)
  const locked = computed(() => busy.value || !!submitted.value)
  const depositTotal = computed(() => commentBuyAmount(form.amount))
  const updatesGrant = computed(() => !activeGrant.value || needsReauthorization.value || commentBuyGrantChanged(form, openedGrant.value))
  const formIssue = computed(() => {
    if (dialog.value === 'deposit' && depositTotal.value === null) return text('请输入有效金额；不充值可填 0。', 'Enter a valid amount, or 0 to skip the deposit.')
    if (dialog.value === 'deposit' && depositTotal.value === 0n && !updatesGrant.value) return text('未充值且授权设置未修改，无需提交交易。', 'No deposit or authorization changes. No transaction is needed.')
    if (dialog.value !== 'authorize' && dialog.value !== 'deposit') return ''
    if (!updatesGrant.value) return ''
    const issue = commentBuyLimitIssue(form.budget, form.perTrade, form.perDay)
    if (issue === 'amount') return text('所有授权额度必须大于 0。', 'All spending limits must be greater than zero.')
    if (issue === 'total') return text('单笔限额不能超过总授权额度。', 'Per-order limit cannot exceed the total budget.')
    if (issue === 'daily') return text('单笔限额不能超过每日限额。', 'Per-order limit cannot exceed the daily limit.')
    if (executionFeeWei.value === null) return text('无法读取执行费，请刷新后重试。', 'Execution fee unavailable. Refresh and retry.')
    if (commentBuyAmount(form.perTrade)! <= executionFeeWei.value) return text('单笔限额不足以支付手续费，请提高限额，为买入金额留出空间。', 'The per-order limit does not cover the fee. Increase it to leave room for your buy amount.')
    if (form.days === 'keep') {
      if (!openedGrant.value || openedGrant.value[4] * 1000n <= BigInt(now.value)) return text('原授权已到期，请选择新的有效期。', 'Authorization expired. Choose a new expiry.')
    } else if (!/^\d+$/.test(form.days) || Number(form.days) < 1 || Number(form.days) > 90) return text('有效期须为 1–90 天。', 'Choose an expiry of 1–90 days.')
    return ''
  })
  const needsConnection = computed(() => !onBsc.value || !signedIn.value || !connected.value)
  const connectionLabel = computed(() => !onBsc.value ? text('切换到 BNB Chain', 'Switch to BNB Chain') : !signedIn.value ? text('登录 X 账号', 'Sign in with X') : !user.value ? text('绑定钱包', 'Link wallet') : wrongWallet.value ? text('切换到绑定钱包', 'Switch to linked wallet') : text('连接绑定钱包', 'Connect linked wallet'))
  const connectionHint = computed(() => !onBsc.value ? text('评论买币目前仅支持 BNB Chain。', 'Comment buys are available on BNB Chain.') : !signedIn.value ? text('使用发评论的 X 账号登录，买入代币将进入该账号绑定的钱包。', 'Sign in with the X account you will comment from. Tokens arrive in its linked wallet.') : wrongWallet.value ? text('当前钱包与绑定地址不一致，请在钱包中切换到下方绑定地址后再操作。', 'Your connected wallet does not match. Switch to the linked address below before continuing.') : text('请连接下方绑定钱包后再操作。', 'Connect the linked wallet below before continuing.'))

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
      if (commentBuyExecutionFee(c.executionFeeWei) === null || !Number.isInteger(c.platformFeeBps) || c.platformFeeBps < 0 || c.platformFeeBps > 1000) throw new Error('Invalid fee configuration')
      if (config.value && c.vault.toLowerCase() !== config.value.vault.toLowerCase()) { checked.value = false; grant.value = undefined; balance.value = 0n; unified.value = false }
      config.value = c
      const client = getReadOnlyClient(56)
      const code = await client.getBytecode({ address: c.vault })
      if (!code || code === '0x') throw new Error('Vault is not deployed')
      const isPaused = await client.readContract({ address: c.vault, abi, functionName: 'paused' })
      let version: bigint | undefined
      try { version = await client.readContract({ address: c.vault, abi, functionName: 'vaultVersion' }) } catch { /* Read legacy balances below; do not assume an unknown contract supports v2. */ }
      if (version !== undefined && version !== 2n) throw new Error('Unsupported vault version')
      const isUnified = version === 2n
      const legacy = !isUnified ? await Promise.all([
        client.readContract({ address: c.vault, abi: legacyAbi, functionName: 'principalBalance', args: [wallet ?? '0x0000000000000000000000000000000000000000'] }),
        client.readContract({ address: c.vault, abi: legacyAbi, functionName: 'feeBalance', args: [wallet ?? '0x0000000000000000000000000000000000000000'] }),
      ]) : [0n, 0n] as const
      if (current !== generation) return
      paused.value = isPaused; unified.value = isUnified; legacyBalances.value = [legacy[0], legacy[1]]
      if (!wallet || !isAddress(wallet)) { checked.value = true; return }
      const [b, g] = await Promise.all([
        isUnified ? client.readContract({ address: c.vault, abi, functionName: 'balanceOf', args: [wallet] }) : legacy[0] + legacy[1],
        isUnified ? client.readContract({ address: c.vault, abi, functionName: 'grants', args: [wallet] })
          : client.readContract({ address: c.vault, abi: legacyAbi, functionName: 'grants', args: [wallet] }).then(normalizeLegacyCommentBuyGrant),
      ])
      if (current !== generation) return
      balance.value = b; grant.value = g; checked.value = true
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
    balance.value = 0n; legacyBalances.value = [0n, 0n]; unified.value = false; openedGrant.value = undefined; historyError.value = false
    if (!locked.value) dialogVisible.value = false
    void refresh()
  }, { immediate: true })
  onMounted(() => { timer = setInterval(() => { now.value = Date.now(); if (!document.hidden && !busy.value && !refreshing.value && !dialogVisible.value) void refresh() }, 15000) })
  onUnmounted(() => { generation++; clearInterval(timer) })

  function open(kind: Action) {
    if (locked.value) return
    error.value = ''; success.value = ''
    if (kind === 'authorize' || kind === 'deposit') {
      const g = grant.value
      openedGrant.value = g ? [...g] as CommentBuyGrant : undefined
      if (g && g[5] > 0n) {
        // Preserve spending limits; wallet binding was verified by the existing account flow.
        form.budget = formatEther(g[0]); form.perTrade = formatEther(g[1]); form.perDay = formatEther(g[2])
        form.days = g[4] * 1000n > BigInt(Date.now()) ? 'keep' : '7'
      } else {
        const total = balance.value + (kind === 'deposit' ? depositTotal.value ?? 0n : 0n)
        const suggested = 1030000000000000n + (executionFeeWei.value ?? 0n)
        const budget = total > 0n ? total : suggested
        form.budget = formatEther(budget)
        form.perTrade = formatEther(budget < suggested ? budget : suggested)
        form.perDay = formatEther(budget < suggested * 10n ? budget : suggested * 10n)
        form.days = '7'
      }
    }
    dialog.value = kind; dialogVisible.value = true
  }
  const actionSuccess = (kind: Action) => ({
    deposit: submittedCombined.value ? text('充值与授权已一起完成，现在可以去 X 发买币评论。', 'Deposit and authorization confirmed together. You can now post a buy comment on X.') : text('充值成功，原授权额度与有效期保持不变。', 'Deposit confirmed. Existing limits and expiry are unchanged.'),
    authorize: text('授权设置已保存，未充值。', 'Authorization saved. No deposit was made.'),
    withdraw: text('已提取全部买币资金到绑定钱包。授权状态未改变。', 'Trading funds returned to your linked wallet. Authorization is unchanged.'),
    revoke: text('已关闭评论买币，账户余额不会自动提取。', 'Comment buys are disabled. Your funds remain available to withdraw.'),
  })[kind]
  async function action(kind: Action) {
    if (!ready.value || locked.value || formIssue.value) return
    if ((kind === 'authorize' || kind === 'deposit') && !tradingAvailable.value) return
    const updating = (kind === 'authorize' || kind === 'deposit') && updatesGrant.value
    if (kind === 'authorize' && !updating) return
    if (updating && !signedIn.value) { connect(); return }
    busy.value = true; error.value = ''; success.value = ''
    const address = config.value!.vault, wallet = user.value!, id = twitterId.value
    const authorizedExecutionFee = executionFeeWei.value
    const ensureContext = () => {
      if (!ready.value || user.value !== wallet || twitterId.value !== id || config.value?.vault !== address) throw new Error(text('账号或网络已切换，请重新打开操作。', 'Account or network changed. Reopen this action.'))
      if (updating && authorizedExecutionFee !== executionFeeWei.value) throw new Error('Fee configuration changed')
    }
    try {
      let args: any[] = [], value = 0n
      let functionName: Action = kind
      if (kind === 'deposit') ({ functionName, value } = commentBuyFundingPlan(form.amount, updating))
      if (updating) {
        const amounts = [form.budget, form.perTrade, form.perDay].map(commentBuyAmount)
        if (amounts.some(v => v === null) || authorizedExecutionFee === null) return
        const expiresAt = form.days === 'keep' ? openedGrant.value![4] : BigInt(Math.floor(Date.now() / 1000) + Number(form.days) * 86400)
        if (expiresAt <= BigInt(Math.floor(Date.now() / 1000))) throw new Error('Authorization expired')
        args = [...amounts, authorizedExecutionFee, COMMENT_BUY_SLIPPAGE_BPS, expiresAt]
      } else if (kind === 'withdraw') args = unified.value ? [balance.value] : [...legacyBalances.value]
      ensureContext()
      transactionStage.value = text('请在钱包确认交易…', 'Confirm the transaction in your wallet…')
      submittedKind.value = kind === 'deposit' && value === 0n ? 'authorize' : kind
      submittedCombined.value = kind === 'deposit' && updating && value > 0n
      await writeContract({ contractName: 'CommentTradeVault', address, abi: unified.value ? abi : legacyAbi, functionName, args, value,
        beforeWrite: ensureContext, onSubmitted: hash => { submitted.value = hash; transactionStage.value = text('交易已提交，等待链上确认…', 'Transaction submitted. Waiting for confirmation…') } })
      submitted.value = ''; success.value = actionSuccess(submittedKind.value); dialogVisible.value = false
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
      error.value = receipt.status === 'success' ? '' : text('操作未成功，网络费可能已扣除。', 'The action failed. A network fee may still have been charged.')
      if (receipt.status === 'success') { success.value = actionSuccess(submittedKind.value!); dialogVisible.value = false }
      await refresh()
    } catch { error.value = text('尚未查到交易结果，请稍后检查，不要重复提交。', 'No receipt yet. Check again later; do not resubmit.') }
    finally { busy.value = false }
  }
  return { text, account, config, grant, balance, unified, paused, checked, refreshing, busy, error, loadError, historyError, success, submitted, transactionStage, dialog, dialogVisible, orders, form, user, onBsc, signedIn, connected, ready, tradingAvailable, activeGrant, needsReauthorization, funded, locked, depositTotal, updatesGrant, formIssue, needsConnection, connectionLabel, connectionHint, connect, refresh, open, action, checkSubmitted }
}
