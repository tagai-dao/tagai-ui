<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatEther } from 'viem'
import { ChatDotRound, Wallet, Setting, Refresh, CopyDocument, ArrowRight, Check, Close, Document, Lock } from '@element-plus/icons-vue'
import { useCommentBuyAuthorization, type CommentBuyOrder } from '@/composables/useCommentBuyAuthorization'

const {
  text, config, grant, principalBalance, feeBalance, checked, refreshing, busy,
  error, loadError, historyError, success, submitted, transactionStage, dialog, dialogVisible, advanced,
  orders, form, user, signedIn, connected, ready, tradingAvailable, activeGrant, funded, locked,
  depositTotal, formIssue, needsConnection, connectionLabel, connectionHint, onBsc,
  connect, refresh, open, action, checkSubmitted,
} = useCommentBuyAuthorization()
const copied = ref(false)
const command = '@TagAIDAO buy 0.001BNB'
const shortAddress = (address?: string) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'
const amount = (value: bigint | string | undefined) => { try { return formatEther(BigInt(value ?? 0)) } catch { return '—' } }
const displayBalance = computed(() => checked.value && user.value ? amount(principalBalance.value) : '—')
const status = computed(() => {
  if (!onBsc.value) return text('仅支持 BNB Chain', 'BNB Chain only')
  if (loadError.value) return text('数据暂不可用', 'Data unavailable')
  if (!checked.value) return text('读取中', 'Loading')
  if (!tradingAvailable.value) return text('服务已暂停', 'Service paused')
  if (!activeGrant.value) return text('未开启', 'Not enabled')
  if (!funded.value) return text('待充值', 'Needs funds')
  return text('已开启', 'Enabled')
})
const enabled = computed(() => checked.value && tradingAvailable.value && activeGrant.value && funded.value)
const primaryLabel = computed(() => needsConnection.value ? connectionLabel.value : !checked.value ? text('重新读取', 'Retry') : !tradingAvailable.value ? text('服务暂不可用', 'Service unavailable') : !funded.value ? text('充值买币资金', 'Fund comment buys') : !activeGrant.value ? text('设置额度并开启', 'Set limits & enable') : text('充值', 'Add funds'))
function primaryAction() {
  if (needsConnection.value) connect()
  else if (!checked.value) void refresh()
  else open(!funded.value || activeGrant.value ? 'deposit' : 'authorize')
}
const expiry = computed(() => grant.value ? new Date(Number(grant.value[4]) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—')
const dialogTitle = computed(() => ({
  deposit: text('充值买币资金', 'Fund comment buys'),
  authorize: activeGrant.value ? text('管理买币授权', 'Manage authorization') : text('开启评论买币', 'Enable comment buys'),
  withdraw: text('提取买币资金', 'Withdraw trading funds'),
  revoke: text('关闭评论买币？', 'Disable comment buys?'), '': '',
})[dialog.value])
const submitLabel = computed(() => dialog.value === 'deposit' ? text('确认充值', 'Confirm deposit') : dialog.value === 'authorize' ? text('签名并确认授权', 'Sign & authorize') : dialog.value === 'withdraw' ? text('确认提取全部', 'Withdraw all funds') : text('确认关闭', 'Confirm disable'))
const canSubmit = computed(() => ready.value && !locked.value && !formIssue.value &&
  ((dialog.value === 'deposit' || dialog.value === 'authorize') ? tradingAvailable.value : true) &&
  (dialog.value !== 'withdraw' || principalBalance.value + feeBalance.value > 0n))
const serviceFee = computed(() => config.value ? `${Number(config.value.platformFeeBps) / 100}%` : '—')
const executionFee = computed(() => config.value ? amount(config.value.executionFeeWei) : '—')
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
    INSUFFICIENT_FUNDS: text('买币本金或手续费余额不足。', 'Insufficient trading or fee balance.'),
    LIMIT_EXCEEDED: text('本次买入含费用的金额超过授权限额。', 'The buy including fees exceeds your spending limit.'),
    FEE_CAP: text('费用超过你设置的上限，订单未执行。', 'Fees exceed your chosen cap. The order was not executed.'),
    PROTOCOL_FEE_CAP: text('平台与协议费用合计超过你的费率上限，订单未执行。', 'Combined service and protocol fees exceed your cap. No buy was executed.'),
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
        <div class="cb-balance-label">{{ text('可用买币本金', 'Available buy principal') }}</div>
        <div class="cb-balance">{{ displayBalance }} <span>BNB</span></div>
        <div class="cb-fee-balance"><span>{{ text('手续费余额', 'Fee balance') }}</span><strong>{{ checked && user ? amount(feeBalance) : '—' }} BNB</strong></div>
        <div v-if="needsConnection" class="cb-connection-hint">{{ connectionHint }}</div>
        <div v-else-if="checked && !tradingAvailable" class="cb-connection-hint">{{ text('当前无法新增充值或授权。已有资金仍可提取，授权仍可撤销。', 'Deposits and new authorizations are unavailable. You can still withdraw funds or revoke authorization.') }}</div>
        <div v-else-if="checked && activeGrant && !funded" class="cb-connection-hint">{{ text('授权已开启，请补充买币本金及手续费余额后再发评论。', 'Authorization is active. Add trading and fee funds before commenting.') }}</div>
        <div class="cb-account-actions">
          <button class="cb-button cb-primary" :disabled="locked || refreshing || (!needsConnection && checked && !tradingAvailable)" @click="primaryAction">{{ primaryLabel }}<ArrowRight /></button>
          <button class="cb-button cb-secondary" :disabled="!ready || locked || principalBalance + feeBalance === 0n" @click="open('withdraw')">{{ text('提取', 'Withdraw') }}</button>
        </div>
        <div class="cb-recipient"><span>{{ text('代币接收钱包', 'Tokens arrive in') }}</span><a v-if="user" :href="`https://bscscan.com/address/${user}`" :title="user" target="_blank" rel="noopener noreferrer">{{ shortAddress(user) }} ↗</a><span v-else>{{ text('连接后显示', 'Connect to view') }}</span></div>
        <p class="cb-separate"><Lock />{{ text('仅用于买币，与打赏余额和授权完全独立', 'Separate from your tipping balance and authorization') }}</p>
      </section>

      <section class="cb-card cb-guide" :aria-label="text('如何使用', 'How it works')">
        <div class="cb-card-top"><span class="cb-card-title">{{ text('从这里开始', 'Start here') }}</span><span class="cb-small-label">{{ text('3 步完成设置', '3 SIMPLE STEPS') }}</span></div>
        <ol class="cb-steps">
          <li :class="{ 'cb-step-done': signedIn && connected }"><span class="cb-step-number"><Check v-if="signedIn && connected" /><template v-else>1</template></span><div><strong>{{ text('连接你的钱包', 'Connect your wallet') }}</strong><p>{{ text('使用发评论的 X 账号及其绑定钱包', 'Use your X account and its linked wallet') }}</p></div></li>
          <li :class="{ 'cb-step-done': checked && funded }"><span class="cb-step-number"><Check v-if="checked && funded" /><template v-else>2</template></span><div><strong>{{ text('充值买币资金', 'Fund your trading account') }}</strong><p>{{ text('本金与费用独立记账，未使用的资金可提取', 'Separate fee funds. Withdraw unused funds anytime.') }}</p></div></li>
          <li :class="{ 'cb-step-done': checked && activeGrant }"><span class="cb-step-number"><Check v-if="checked && activeGrant" /><template v-else>3</template></span><div><strong>{{ text('开启授权，去 X 评论', 'Enable, then reply on X') }}</strong><p>{{ text('设置额度后，直接回复明确包含一个代币的原帖', 'Set limits, then reply to a post identifying one token') }}</p></div></li>
        </ol>
        <div class="cb-command"><ChatDotRound /><code>{{ command }}</code><button class="cb-icon-button" :aria-label="text('复制买币指令', 'Copy buy command')" @click="copyCommand"><Check v-if="copied" /><CopyDocument v-else /></button></div>
        <span v-if="copied" class="cb-copy-feedback" role="status">{{ text('已复制，请粘贴到目标代币帖子的回复中。', 'Copied. Paste it as a reply to the target token post.') }}</span>
        <p class="cb-guide-note">{{ text('示例为真实买入 0.001 BNB；本金之外另收费用。', 'This command spends 0.001 BNB in principal, plus fees.') }}</p>
      </section>
    </div>

    <section class="cb-card cb-authorization">
      <div class="cb-section-heading"><div class="cb-card-title"><Setting />{{ text('我的交易授权', 'My trading authorization') }}</div><button v-if="checked && grant && grant[5] > 0n" class="cb-text-button" :disabled="!ready || locked || !tradingAvailable" @click="open('authorize')">{{ text('管理额度', 'Manage limits') }} <ArrowRight /></button></div>
      <div v-if="checked && grant && grant[5] > 0n" class="cb-grant-grid">
        <div><span>{{ text('剩余授权额度', 'Remaining budget') }}</span><strong>{{ amount(grant[0]) }} <small>BNB</small></strong></div>
        <div><span>{{ text('每笔最多', 'Per order') }}</span><strong>{{ amount(grant[1]) }} <small>BNB</small></strong></div>
        <div><span>{{ text('每天最多 · UTC', 'Per day · UTC') }}</span><strong>{{ amount(grant[2]) }} <small>BNB</small></strong></div>
        <div><span>{{ text('授权有效至', 'Expires on') }}</span><strong>{{ expiry }} <small v-if="!activeGrant">{{ text('未生效', 'Inactive') }}</small></strong></div>
      </div>
      <div v-else class="cb-authorization-empty"><div><strong>{{ text('由你决定，每次能花多少。', 'You decide how much each buy can spend.') }}</strong><p>{{ text('设置单笔、每日和总额度后开启。授权不会转走钱包中的其他资产。', 'Set per-order, daily and total limits. Authorization does not access other assets in your wallet.') }}</p></div><button class="cb-button cb-secondary" :disabled="!ready || locked || !tradingAvailable" @click="open('authorize')">{{ text('设置授权', 'Set up authorization') }}</button></div>
      <div v-if="checked && grant && grant[5] > 0n" class="cb-grant-footer"><span>{{ text('额度包含本金与费用，不等于账户余额。', 'Limits include principal and fees; they are not your balance.') }}</span><button v-if="grant[11]" class="cb-text-button cb-danger-text" :disabled="!ready || locked" @click="open('revoke')">{{ text('关闭评论买币', 'Disable comment buys') }}</button></div>
    </section>

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

    <details class="cb-disclosure"><summary>{{ text('费用、支持范围与资金安全', 'Fees, supported tokens & fund controls') }}</summary><div class="cb-disclosure-body">
      <p>{{ text('平台服务费', 'Service fee') }} {{ serviceFee }} · {{ text('每笔执行费', 'Execution fee') }} {{ executionFee }} BNB。{{ text('交易协议费另计，平台与协议费用共同受你的费率上限约束。', 'Protocol fees are additional. Service and protocol fees share your chosen fee cap.') }}</p>
      <p>{{ text('部分导入代币的协议费从买入代币中扣除，也计入费率上限，不重复扣 BNB。超过额度、费率或滑点限制的订单不会执行。', 'Some imported tokens deduct protocol fees from the output tokens. These count toward the fee cap and are not charged again in BNB. Orders beyond your limits do not execute.') }}</p>
      <p>{{ text('仅支持 TagAI 已注册且有受支持交易路径的 BSC 代币。直接回复原帖，不要编辑评论；指令有效期为 3 分钟。', 'Only registered BSC tokens with supported trading routes are eligible. Reply directly without editing. Commands expire after 3 minutes.') }}</p>
      <p>{{ text('买币失败不扣本金与订单费用，执行交易的 gas 由 Keeper 承担。你自己的充值、授权和提现交易仍需钱包支付 gas。', 'Failed buys do not debit principal or order fees; the keeper pays execution gas. Your deposit, authorization and withdrawal transactions require wallet gas.') }}</p>
      <a v-if="config" :href="`https://bscscan.com/address/${config.vault}`" target="_blank" rel="noopener noreferrer">CommentTradeVault · {{ config.vault }} ↗</a>
    </div></details>

    <el-dialog v-model="dialogVisible" class="cb-dialog" width="min(560px, calc(100vw - 24px))" align-center :show-close="false" :close-on-click-modal="!busy" :close-on-press-escape="!busy" :title="dialogTitle" destroy-on-close>
      <template #header><div class="cb-dialog-header"><div><div class="cb-eyebrow">{{ text('评论买币', 'COMMENT BUY') }} <span class="cb-eyebrow-divider">/</span> BNB CHAIN</div><h3>{{ dialogTitle }}</h3></div><button class="cb-icon-button" :disabled="busy" :aria-label="text('关闭弹窗', 'Close dialog')" @click="dialogVisible = false"><Close /></button></div></template>
      <div class="comment-buy cb-dialog-body">
        <fieldset :disabled="locked" class="cb-fieldset">
          <template v-if="dialog === 'deposit'">
            <p class="cb-modal-intro">{{ text('这笔充值只进入买币账户，不会增加 Tip 打赏余额。', 'This deposit funds comment buys only, not your Tip balance.') }}</p>
            <label class="cb-field"><span>{{ text('买币本金', 'Buy principal') }}</span><div class="cb-amount-input"><input v-model="form.principal" inputmode="decimal" autocomplete="off" /><span>BNB</span></div></label>
            <div class="cb-presets"><button v-for="preset in ['0.001', '0.01', '0.05']" :key="preset" type="button" :class="{ selected: form.principal === preset }" @click="form.principal = preset">{{ preset }} BNB</button></div>
            <label class="cb-field"><span>{{ text('预存手续费', 'Fee reserve') }}</span><div class="cb-input"><input v-model="form.fees" inputmode="decimal" autocomplete="off" /><span>BNB</span></div><small>{{ text('用于平台与协议费用；不是本次立即扣除的费用，未使用的部分可提取。', 'Reserved for service and protocol fees, not charged now. Unused funds can be withdrawn.') }}</small></label>
            <div class="cb-checkout"><div><span>{{ text('本次存入合计', 'Total deposit') }}</span><strong>{{ depositTotal === null ? '—' : amount(depositTotal) }} BNB</strong></div><small>{{ text('另需支付钱包交易 gas', 'Wallet network gas is additional') }}</small></div>
            <div class="cb-destination"><span>{{ text('收款合约 · 不是打赏合约', 'Destination · not the tipping contract') }}</span><a v-if="config" :href="`https://bscscan.com/address/${config.vault}`" target="_blank" rel="noopener noreferrer">CommentTradeVault ↗<code>{{ config.vault }}</code></a></div>
            <p class="cb-modal-note">{{ activeGrant ? text('充值不会提高现有授权额度。', 'Depositing does not increase your existing spending limits.') : text('充值后还需开启授权，才会执行买币评论。', 'After funding, enable authorization before posting a buy comment.') }}</p>
          </template>
          <template v-else-if="dialog === 'authorize'">
            <p class="cb-modal-intro">{{ text('仅允许从买币账户扣款。所有限额都包含买入本金和费用。', 'Only funds in your trading account can be spent. Every limit includes principal and fees.') }}</p>
            <div class="cb-form-grid"><label class="cb-field"><span>{{ text('每笔最多', 'Per-order limit') }}</span><div class="cb-input"><input v-model="form.perTrade" inputmode="decimal" /><span>BNB</span></div></label><label class="cb-field"><span>{{ text('每天最多', 'Daily limit') }}</span><div class="cb-input"><input v-model="form.perDay" inputmode="decimal" /><span>BNB</span></div></label></div>
            <label class="cb-field"><span>{{ text('本次总授权额度', 'Total budget for this authorization') }}</span><div class="cb-input"><input v-model="form.budget" inputmode="decimal" /><span>BNB</span></div><small>{{ text('可累计花费的上限，不是充值金额。每日限额按 UTC 0 点重置。', 'Maximum cumulative spending, not a deposit. Daily limits reset at 00:00 UTC.') }}</small></label>
            <label class="cb-field"><span>{{ text('有效期 · 从本次确认起', 'Valid for · from this confirmation') }}</span><select v-model="form.days"><option v-for="day in [...new Set(['1', '7', '30', '90', form.days])]" :key="day" :value="day">{{ day }} {{ text('天', 'days') }}</option></select></label>
            <button class="cb-advanced-toggle" type="button" :aria-expanded="advanced" aria-controls="cb-advanced-fields" @click="advanced = !advanced"><span><Setting />{{ text('交易保护', 'Trade protection') }}</span><span>{{ form.feePercent }}% {{ text('费率上限', 'fee cap') }} · {{ form.slippagePercent }}% {{ text('滑点', 'slippage') }} {{ advanced ? '−' : '+' }}</span></button>
            <div v-if="advanced" id="cb-advanced-fields" class="cb-advanced-fields"><div class="cb-form-grid"><label class="cb-field"><span>{{ text('平台及协议费总上限', 'Service + protocol fee cap') }}</span><div class="cb-input"><input v-model="form.feePercent" inputmode="decimal" /><span>%</span></div></label><label class="cb-field"><span>{{ text('最大滑点', 'Maximum slippage') }}</span><div class="cb-input"><input v-model="form.slippagePercent" inputmode="decimal" /><span>%</span></div></label></div><label class="cb-field"><span>{{ text('单笔执行费上限', 'Execution fee cap per order') }}</span><div class="cb-input"><input v-model="form.executionFee" inputmode="decimal" /><span>BNB</span></div></label><p class="cb-modal-note">{{ text('超过你设置的上限会拒绝买入，不会自动提高授权。', 'Buys exceeding your caps are rejected. Limits are never raised automatically.') }}</p></div>
            <div class="cb-authorization-review"><Lock /><p>{{ text('当前服务费', 'Current service fee') }} {{ serviceFee }} + {{ text('交易协议费；执行费', 'protocol fees; execution fee') }} {{ executionFee }} BNB。<br />{{ text('钱包将先请求验证签名，再请求一笔链上授权交易。', 'Your wallet will request a verification signature, then an on-chain authorization transaction.') }}</p></div>
            <p v-if="grant && grant[5] > 0n" class="cb-modal-note">{{ text('保存将替换剩余额度和有效期，不叠加额度，也不重置今日已用额度。', 'Saving replaces the remaining budget and expiry. It does not add budgets or reset today’s spending.') }}</p>
          </template>
          <template v-else-if="dialog === 'withdraw'">
            <p class="cb-modal-intro">{{ text('将买币账户的全部本金和费用余额提取到绑定钱包，不影响打赏资金。', 'Return all trading principal and fee funds to your linked wallet. Tip funds are unaffected.') }}</p>
            <div class="cb-checkout"><div><span>{{ text('买币本金', 'Buy principal') }}</span><strong>{{ amount(principalBalance) }} BNB</strong></div><div><span>{{ text('手续费余额', 'Fee balance') }}</span><strong>{{ amount(feeBalance) }} BNB</strong></div><div class="cb-checkout-total"><span>{{ text('合计提取', 'Total withdrawal') }}</span><strong>{{ amount(principalBalance + feeBalance) }} BNB</strong></div></div>
            <div class="cb-destination"><span>{{ text('接收钱包', 'Recipient wallet') }}</span><code>{{ user }}</code></div><p class="cb-modal-note">{{ text('提现不会撤销授权。如需停止后续买入，请先关闭评论买币。若有正在执行的订单，请等待确认后再提取。', 'Withdrawal does not revoke authorization. Disable comment buys to stop future execution. If an order is pending, wait for confirmation before withdrawing.') }}</p>
          </template>
          <template v-else-if="dialog === 'revoke'">
            <p class="cb-modal-intro">{{ text('关闭后，新的评论不能再从这个账户买币。已上链完成的买入不会撤回。', 'Once disabled, new comments cannot spend from this account. Completed buys are not reversed.') }}</p><div class="cb-checkout"><div><span>{{ text('保留在买币账户的资金', 'Funds remaining in this account') }}</span><strong>{{ amount(principalBalance + feeBalance) }} BNB</strong></div></div><p class="cb-modal-note">{{ text('资金不会自动提现，你仍可随时提取。Tip 打赏授权不受影响。', 'Funds are not withdrawn automatically. You can withdraw anytime. Tip authorization is unaffected.') }}</p>
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
          <p class="cb-modal-footer">{{ text('请核对钱包中的目标合约与金额后再确认。', 'Verify the destination contract and amount in your wallet before confirming.') }}</p>
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
