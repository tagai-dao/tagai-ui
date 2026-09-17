<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatEther, isAddress, parseAbi, parseEther, type Address } from 'viem'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { get, post } from '@/apis/axios'
import { BACKEND_API_URL } from '@/config'
import { getPreparedWalletClient, getReadOnlyClient } from '@/utils/wallets'
import { writeContract, SubmittedTransactionError } from '@/utils/contract'

const { locale } = useI18n()
const zh = computed(() => locale.value.startsWith('zh'))
const text = (cn: string, en: string) => zh.value ? cn : en
const account = useAccountStore()
const chain = useChainStore()
const config = ref<any>()
const principalBalance = ref(0n), feeBalance = ref(0n)
const grant = ref<any>()
const busy = ref(false), error = ref(''), submitted = ref('')
const principal = ref('0.01'), fees = ref('0.001')
const budget = ref('0.011'), perTrade = ref('0.011'), perDay = ref('0.011')
const maxExecutionFee = ref('0.0001'), maxPlatformBps = ref('300'), slippageBps = ref('100'), days = ref('7')
const orders = ref<any[]>([])
const contractChecked = ref(false)
const abi = parseAbi([
  'function deposit(uint256 fees) payable', 'function withdraw(uint256 principal,uint256 fees)',
  'function authorize(uint256 budget,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint16 maxPlatformBps,uint16 maxSlippageBps,uint256 expiresAt,uint256 fees) payable',
  'function revoke()', 'function paused() view returns(bool)',
  'function principalBalance(address) view returns(uint256)', 'function feeBalance(address) view returns(uint256)',
  'function grants(address) view returns(uint256 remaining,uint256 perTrade,uint256 perDay,uint256 maxExecutionFee,uint256 expiresAt,uint256 version,uint256 startsAt,uint256 spentDay,uint256 day,uint16 maxPlatformBps,uint16 maxSlippageBps,bool enabled)',
])
const user = computed(() => account.getAccountInfo?.ethAddr as Address | undefined)
const configured = computed(() => chain.activeChainId === 56 && isAddress(config.value?.vault ?? '') && !/^0x0{40}$/i.test(config.value?.vault ?? ''))
const ready = computed(() => configured.value && contractChecked.value &&
  user.value && account.ethConnectAddress?.toLowerCase() === user.value.toLowerCase() && Number(account.getAccountInfo?.accountType) === 0)
let generation = 0
async function refresh() {
  const current = ++generation
  contractChecked.value = false
  if (chain.activeChainId !== 56) { config.value = undefined; return }
  try {
    const c: any = await get(BACKEND_API_URL + '/commentBuy/config')
    if (current !== generation) return
    config.value = c
    if (!isAddress(c.vault ?? '') || !user.value) return
    const wallet = user.value
    const client = getReadOnlyClient(56)
    const code = await client.getBytecode({ address: c.vault })
    if (!code || code === '0x') throw new Error('Vault is not deployed')
    const [p, f, g, history] = await Promise.all([
      client.readContract({ address: c.vault, abi, functionName: 'principalBalance', args: [wallet] }),
      client.readContract({ address: c.vault, abi, functionName: 'feeBalance', args: [wallet] }),
      client.readContract({ address: c.vault, abi, functionName: 'grants', args: [wallet] }),
      c.enabled ? get(BACKEND_API_URL + '/commentBuy/orders', { twitterId: account.getAccountInfo.twitterId }).catch(() => []) : Promise.resolve([]),
    ])
    if (current !== generation) return
    principalBalance.value = p; feeBalance.value = f; grant.value = g
    contractChecked.value = true
    const historyRows = Array.isArray(history) ? history : Array.isArray((history as any)?.data) ? (history as any).data : []
    orders.value = historyRows.map((item: any) => {
      try { return { ...item, settlement: typeof item.settlement === 'string' ? JSON.parse(item.settlement) : item.settlement } }
      catch (_) { return { ...item, settlement: null } }
    })
  } catch (_) { if (current === generation) error.value = text('交易授权数据暂不可用，请刷新。', 'Trading authorization unavailable. Please refresh.') }
}
watch(() => [chain.activeChainId, user.value], () => { config.value = undefined; grant.value = undefined; orders.value = []; void refresh() }, { immediate: true })

