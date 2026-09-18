<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatEther } from 'viem'
import { ChatDotRound, Wallet, Refresh, CopyDocument, ArrowRight, Check, Close, Document, Lock } from '@element-plus/icons-vue'
import { useCommentBuyAuthorization, type CommentBuyOrder } from '@/composables/useCommentBuyAuthorization'

const {
  text, config, grant, balance, unified, checked, refreshing, busy,
  error, loadError, historyError, success, submitted, transactionStage, dialog, dialogVisible,
  orders, form, user, signedIn, connected, ready, tradingAvailable, activeGrant, needsReauthorization, funded, locked,
  depositTotal, updatesGrant, formIssue, needsConnection, connectionLabel, connectionHint, onBsc,
  connect, refresh, open, action, checkSubmitted,
} = useCommentBuyAuthorization()
const copied = ref(false)
const command = '@TagAIDAO buy 0.001BNB'
const shortAddress = (address?: string) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'
const amount = (value: bigint | string | undefined) => { try { return formatEther(BigInt(value ?? 0)) } catch { return '—' } }
const displayBalance = computed(() => checked.value && user.value ? amount(balance.value) : '—')
const status = computed(() => {
  if (!onBsc.value) return text('仅支持 BNB Chain', 'BNB Chain only')
  if (loadError.value) return text('数据暂不可用', 'Data unavailable')
  if (!checked.value) return text('读取中', 'Loading')
  if (!unified.value) return text('旧版账户', 'Legacy account')
  if (!tradingAvailable.value) return text('服务已暂停', 'Service paused')
  if (!activeGrant.value) return text('未开启', 'Not enabled')
  if (needsReauthorization.value) return text('待更新授权', 'Update authorization')
  if (!funded.value) return text('待充值', 'Needs funds')
  return text('已开启', 'Enabled')
})
const enabled = computed(() => checked.value && tradingAvailable.value && activeGrant.value && !needsReauthorization.value && funded.value)
const primaryLabel = computed(() => needsConnection.value ? connectionLabel.value : !checked.value ? text('重新读取', 'Retry') : !tradingAvailable.value ? text('服务暂不可用', 'Service unavailable') : text('充值 / 设置授权', 'Funds & authorization'))
function primaryAction() {
  if (needsConnection.value) connect()
  else if (!checked.value) void refresh()
  else open('deposit')
}
const expiry = computed(() => grant.value ? new Date(Number(grant.value[4]) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—')
const dialogTitle = computed(() => ({
  deposit: text('充值与授权设置', 'Funds & authorization'),
  authorize: activeGrant.value ? text('管理买币授权', 'Manage authorization') : text('开启评论买币', 'Enable comment buys'),
  withdraw: text('提取买币资金', 'Withdraw trading funds'),
  revoke: text('关闭评论买币？', 'Disable comment buys?'), '': '',
})[dialog.value])
const submitLabel = computed(() => dialog.value === 'deposit' ? depositTotal.value === 0n ? text('确认授权 · 不充值', 'Authorize · no deposit') : updatesGrant.value ? text('确认充值并授权', 'Fund & authorize') : text('确认充值 · 保持原授权', 'Deposit · keep authorization') : dialog.value === 'authorize' ? text('确认更新授权', 'Update authorization') : dialog.value === 'withdraw' ? text('确认提取全部', 'Withdraw all funds') : text('确认关闭', 'Confirm disable'))
const canSubmit = computed(() => ready.value && !locked.value && !formIssue.value &&
  ((dialog.value === 'deposit' || dialog.value === 'authorize') ? tradingAvailable.value : true) &&
  (dialog.value !== 'authorize' || updatesGrant.value) &&
  (dialog.value !== 'withdraw' || balance.value > 0n))
const serviceFee = computed(() => config.value ? `${Number(config.value.platformFeeBps) / 100}%` : '—')
const executionFee = computed(() => config.value ? amount(config.value.executionFeeWei) : '—')
const slippagePercent = computed(() => activeGrant.value && grant.value ? Math.min(grant.value[9], 500) / 100 : 5)
async function copyCommand() {
  try { await navigator.clipboard.writeText(command); copied.value = true }
  catch { error.value = text('复制失败，请手动选择下方指令复制。', 'Copy failed. Select and copy the command manually.') }
}
function orderLabel(order: CommentBuyOrder) {
  const names: Record<string, string> = {
    queued: text('等待执行', 'Queued'), submitted: text('链上确认中', 'Confirming'), confirmed: text('买入成功', 'Bought'),
    rejected: text('未执行', 'Not executed'), failed: text('交易失败', 'Failed'), review: text('待核查', 'Needs review'),
  }
  return names[order.state] ?? text('状态待确认', 'Status unavailable')
}
function orderReason(reason?: string) {
  const reasons: Record<string, string> = {
    EXPIRED_COMMAND: text('评论已超过 3 分钟有效期，未执行。', 'The comment expired after 3 minutes and was not executed.'),
    VERIFIED_WALLET_REQUIRED: text('请先验证钱包并开启买币授权。', 'Verify your wallet and enable comment buys first.'),
    INSUFFICIENT_FUNDS: text('买币余额不足以支付本次买入及费用。', 'Trading balance does not cover this buy and its fees.'),
    LIMIT_EXCEEDED: text('本次买入含费用的金额超过授权限额。', 'The buy including fees exceeds your spending limit.'),
    FEE_CAP: text('当前授权未覆盖本次费用，请更新买币授权后重试。', 'Current authorization does not cover these fees. Update authorization and retry.'),
    PROTOCOL_FEE_CAP: text('该交易的协议费用超出安全限制，订单未执行。', 'Protocol fees exceed the safety limit. No buy was executed.'),
    AUTHORIZATION_EXPIRED_OR_NEWER_THAN_COMMENT: text('授权已失效，或评论早于本次授权。请完成授权后再发新评论。', 'Authorization is inactive or newer than the comment. Authorize first, then post a new comment.'),
    SERVICE_PAUSED: text('买币服务已暂停，订单未执行。', 'Comment buys are paused. No buy was executed.'),
    EXECUTION_RATE_LIMIT: text('已达到执行频率限制，请稍后再试。', 'Execution rate limit reached. Try again later.'),
    AMBIGUOUS_ASSET: text('原帖包含多个代币，无法确定买入对象。', 'The original post contains multiple tokens.'),
    UNRESOLVED_CA: text('原帖中的代币尚未在 TagAI 注册。', 'The token in the original post is not registered on TagAI.'),
    COMMUNITY_TOKEN_REQUIRED: text('该代币尚未在 TagAI 注册。', 'This token is not registered on TagAI.'),
    UNSUPPORTED_CHAIN: text('目前仅支持 BNB Chain 代币。', 'Only BNB Chain tokens are supported.'),
    EDITED_POST: text('原帖或评论被编辑，订单未执行。', 'The post or comment was edited. No buy was executed.'),
    SOURCE_VERIFICATION_UNAVAILABLE: text('暂时无法验证 X 原帖，订单未执行。', 'Could not verify the original X post. No buy was executed.'),
    REVERTED_NO_PRINCIPAL_OR_FEES_CHARGED: text('链上交易失败，未扣除买币本金及订单费用。', 'The trade reverted. No buy principal or order fees were deducted.'),
  }
  return reason ? reasons[reason] ?? text('订单未完成，展开详情查看原因。', 'The order did not complete. Open details for the reason.') : ''
}
const dateLabel = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
</script>

<template>
  <div class="comment-buy">
    <header class="cb-heading">
      <div>
        <div class="cb-eyebrow"><span class="cb-network-dot"></span> BNB CHAIN <span class="cb-eyebrow-divider">/</span> {{ text('评论买币', 'COMMENT BUY') }}</div>
        <h2>{{ text('一条评论，完成买币。', 'Your next buy starts with a reply.') }}</h2>
        <p>{{ text('在 X 的代币帖子下发出指令，代币直接到账你的钱包。', 'Reply to a token post on X. The tokens arrive directly in your wallet.') }}</p>
      </div>
      <button class="cb-icon-button" :aria-label="text('刷新账户与订单', 'Refresh account and orders')" :disabled="refreshing || busy" @click="refresh"><Refresh :class="{ 'cb-spin': refreshing }" /></button>
    </header>

    <div v-if="loadError" class="cb-notice cb-notice-error" role="alert">{{ loadError }} <button @click="refresh">{{ text('重试', 'Retry') }}</button></div>
    <div v-if="success" class="cb-notice cb-notice-success" role="status"><Check />{{ success }}</div>
    <div v-if="error && !dialogVisible" class="cb-notice cb-notice-error" role="alert">{{ error }}</div>
    <div v-if="submitted && !dialogVisible" class="cb-notice" role="status">
      {{ text('有一笔操作正在等待确认，请勿重复提交。', 'An action is awaiting confirmation. Do not resubmit.') }}
      <a :href="`https://bscscan.com/tx/${submitted}`" target="_blank" rel="noopener noreferrer">{{ text('查看交易', 'View transaction') }}</a>
      <button :disabled="busy" @click="checkSubmitted">{{ text('检查结果', 'Check result') }}</button>
    </div>

    <div class="cb-overview">
      <section class="cb-card cb-account" :aria-label="text('买币账户', 'Trading account')">
        <div class="cb-card-top"><span class="cb-card-title"><Wallet />{{ text('买币账户', 'Trading account') }}</span><span class="cb-badge" :class="{ 'cb-badge-live': enabled }"><span></span>{{ status }}</span></div>
        <div class="cb-balance-label">{{ text('可用买币余额', 'Available trading balance') }}</div>
        <div class="cb-balance">{{ displayBalance }} <span>BNB</span></div>
        <div class="cb-fee-balance"><span>{{ text('买入手续费', 'Buy fee') }}</span><strong>{{ executionFee }} BNB / {{ text('笔', 'buy') }}</strong></div>
        <div v-if="needsConnection" class="cb-connection-hint">{{ connectionHint }}</div>
        <div v-else-if="checked && !unified" class="cb-connection-hint">{{ text('这是你的旧版买币账户，暂不支持充值或修改额度。你仍可提取余额、关闭授权；余额不会自动转入新版账户。', 'This is your previous trading account. Deposits and limit changes are unavailable. You can still withdraw funds or disable buys; funds will not move to the new account automatically.') }}</div>
        <div v-else-if="checked && !tradingAvailable" class="cb-connection-hint">{{ text('当前无法新增充值或授权。已有资金仍可提取，授权仍可撤销。', 'Deposits and new authorizations are unavailable. You can still withdraw funds or revoke authorization.') }}</div>
        <div v-else-if="checked && needsReauthorization" class="cb-connection-hint">{{ text('买入手续费已更新，请重新确认授权后再发买币评论。', 'The buy fee has changed. Confirm your authorization again before posting a buy comment.') }}</div>
        <div v-else-if="checked && activeGrant && !funded" class="cb-connection-hint">{{ text('请补充买币余额，本金和费用均从此余额扣除。', 'Add funds. Buy amounts and fees use this same balance.') }}</div>
        <div class="cb-account-actions">
          <button class="cb-button cb-primary" :disabled="locked || refreshing || (!needsConnection && checked && !tradingAvailable)" @click="primaryAction">{{ primaryLabel }}<ArrowRight /></button>
          <button class="cb-button cb-secondary" :disabled="!ready || locked || balance === 0n" @click="open('withdraw')">{{ text('提取', 'Withdraw') }}</button>
        </div>
        <div class="cb-recipient"><span>{{ text('代币接收钱包', 'Tokens arrive in') }}</span><a v-if="user" :href="`https://bscscan.com/address/${user}`" :title="user" target="_blank" rel="noopener noreferrer">{{ shortAddress(user) }} ↗</a><span v-else>{{ text('连接后显示', 'Connect to view') }}</span></div>
        <p class="cb-separate"><Lock />{{ text('仅用于买币，与打赏余额和授权完全独立', 'Separate from your tipping balance and authorization') }}</p>
        <button v-if="checked && grant?.[10]" class="cb-text-button cb-danger-text" :disabled="!ready || locked" @click="open('revoke')">{{ text('关闭评论买币', 'Disable comment buys') }}</button>
      </section>

      <section class="cb-card cb-guide" :aria-label="text('如何使用', 'How it works')">
        <div class="cb-card-top"><span class="cb-card-title">{{ text('从这里开始', 'Start here') }}</span><span class="cb-small-label">{{ text('3 步完成设置', '3 SIMPLE STEPS') }}</span></div>
        <ol class="cb-steps">
          <li :class="{ 'cb-step-done': signedIn && connected }"><span class="cb-step-number"><Check v-if="signedIn && connected" /><template v-else>1</template></span><div><strong>{{ text('连接你的钱包', 'Connect your wallet') }}</strong><p>{{ text('使用发评论的 X 账号及其绑定钱包', 'Use your X account and its linked wallet') }}</p></div></li>
          <li :class="{ 'cb-step-done': checked && funded && activeGrant && !needsReauthorization }"><span class="cb-step-number"><Check v-if="checked && funded && activeGrant && !needsReauthorization" /><template v-else>2</template></span><div><strong>{{ text('充值并设置授权', 'Fund & set limits') }}</strong><p>{{ text('一次填写，一笔交易完成；已有设置自动带入', 'One form, one transaction. Existing settings are prefilled.') }}</p></div></li>
          <li><span class="cb-step-number">3</span><div><strong>{{ text('去 X 评论买币', 'Reply on X to buy') }}</strong><p>{{ text('回复明确包含一个代币的原帖，本金和费用从买币余额扣除', 'Reply to a post identifying one token. Principal and fees use your trading balance.') }}</p></div></li>
        </ol>
        <div class="cb-command"><ChatDotRound /><code>{{ command }}</code><button class="cb-icon-button" :aria-label="text('复制买币指令', 'Copy buy command')" @click="copyCommand"><Check v-if="copied" /><CopyDocument v-else /></button></div>
        <span v-if="copied" class="cb-copy-feedback" role="status">{{ text('已复制，请粘贴到目标代币帖子的回复中。', 'Copied. Paste it as a reply to the target token post.') }}</span>
        <p class="cb-guide-note">{{ text('示例为真实买入 0.001 BNB；本金之外另收费用。', 'This command spends 0.001 BNB in principal, plus fees.') }}</p>
      </section>
    </div>

    <section class="cb-card cb-history">
      <div class="cb-section-heading"><div class="cb-card-title">{{ text('最近买入', 'Recent buys') }}<span v-if="orders.length" class="cb-count">{{ orders.length }}</span></div><span class="cb-small-label">{{ text('结果在这里查看，不自动回复 X', 'RESULTS HERE · NO AUTOMATIC X REPLIES') }}</span></div>
      <div v-if="historyError" class="cb-history-empty"><Document /><strong>{{ text('订单暂时无法加载', 'Orders could not be loaded') }}</strong><button class="cb-text-button" @click="refresh">{{ text('重新加载', 'Retry') }}</button></div>
      <div v-else-if="!orders.length" class="cb-history-empty"><span class="cb-empty-icon"><ChatDotRound /></span><strong>{{ text('下一笔买入，从一条评论开始', 'Your next buy starts with a comment') }}</strong><p>{{ text('完成授权后，订单状态和链上凭证会显示在这里。', 'After authorization, your order status and on-chain receipts will appear here.') }}</p></div>
      <div v-else class="cb-order-list">
        <article v-for="order in orders" :key="order.replyId" class="cb-order">
          <div class="cb-order-line"><span class="cb-order-icon"><Check v-if="order.state === 'confirmed'" /><Document v-else /></span><div class="cb-order-summary"><strong>{{ order.state === 'confirmed' && order.settlement?.token ? shortAddress(order.settlement.token) : text('评论买币', 'Comment buy') }}</strong><span>{{ dateLabel(order.createdAt) }}</span></div><div class="cb-order-result"><strong v-if="order.settlement?.total">−{{ amount(order.settlement.total) }} BNB</strong><span class="cb-order-status" :class="`cb-order-${order.state}`">{{ orderLabel(order) }}</span></div></div>
          <p v-if="order.reason" class="cb-order-reason">{{ orderReason(order.reason) }}</p>
          <details class="cb-order-details"><summary>{{ text('订单详情', 'Order details') }}</summary><div class="cb-detail-content"><div v-if="order.settlement?.principal">{{ text('买入本金', 'Buy principal') }}<span>{{ amount(order.settlement.principal) }} BNB</span></div><div v-if="order.settlement?.total">{{ text('实际总扣款', 'Total deducted') }}<span>{{ amount(order.settlement.total) }} BNB</span></div><div v-if="order.reason">{{ text('原因代码', 'Reason code') }}<code>{{ order.reason }}</code></div><div class="cb-order-links"><a :href="`https://x.com/i/status/${order.replyId}`" target="_blank" rel="noopener noreferrer">{{ text('查看 X 评论', 'View X reply') }} ↗</a><a v-if="order.txHash" :href="`https://bscscan.com/tx/${order.txHash}`" target="_blank" rel="noopener noreferrer">{{ text('查看链上交易', 'View transaction') }} ↗</a></div></div></details>
        </article>
      </div>
    </section>

    <details class="cb-disclosure"><summary>{{ text('费用与使用说明', 'Fees & how it works') }}</summary><div class="cb-disclosure-body">
      <p><strong>{{ text('如何收费', 'Fees') }}</strong><br />{{ text('每笔买入成功收取', 'Each successful buy costs') }} {{ executionFee }} BNB。{{ text('买入失败，不扣买入金额和手续费。代币交易本身的费用另计，部分会从买入的代币中扣除，不再重复扣 BNB。', 'Failed buys do not deduct the buy amount or fees. Token trading fees are additional; some are deducted from the tokens you receive, without a second BNB charge.') }}<template v-if="config && config.platformFeeBps > 0"> {{ text('另收平台服务费', 'Additional service fee:') }} {{ serviceFee }}。</template></p>
      <p><strong>{{ text('成交保护', 'Trade protection') }}</strong><br />{{ text('实际到账数量比报价少超过', 'If the tokens received fall more than') }} {{ slippagePercent }}%{{ text('，买入不会完成。所有扣款都受你设置的额度限制。', ' below the quote, the buy will not complete. All spending stays within your limits.') }}</p>
      <p><strong>{{ text('如何使用', 'How to use') }}</strong><br />{{ text('支持 TagAI 已收录、可交易的 BNB Chain 代币。直接回复代币原帖，发出后不要编辑。评论超过 3 分钟未执行将失效。', 'Buy supported BNB Chain tokens listed on TagAI. Reply directly to the token post without editing your comment. Unexecuted commands expire after 3 minutes.') }}</p>
      <p><strong>{{ text('充值与提现', 'Deposits & withdrawals') }}</strong><br />{{ text('买入金额和费用统一从买币余额扣除，未使用的余额可随时提取。充值、修改授权和提现需另付网络费。', 'Buys and fees use the same trading balance. Withdraw unused funds anytime. Deposits, authorization changes and withdrawals require a network fee.') }}</p>
      <a v-if="config" :href="`https://bscscan.com/address/${config.vault}`" :title="config.vault" target="_blank" rel="noopener noreferrer">{{ text('查看资金合约', 'View funds contract') }} ↗</a>
    </div></details>

    <el-dialog v-model="dialogVisible" class="cb-dialog" width="min(560px, calc(100vw - 24px))" align-center :show-close="false" :close-on-click-modal="!busy" :close-on-press-escape="!busy" :title="dialogTitle" destroy-on-close>
      <template #header><div class="cb-dialog-header"><div><div class="cb-eyebrow">{{ text('评论买币', 'COMMENT BUY') }} <span class="cb-eyebrow-divider">/</span> BNB CHAIN</div><h3>{{ dialogTitle }}</h3></div><button class="cb-icon-button" :disabled="busy" :aria-label="text('关闭弹窗', 'Close dialog')" @click="dialogVisible = false"><Close /></button></div></template>
      <div class="comment-buy cb-dialog-body">
        <fieldset :disabled="locked" class="cb-fieldset">
          <template v-if="dialog === 'deposit'">
            <p class="cb-modal-intro">{{ text('在这里充值或修改授权。买币本金和费用统一从账户余额扣除。', 'Add funds or change authorization here. Buys and fees use your trading balance.') }}</p>
            <label class="cb-field"><span>{{ text('充值金额', 'Deposit amount') }}</span><div class="cb-amount-input"><input v-model="form.amount" inputmode="decimal" autocomplete="off" /><span>BNB</span></div><small>{{ text('不充值可填写 0，仅设置或修改授权，仍需支付网络费。', 'Enter 0 to set or change authorization without depositing. A network fee still applies.') }}</small></label>
            <div class="cb-presets"><button v-for="preset in ['0', '0.01', '0.05', '0.1']" :key="preset" type="button" :class="{ selected: form.amount === preset }" @click="form.amount = preset">{{ preset === '0' ? text('不充值', 'No deposit') : `${preset} BNB` }}</button></div>
          </template>
          <template v-if="dialog === 'authorize' || dialog === 'deposit'">
            <p class="cb-modal-intro">{{ text('仅允许从买币账户扣款。所有限额都包含买入本金和费用。', 'Only funds in your trading account can be spent. Every limit includes principal and fees.') }}</p>
            <div class="cb-form-grid"><label class="cb-field"><span>{{ text('每笔最多', 'Per-order limit') }}</span><div class="cb-input"><input v-model="form.perTrade" inputmode="decimal" /><span>BNB</span></div></label><label class="cb-field"><span>{{ text('每天最多', 'Daily limit') }}</span><div class="cb-input"><input v-model="form.perDay" inputmode="decimal" /><span>BNB</span></div></label></div>
            <label class="cb-field"><span>{{ text('本次总授权额度', 'Total budget for this authorization') }}</span><div class="cb-input"><input v-model="form.budget" inputmode="decimal" /><span>BNB</span></div><small>{{ text('可累计花费的上限，不是充值金额。每日限额按 UTC 0 点重置。', 'Maximum cumulative spending, not a deposit. Daily limits reset at 00:00 UTC.') }}</small></label>
            <label class="cb-field"><span>{{ text('授权有效期', 'Authorization expiry') }}</span><select v-model="form.days"><option v-if="grant && grant[4] > BigInt(Math.floor(Date.now() / 1000))" value="keep">{{ text('保持原到期时间', 'Keep original expiry') }} · {{ expiry }}</option><option v-for="day in ['1', '7', '30', '90']" :key="day" :value="day">{{ text('从本次确认起', 'From confirmation:') }} {{ day }} {{ text('天', 'days') }}</option></select></label>
          </template>
          <template v-else-if="dialog === 'withdraw'">
            <p class="cb-modal-intro">{{ text('将全部买币余额提取到绑定钱包，不影响打赏资金。', 'Return the full trading balance to your linked wallet. Tip funds are unaffected.') }}</p>
            <div class="cb-checkout"><div class="cb-checkout-total"><span>{{ text('合计提取', 'Total withdrawal') }}</span><strong>{{ amount(balance) }} BNB</strong></div></div>
            <div class="cb-destination"><span>{{ text('接收钱包', 'Recipient wallet') }}</span><code>{{ user }}</code></div><p class="cb-modal-note">{{ text('提现不会撤销授权。如需停止后续买入，请先关闭评论买币。若有正在执行的订单，请等待确认后再提取。', 'Withdrawal does not revoke authorization. Disable comment buys to stop future execution. If an order is pending, wait for confirmation before withdrawing.') }}</p>
          </template>
          <template v-else-if="dialog === 'revoke'">
            <p class="cb-modal-intro">{{ text('关闭后，新的评论不能再从这个账户买币。已上链完成的买入不会撤回。', 'Once disabled, new comments cannot spend from this account. Completed buys are not reversed.') }}</p><div class="cb-checkout"><div><span>{{ text('保留在买币账户的资金', 'Funds remaining in this account') }}</span><strong>{{ amount(balance) }} BNB</strong></div></div><p class="cb-modal-note">{{ text('资金不会自动提现，你仍可随时提取。Tip 打赏授权不受影响。', 'Funds are not withdrawn automatically. You can withdraw anytime. Tip authorization is unaffected.') }}</p>
          </template>
        </fieldset>
      </div>
      <template #footer>
        <div class="comment-buy cb-dialog-footer">
          <p v-if="formIssue" class="cb-form-error" role="alert">{{ formIssue }}</p>
          <div v-if="error" class="cb-notice cb-notice-error" role="alert">{{ error }}</div>
          <div v-if="busy" class="cb-notice" role="status"><Refresh class="cb-spin" />{{ transactionStage || text('正在检查交易结果…', 'Checking transaction…') }}</div>
          <p v-if="!ready && !locked" class="cb-form-error" role="alert">{{ needsConnection ? connectionHint : text('交易数据暂不可用，请关闭弹窗后刷新。', 'Trading data unavailable. Close this dialog and refresh.') }}</p>
          <div v-if="submitted" class="cb-pending"><a :href="`https://bscscan.com/tx/${submitted}`" target="_blank" rel="noopener noreferrer">{{ text('查看已提交交易', 'View submitted transaction') }} ↗</a><button class="cb-text-button" :disabled="busy" @click="checkSubmitted">{{ text('检查结果', 'Check result') }}</button></div>
          <button v-else class="cb-button cb-primary cb-submit" :class="{ 'cb-destructive': dialog === 'revoke' }" :disabled="!canSubmit" @click="dialog && action(dialog)">{{ busy ? text('请稍候…', 'Please wait…') : submitLabel }}<ArrowRight v-if="!busy" /></button>
          <p class="cb-modal-footer">{{ text('请核对钱包中显示的收款地址和金额后再确认。', 'Check the recipient address and amount shown in your wallet before confirming.') }}</p>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped src="./comment-buy.css"></style>
<style>
.el-dialog.cb-dialog { display: flex; flex-direction: column; max-height: calc(100dvh - 40px); overflow: hidden; background: var(--surface); border: 1px solid var(--border-base); border-radius: 22px; padding: 26px; --el-dialog-padding-primary: 0; --el-dialog-margin-top: 5vh; }
.cb-dialog .el-dialog__header { display: block; flex-shrink: 0; padding: 0; margin: 0; }
.cb-dialog .el-dialog__body { padding: 0; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.cb-dialog .el-dialog__footer { flex-shrink: 0; padding: 0; text-align: left; }
@media (max-width: 803px) { .el-overlay .el-dialog.cb-dialog { padding: 20px 20px max(20px, env(safe-area-inset-bottom)); max-height: 88dvh; overflow: hidden; } }
</style>