async function action(kind: 'authorize' | 'deposit' | 'revoke' | 'withdraw') {
  if (!ready.value || busy.value || submitted.value) return
  if ((kind === 'authorize' || kind === 'deposit') && !config.value?.enabled) return
  busy.value = true; error.value = ''
  const address = config.value.vault as Address
  const wallet = user.value!
  const twitterId = account.getAccountInfo.twitterId
  const ensureContext = () => {
    if (!ready.value || chain.activeChainId !== 56 || user.value !== wallet || config.value?.vault !== address) throw new Error('Account or network changed; please reopen authorization.')
  }
  try {
    let args: any[] = [], value = 0n
    if (kind === 'authorize') {
      const amounts = [budget.value, perTrade.value, perDay.value, maxExecutionFee.value].map(v => parseEther(v))
      const bps = Number(maxPlatformBps.value), slip = Number(slippageBps.value), duration = Number(days.value)
      if (amounts.some(a => a < 0n) || amounts[0] === 0n || amounts[1] === 0n || amounts[0] < amounts[1] || amounts[2] < amounts[1] ||
          !Number.isInteger(bps) || bps < 0 || bps > 1000 || !Number.isInteger(slip) || slip < 0 || slip > 1000 ||
          !Number.isInteger(duration) || duration < 1 || duration > 90) throw new Error(text('请检查额度、费用和有效期。', 'Check limits, fees and expiry.'))
      const challenge: any = await post(BACKEND_API_URL + '/commentBuy/challenge', { twitterId })
      ensureContext()
      if (challenge.wallet?.toLowerCase() !== wallet.toLowerCase() || typeof challenge.message !== 'string') throw new Error('Wallet proof mismatch')
      const client = await getPreparedWalletClient(56)
      const signature = await client.signMessage({ account: wallet, message: challenge.message })
      await post(BACKEND_API_URL + '/commentBuy/verify', { twitterId, nonce: challenge.nonce, signature })
      ensureContext()
      args = [...amounts, bps, slip, BigInt(Math.floor(Date.now() / 1000) + duration * 86400), 0n]
    } else if (kind === 'deposit') {
      const p = parseEther(principal.value), f = parseEther(fees.value)
      if (p < 0n || f < 0n || p + f === 0n) throw new Error('Invalid amount')
      args = [f]; value = p + f
    } else if (kind === 'withdraw') args = [principalBalance.value, feeBalance.value]
    ensureContext()
    await writeContract({ contractName: 'CommentTradeVault', address, abi, functionName: kind, args, value,
      beforeWrite: ensureContext, onSubmitted: hash => { submitted.value = hash } })
    submitted.value = ''; await refresh()
  } catch (e) {
    if (e instanceof SubmittedTransactionError || submitted.value) {
      error.value = text('交易已提交，请检查链上结果，不要重复提交。', 'Transaction submitted. Check its on-chain result; do not resubmit.')
    } else error.value = (e as Error).message || 'Operation failed'
  } finally { busy.value = false }
}
async function checkSubmitted() {
  if (!submitted.value) return
  try {
    const receipt = await getReadOnlyClient(56).getTransactionReceipt({ hash: submitted.value as `0x${string}` })
    submitted.value = ''; error.value = receipt.status === 'success' ? '' : text('交易已回滚，未执行。', 'Transaction reverted.')
    await refresh()
  } catch (_) { error.value = text('仍在确认中，请稍后检查。', 'Still awaiting confirmation. Check again shortly.') }
}
</script>

<template>
  <section class="rounded-2xl bg-grey-fa border border-white p-4 mb-4">
    <h3 class="text-lg font-bold">{{ text('交易授权 · BNB', 'Trading authorization · BNB') }}</h3>
    <p class="text-sm text-gray-500 mt-2">{{ text('与打赏资金独立。评论 @TagAIDAO buy 0.01BNB，买入唯一识别的原帖代币，直接到账已验证钱包。', 'Separate from tipping funds. Reply @TagAIDAO buy 0.01BNB to buy the uniquely identified token into your verified wallet.') }}</p>
    <p class="text-sm text-gray-500 mt-2">{{ text('仅执行已审核的代币和交易池。协议费率按执行时链上配置报价；新授权默认费率上限 3%，可自行调低。部分导入代币另扣买入代币协议费，计入费率上限且已包含在最低到账数量中，不重复扣 BNB。既有授权不自动提高。', 'Only reviewed tokens and pools execute. Protocol fees are quoted from current on-chain settings. New grants default to a 3% fee cap, which you can lower; existing grants are not raised. Some imported tokens deduct an output-token protocol fee, included in the fee cap and minimum received, never charged again in BNB.') }}</p>
    <p v-if="!config?.enabled || chain.activeChainId !== 56" class="text-sm mt-3">{{ text('首期仅支持 BNB Chain；交易服务尚未启用时，不接受充值或授权。', 'BNB Chain only. Deposits and authorization are unavailable until the service is activated.') }}</p>
    <template v-if="configured">
      <p class="text-sm break-all mt-3">{{ text('接收钱包', 'Recipient') }}: {{ user }}</p>
      <p class="text-sm my-2">{{ text('本金余额 / 费用余额', 'Principal / fee balance') }}: {{ formatEther(principalBalance) }} / {{ formatEther(feeBalance) }} BNB</p>
      <p class="text-sm">{{ text('授权剩余（含费用）', 'Remaining authorization (including fees)') }}: {{ grant ? formatEther(grant[0]) : '—' }} BNB · {{ grant?.[11] && grant[4] > BigInt(Math.floor(Date.now() / 1000)) ? text('已授权', 'Authorized') : text('未授权或已过期', 'Not authorized or expired') }}</p>
      <p class="text-sm my-2">{{ text('单独收取的平台费率', 'Separately charged platform fee') }}: {{ Number(config.platformFeeBps) / 100 }}%; {{ text('成功订单执行费', 'Successful order execution fee') }}: {{ formatEther(BigInt(config.executionFeeWei)) }} BNB</p>
      <p class="text-xs text-gray-500">{{ text('评论金额为买入本金。平台、IPShare 分配、回购及执行费用另从费用余额支付，全部计入限额。原协议费用只收一次；失败订单不扣本金及费用，失败 Gas 由执行方承担。', 'The comment amount is buy principal. Platform, IPShare, buyback and execution fees use the fee balance; all count toward limits. Protocol fees are charged once. Failed orders debit neither principal nor fees; the executor pays failed gas.') }}</p>
      <div class="grid grid-cols-1 web:grid-cols-2 gap-3 mt-4">
        <label class="text-sm">{{ text('充值本金 BNB', 'Deposit principal BNB') }}<input v-model="principal" inputmode="decimal" class="block border rounded-lg p-2 w-full" /></label>
        <label class="text-sm">{{ text('充值费用 BNB', 'Deposit fee funds BNB') }}<input v-model="fees" inputmode="decimal" class="block border rounded-lg p-2 w-full" /></label>
      </div>
      <div class="flex gap-3 my-3">
        <button :disabled="!ready || !config?.enabled || busy || !!submitted" class="border rounded-full px-4 py-2 disabled:opacity-40" @click="action('deposit')">{{ text('充值交易资金', 'Fund trading') }}</button>
        <button :disabled="!ready || busy || !!submitted" class="border rounded-full px-4 py-2 disabled:opacity-40" @click="action('withdraw')">{{ text('提取全部交易资金', 'Withdraw trading funds') }}</button>
      </div>
      <div class="grid grid-cols-1 web:grid-cols-2 gap-3">
        <label class="text-sm">{{ text('总授权额度 BNB（含费用）', 'Total budget BNB (all-in)') }}<input v-model="budget" class="block border rounded-lg p-2 w-full" inputmode="decimal" /></label>
        <label class="text-sm">{{ text('单笔限额 BNB（含费用）', 'Per-order BNB (all-in)') }}<input v-model="perTrade" class="block border rounded-lg p-2 w-full" inputmode="decimal" /></label>
        <label class="text-sm">{{ text('每日限额 BNB（含费用，UTC 0点重置）', 'Daily BNB (all-in, resets 00:00 UTC)') }}<input v-model="perDay" class="block border rounded-lg p-2 w-full" inputmode="decimal" /></label>
        <label class="text-sm">{{ text('每笔执行费上限 BNB', 'Max execution fee BNB') }}<input v-model="maxExecutionFee" class="block border rounded-lg p-2 w-full" inputmode="decimal" /></label>
        <label class="text-sm">{{ text('平台及协议费总上限 bps（100 = 1%）', 'Max platform + protocol fees bps (100 = 1%)') }}<input v-model="maxPlatformBps" class="block border rounded-lg p-2 w-full" inputmode="numeric" /></label>
        <label class="text-sm">{{ text('滑点上限 bps（100 = 1%）', 'Max slippage bps (100 = 1%)') }}<input v-model="slippageBps" class="block border rounded-lg p-2 w-full" inputmode="numeric" /></label>
        <label class="text-sm">{{ text('授权有效天数（1–90）', 'Expiry in days (1–90)') }}<input v-model="days" class="block border rounded-lg p-2 w-full" inputmode="numeric" /></label>
      </div>
      <div class="flex flex-wrap gap-3 mt-4">
        <button :disabled="!ready || !config?.enabled || busy || !!submitted" class="bg-orange-normal text-white rounded-full px-4 py-2 disabled:opacity-40" @click="action('authorize')">{{ text('验证钱包并授权买币', 'Verify wallet & authorize buys') }}</button>
        <button :disabled="!ready || busy || !!submitted" class="border rounded-full px-4 py-2 disabled:opacity-40" @click="action('revoke')">{{ text('撤销交易授权', 'Revoke authorization') }}</button>
        <button class="underline text-sm" @click="refresh">{{ text('刷新', 'Refresh') }}</button>
      </div>
      <p v-if="!ready" class="text-sm mt-2">{{ text('请登录 X 账户，并连接该账户已绑定的钱包。', 'Sign in with X and connect its bound wallet.') }}</p>
      <p v-if="submitted" class="break-all text-sm mt-2">{{ submitted }} <button class="underline" @click="checkSubmitted">{{ text('检查交易结果', 'Check transaction') }}</button></p>
      <div v-if="orders.length" class="mt-4 text-sm">
        <h4 class="font-bold">{{ text('最近评论买币', 'Recent comment buys') }}</h4>
        <div v-for="order in orders" :key="order.replyId" class="border-t py-2 break-all">
          <a :href="`https://x.com/i/status/${order.replyId}`" target="_blank" rel="noopener noreferrer">{{ order.replyId }}</a> · {{ order.state }}
          <p v-if="order.reason">{{ order.reason }}</p>
          <p v-if="order.state === 'confirmed' && order.settlement">
            {{ text('买入本金 / 平台费 / 执行费 BNB', 'Buy principal / platform fee / execution fee BNB') }}:
            {{ formatEther(BigInt(order.settlement.principal)) }} / {{ formatEther(BigInt(order.settlement.platformFee)) }} / {{ formatEther(BigInt(order.settlement.executionFee)) }}
          </p>
          <p v-if="order.state === 'confirmed' && order.settlement">
            {{ text('IPShare / 回购 / 总扣款 BNB', 'IPShare / buyback / total debit BNB') }}:
            {{ formatEther(BigInt(order.settlement.ipshareFee)) }} / {{ formatEther(BigInt(order.settlement.buybackFee)) }} / {{ formatEther(BigInt(order.settlement.total)) }}
          </p>
          <p v-if="order.state === 'confirmed' && order.settlement?.outputFeeBps">
            {{ text('买入代币协议费率（已从输出扣除）', 'Output-token protocol fee (already deducted)') }}:
            {{ Number(order.settlement.outputFeeBps) / 100 }}%
          </p>
          <a v-if="order.txHash" :href="`https://bscscan.com/tx/${order.txHash}`" target="_blank" rel="noopener noreferrer">{{ text('链上交易', 'Transaction') }}</a>
        </div>
      </div>
    </template>
    <p v-if="error" class="text-sm text-red-500 mt-2" role="alert">{{ error }}</p>
  </section>
</template>
