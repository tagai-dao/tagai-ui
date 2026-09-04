<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatUnits, getAddress, isAddress, parseUnits, type Address } from 'viem'
import { useBasketDetail } from '@/composables/baskets/useBasketDetail'
import { feeSplit } from '@/utils/baskets/fee-model'
import { erc20Abi, getBasketFeeAuctionAbi, getBasketTokenAbi } from '@/utils/baskets/abis'
import { friendlyBasketError, sanitizeBasketAmountInput } from '@/utils/baskets/trade'
import { BASKET_FRONTEND_FEE_WALLET, getBasketDeployment, getBasketProtocol } from '@/config/baskets'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import BasketChainGate from './components/BasketChainGate.vue'

type Auction = { id: bigint; ethAmount: bigint; initialBid: bigint; highestBid: bigint; highestBidder: Address; startTime: number; endTime: number; settled: boolean }
const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const chainStore = useChainStore()
const modalStore = useModalStore()
const { detail, isLoading, hasError, errorMessage, load } = useBasketDetail()
const deployment = computed(() => getBasketDeployment(detail.value?.chainId ?? chainStore.activeChainId))
const contracts = computed(() => getBasketProtocol(
  deployment.value.chainId,
  detail.value?.version ?? deployment.value.creationVersion,
))
const tokenAbi = computed(() => getBasketTokenAbi(deployment.value.chainId, detail.value?.version))
const auctionAbi = computed(() => getBasketFeeAuctionAbi(deployment.value.chainId))
const address = computed(() => String(route.params.address || ''))
const account = computed(() => isAddress(accountStore.ethConnectAddress) ? getAddress(accountStore.ethConnectAddress) : undefined)
const now = ref(Date.now())
const loadingFees = ref(false)
const action = ref('')
const actionError = ref('')
const bidInput = ref('')
const withdrawInput = ref('')
const bidDecimals = ref(18)
const bidSymbol = ref('TagAgent')
const holderFees = ref(0n)
const frontendFees = ref(0n)
const creatorFees = ref(0n)
const launcherFees = ref(0n)
const feeReserve = ref(0n)
const availableEth = ref(0n)
const minAuctionEth = ref(0n)
const maxAuctionEth = ref(0n)
const lastAuctionAt = ref(0)
const cooldownSeconds = ref(0)
const nextAuctionId = ref(0n)
const activeAuctionId = ref(0n)
const availableBidTokens = ref(0n)
const claimableEth = ref(0n)
const bidBalance = ref(0n)
const bidAllowance = ref(0n)
const spotQuote = ref(0n)
const auctions = ref<Auction[]>([])
const timer = window.setInterval(() => { now.value = Date.now() }, 1_000)
onBeforeUnmount(() => window.clearInterval(timer))

const isBsc = computed(() => deployment.value.chainId === 56)
const feeCenterSubtitleKey = computed(() => isBsc.value ? 'buidlFeeCenterSubtitle' : 'feeCenterSubtitle')
const split = computed(() => detail.value ? feeSplit(detail.value.creatorShareBps, BASKET_FRONTEND_FEE_WALLET !== '0x0000000000000000000000000000000000000000') : null)
const feeParts = computed(() => split.value ? [
  { key: 'feeBurn', desc: isBsc.value ? 'buidlFeeBuybackDescription' : 'feeBuybackDescription', value: split.value.burn },
  { key: 'feeInterface', desc: 'feeFrontendDescription', value: split.value.interface },
  { key: 'feeLauncher', desc: 'feeLauncherDescription', value: split.value.launcher },
  { key: 'feeCreator', desc: 'feeCreatorDescription', value: split.value.creator },
  { key: 'feeHolders', desc: 'feeHoldersDescription', value: split.value.holders },
].filter((item) => item.value > 0) : [])
const activeAuction = computed(() => auctions.value.find((item) => item.id === activeAuctionId.value))
const auctionLot = computed(() => availableEth.value < maxAuctionEth.value ? availableEth.value : maxAuctionEth.value)
const openingBid = computed(() => spotQuote.value * 9_000n / 10_000n)
const minimumNextBid = computed(() => activeAuction.value ? (activeAuction.value.highestBid * 10_100n + 9_999n) / 10_000n : 0n)
const canCreateAuction = computed(() => !activeAuctionId.value && auctionLot.value >= minAuctionEth.value && now.value / 1000 >= lastAuctionAt.value + cooldownSeconds.value)
const isAuctionEnded = computed(() => !!activeAuction.value && now.value >= activeAuction.value.endTime * 1_000)

const formatToken = (value: bigint, decimals = 18, digits = 5) => Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: digits })
const short = (value?: string | null) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'
const pct = (value: number) => `${(value * 100).toFixed(value < .1 ? 2 : 1)}%`
const formatDate = (timestamp: number) => timestamp ? new Date(timestamp * 1_000).toLocaleString() : '—'
const normalizeAuction = (raw: any, id: bigint): Auction => ({
  id,
  ethAmount: BigInt(raw?.ethAmount ?? raw?.bnbAmount ?? raw?.[0] ?? 0),
  initialBid: BigInt(raw?.initialBid ?? raw?.[1] ?? 0),
  highestBid: BigInt(raw?.highestBid ?? raw?.[2] ?? 0),
  highestBidder: (raw?.highestBidder ?? raw?.[3]) as Address,
  startTime: Number(raw?.startTime ?? raw?.[4] ?? 0),
  endTime: Number(raw?.endTime ?? raw?.[5] ?? 0),
  settled: Boolean(raw?.settled ?? raw?.[6]),
})

const loadFees = async () => {
  if (!detail.value) return
  loadingFees.value = true
  try {
    const chainId = detail.value.chainId
    const client = getReadOnlyClient(chainId)
    const beneficiary = account.value ?? '0x0000000000000000000000000000000000000000'
    const basket = detail.value.address
    const calls = [
      { address: basket, abi: tokenAbi.value, functionName: 'claimableHolderFees', args: [beneficiary] },
      { address: basket, abi: tokenAbi.value, functionName: 'pendingFrontendFees', args: [beneficiary] },
      { address: basket, abi: tokenAbi.value, functionName: 'pendingCreatorFees' },
      { address: basket, abi: tokenAbi.value, functionName: 'pendingLauncherFees' },
      { address: basket, abi: tokenAbi.value, functionName: chainId === 56 ? 'feeReserveWbnb' : 'feeReserveWeth' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: chainId === 56 ? 'availableAuctionBnb' : 'availableAuctionEth' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: chainId === 56 ? 'minAuctionBnb' : 'minAuctionEth' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: chainId === 56 ? 'maxAuctionBnb' : 'maxAuctionEth' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'lastAuctionAt' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'cooldownSeconds' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'nextAuctionId' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'activeAuctionId' },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'availableBidTokens', args: [beneficiary] },
      { address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: chainId === 56 ? 'claimableBnb' : 'claimableEth', args: [beneficiary] },
      { address: contracts.value.bidToken, abi: erc20Abi, functionName: 'decimals' },
      { address: contracts.value.bidToken, abi: erc20Abi, functionName: 'symbol' },
      { address: contracts.value.bidToken, abi: erc20Abi, functionName: 'balanceOf', args: [beneficiary] },
      { address: contracts.value.bidToken, abi: erc20Abi, functionName: 'allowance', args: [beneficiary, contracts.value.feeAuction] },
    ]
    const rows = await client.multicall({ contracts: calls as any, allowFailure: true })
    const value = <T>(index: number, fallback: T) => rows[index]?.status === 'success' ? rows[index].result as T : fallback
    holderFees.value = value(0, 0n); frontendFees.value = value(1, 0n); creatorFees.value = value(2, 0n); launcherFees.value = value(3, 0n); feeReserve.value = value(4, 0n)
    availableEth.value = value(5, 0n); minAuctionEth.value = value(6, 0n); maxAuctionEth.value = value(7, 0n); lastAuctionAt.value = Number(value(8, 0n)); cooldownSeconds.value = Number(value(9, 0n)); nextAuctionId.value = value(10, 0n); activeAuctionId.value = value(11, 0n)
    availableBidTokens.value = value(12, 0n); claimableEth.value = value(13, 0n); bidDecimals.value = Number(value(14, 18)); bidSymbol.value = value(15, 'TagAgent'); bidBalance.value = value(16, 0n); bidAllowance.value = value(17, 0n)
    const first = nextAuctionId.value > 20n ? nextAuctionId.value - 19n : 1n
    const ids: bigint[] = []
    for (let id = nextAuctionId.value; id >= first && id > 0n; id -= 1n) ids.push(id)
    const history = ids.length ? await client.multicall({ contracts: ids.map((id) => ({ address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'auctions', args: [id] })) as any, allowFailure: true }) : []
    auctions.value = history.flatMap((row, index) => row.status === 'success' ? [normalizeAuction(row.result, ids[index])] : [])
    if (auctionLot.value > 0n) {
      try { spotQuote.value = await client.readContract({ address: contracts.value.feeAuction, abi: auctionAbi.value, functionName: 'quoteSpot', args: [auctionLot.value] } as any) as bigint } catch { spotQuote.value = 0n }
    }
  } finally { loadingFees.value = false }
}

const connectWallet = () => modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
const write = async (key: string, address: Address, abi: any, functionName: string, args: readonly unknown[]) => {
  if (!account.value) { connectWallet(); return }
  if (!detail.value || chainStore.activeChainId !== detail.value.chainId) return
  action.value = key; actionError.value = ''
  try {
    const client = getReadOnlyClient(detail.value.chainId)
    const wallet = getWalletClient()
    if (!wallet) throw new Error('Wallet not connected')
    const { request } = await client.simulateContract({ account: account.value, address, abi, functionName, args } as any)
    const hash = await wallet.writeContract(request as any)
    if (!await waitForTx(hash)) throw new Error('Transaction failed')
    await loadFees()
  } catch (error) { actionError.value = friendlyBasketError(error) } finally { action.value = '' }
}
const ensureAllowance = async (amount: bigint) => {
  const needed = amount > availableBidTokens.value ? amount - availableBidTokens.value : 0n
  if (needed <= bidAllowance.value) return true
  await write('approve', contracts.value.bidToken, erc20Abi, 'approve', [contracts.value.feeAuction, needed])
  return !actionError.value
}
const createAuction = async () => {
  const maxBid = openingBid.value * 10_200n / 10_000n
  if (!maxBid || !await ensureAllowance(maxBid)) return
  await write('create', contracts.value.feeAuction, auctionAbi.value, 'createAuction', [maxBid])
}
const placeBid = async () => {
  if (!activeAuction.value) return
  let amount = minimumNextBid.value
  try { if (bidInput.value) amount = parseUnits(bidInput.value, bidDecimals.value) } catch { actionError.value = 'Invalid bid amount'; return }
  if (amount < minimumNextBid.value) { actionError.value = 'Bid is below the minimum'; return }
  if (!await ensureAllowance(amount)) return
  await write('bid', contracts.value.feeAuction, auctionAbi.value, 'placeBid', [activeAuction.value.id, amount])
}
const onBidInput = (event: Event) => { bidInput.value = sanitizeBasketAmountInput((event.target as HTMLInputElement).value, bidDecimals.value) }
const onWithdrawInput = (event: Event) => { withdrawInput.value = sanitizeBasketAmountInput((event.target as HTMLInputElement).value, bidDecimals.value) }
const withdraw = async () => {
  let amount = availableBidTokens.value
  try { if (withdrawInput.value) amount = parseUnits(withdrawInput.value, bidDecimals.value) } catch { actionError.value = 'Invalid amount'; return }
  await write('withdraw', contracts.value.feeAuction, auctionAbi.value, 'withdrawBidTokens', [amount, account.value!])
}

onMounted(() => void load(address.value))
watch(address, (value) => void load(value))
watch(detail, () => void loadFees())
watch(account, () => void loadFees())
</script>

<template>
  <div class="fees-page"><div class="fees-shell">
    <button class="back" type="button" @click="router.push(`/baskets/${address}`)">← {{ $t('baskets.backToBasket') }}</button>
    <BasketChainGate />
    <div v-if="isLoading" class="state">{{ $t('baskets.loading') }}</div>
    <div v-else-if="hasError || !detail" class="state text-red-normal">{{ errorMessage || $t('baskets.loadFailed') }}</div>
    <template v-else>
      <header class="fee-hero">
        <div><span>{{ detail.symbol }} · {{ $t('baskets.feeCenter') }}</span><h1>{{ $t('baskets.feeCenterTitle') }}</h1><p>{{ $t(`baskets.${feeCenterSubtitleKey}`) }}</p></div>
        <strong>{{ (detail.basketFeeBps / 100).toFixed(2) }}%</strong>
      </header>

      <section class="panel"><div class="panel-title"><div><span>BREAKDOWN</span><h2>{{ $t('baskets.feeComposition') }}</h2></div></div>
        <div class="fee-parts"><article v-for="part in feeParts" :key="part.key"><strong>{{ pct(part.value) }}</strong><h3>{{ $t(`baskets.${part.key}`) }}</h3><p>{{ $t(`baskets.${part.desc}`) }}</p></article></div>
      </section>

      <section class="panel"><div class="panel-title"><div><span>CLAIMS</span><h2>{{ $t('baskets.feeClaims') }}</h2></div><button v-if="!account" class="primary small" @click="connectWallet">{{ $t('baskets.connectWallet') }}</button></div>
        <p class="panel-copy">{{ $t('baskets.publicClaimHint') }}</p>
        <div class="claim-grid">
          <article><span>{{ $t('baskets.holderClaim') }}</span><strong>{{ formatToken(holderFees) }} {{ deployment.wrappedNativeSymbol }}</strong><button :disabled="!account || !holderFees || !!action" @click="write('holder', detail.address, tokenAbi, 'claimHolderFeesFor', [account!])">{{ action === 'holder' ? $t('baskets.claiming') : $t('baskets.claim') }}</button></article>
          <article><span>{{ $t('baskets.frontendClaim') }}</span><strong>{{ formatToken(frontendFees) }} {{ deployment.wrappedNativeSymbol }}</strong><button :disabled="!account || !frontendFees || !!action" @click="write('frontend', detail.address, tokenAbi, 'claimFrontendFeesFor', [account!])">{{ action === 'frontend' ? $t('baskets.claiming') : $t('baskets.claim') }}</button></article>
          <article><span>{{ $t('baskets.creatorClaim') }} · {{ short(detail.deployer) }}</span><strong>{{ formatToken(creatorFees) }} {{ deployment.wrappedNativeSymbol }}</strong><button :disabled="!account || !creatorFees || !!action" @click="write('creator', detail.address, tokenAbi, 'claimCreatorFees', [])">{{ action === 'creator' ? $t('baskets.claiming') : $t('baskets.executeClaim') }}</button></article>
          <article><span>{{ $t('baskets.launcherClaim') }} · {{ short(detail.launcher) }}</span><strong>{{ formatToken(launcherFees) }} {{ deployment.wrappedNativeSymbol }}</strong><button :disabled="!account || !launcherFees || !!action" @click="write('launcher', detail.address, tokenAbi, 'claimLauncherFees', [])">{{ action === 'launcher' ? $t('baskets.claiming') : $t('baskets.executeClaim') }}</button></article>
        </div>
      </section>

      <section class="panel auction-panel"><div class="panel-title"><div><span>BUYBACK</span><h2>{{ deployment.chainId === 56 ? $t('baskets.buidlBuybackPool') : $t('baskets.buybackAuction') }}</h2></div><em>{{ loadingFees ? $t('baskets.loading') : $t('baskets.liveOnChain') }}</em></div>
        <div class="pool-stats"><div><span>{{ $t('baskets.availableBuybackPool') }}</span><strong>{{ formatToken(availableEth) }} {{ deployment.nativeSymbol }}</strong></div><div><span>{{ $t('baskets.auctionRange') }}</span><strong>{{ formatToken(minAuctionEth) }}–{{ formatToken(maxAuctionEth) }} {{ deployment.nativeSymbol }}</strong></div><div><span>{{ $t('baskets.basketFeeReserve') }}</span><strong>{{ formatToken(feeReserve) }} {{ deployment.wrappedNativeSymbol }}</strong></div></div>
        <div v-if="activeAuction" class="active-auction">
          <div class="auction-head"><div><span>#{{ activeAuction.id }}</span><h3>{{ $t('baskets.activeAuction') }}</h3></div><b>{{ isAuctionEnded ? $t('baskets.readyToSettle') : $t('baskets.endsAt', { time: formatDate(activeAuction.endTime) }) }}</b></div>
          <div class="auction-values"><div><span>{{ $t('baskets.ethLot').replace('ETH', deployment.nativeSymbol) }}</span><strong>{{ formatToken(activeAuction.ethAmount) }} {{ deployment.nativeSymbol }}</strong></div><div><span>{{ $t('baskets.highestBid') }}</span><strong>{{ formatToken(activeAuction.highestBid, bidDecimals) }} {{ bidSymbol }}</strong></div><div><span>{{ $t('baskets.highestBidder') }}</span><strong>{{ short(activeAuction.highestBidder) }}</strong></div></div>
          <button v-if="isAuctionEnded" class="primary" :disabled="!!action" @click="write('settle', contracts.feeAuction, auctionAbi, 'settleAuction', [activeAuction.id])">{{ action === 'settle' ? $t('baskets.settling') : $t('baskets.settleAuction') }}</button>
          <div v-else class="bid-row"><input :value="bidInput" :placeholder="`${formatToken(minimumNextBid, bidDecimals)} ${bidSymbol}`" @input="onBidInput"><button class="primary" :disabled="!account || !!action" @click="placeBid">{{ action === 'approve' ? $t('baskets.approving') : action === 'bid' ? $t('baskets.bidding') : $t('baskets.placeBid') }}</button></div>
        </div>
        <div v-else class="create-auction"><div><h3>{{ $t('baskets.startAuction') }}</h3><p class="auction-threshold">{{ $t('baskets.auctionThresholdHint', { threshold: formatToken(minAuctionEth), native: deployment.nativeSymbol }) }}</p><p>{{ $t('baskets.startAuctionHint', { amount: formatToken(openingBid, bidDecimals), symbol: bidSymbol }) }}</p></div><button class="primary" :disabled="!account || !canCreateAuction || !spotQuote || !!action" @click="createAuction">{{ action === 'approve' ? $t('baskets.approving') : action === 'create' ? $t('baskets.startingAuction') : $t('baskets.startAuction') }}</button></div>
        <div v-if="account" class="account-balances"><div><span>{{ $t('baskets.bidTokenBalance') }}</span><strong>{{ formatToken(bidBalance, bidDecimals) }} {{ bidSymbol }}</strong></div><div><span>{{ $t('baskets.refundableBid') }}</span><strong>{{ formatToken(availableBidTokens, bidDecimals) }} {{ bidSymbol }}</strong></div><div><span>{{ $t('baskets.claimableAuctionEth').replace('ETH', deployment.nativeSymbol) }}</span><strong>{{ formatToken(claimableEth) }} {{ deployment.nativeSymbol }}</strong></div></div>
        <div v-if="account && (availableBidTokens || claimableEth)" class="account-actions"><div><input :value="withdrawInput" :placeholder="$t('baskets.withdrawAmount')" @input="onWithdrawInput"><button :disabled="!availableBidTokens || !!action" @click="withdraw">{{ $t('baskets.withdrawBid') }}</button></div><button :disabled="!claimableEth || !!action" @click="write('claimEth', contracts.feeAuction, auctionAbi, deployment.chainId === 56 ? 'claimBnb' : 'claimEth', [account!])">{{ $t('baskets.claimAuctionEth').replace('ETH', deployment.nativeSymbol) }}</button></div>
        <p v-if="actionError" class="action-error">{{ actionError }}</p>
      </section>

      <section class="panel"><div class="panel-title"><div><span>HISTORY</span><h2>{{ $t('baskets.auctionHistory') }}</h2></div></div>
        <div v-if="!auctions.length" class="empty">{{ $t('baskets.noAuctions') }}</div>
        <div v-else class="history"><article v-for="item in auctions" :key="item.id.toString()"><b>#{{ item.id }}</b><div><span>{{ $t('baskets.ethLot').replace('ETH', deployment.nativeSymbol) }}</span><strong>{{ formatToken(item.ethAmount) }} {{ deployment.nativeSymbol }}</strong></div><div><span>{{ $t('baskets.winningBid') }}</span><strong>{{ formatToken(item.highestBid, bidDecimals) }} {{ bidSymbol }}</strong></div><div><span>{{ $t('baskets.winner') }}</span><strong>{{ short(item.highestBidder) }}</strong></div><em :class="{ done: item.settled }">{{ item.settled ? $t('baskets.settled') : item.endTime * 1000 <= now ? $t('baskets.awaitingSettlement') : $t('baskets.active') }}</em></article></div>
      </section>
    </template>
  </div></div>
</template>

<style scoped>
.fees-page{width:100%;height:100%;overflow-y:auto;background:radial-gradient(circle at 85% 0%,rgba(125,103,239,.09),transparent 34rem)}.fees-shell{max-width:1080px;margin:auto;padding:20px 16px 90px}.back{margin-bottom:16px;color:var(--text-muted);font-size:12px}.back:hover{color:var(--text-base)}.state{display:grid;min-height:360px;place-items:center;color:var(--text-muted)}
.fee-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:34px;border:1px solid var(--border-base);border-radius:28px;background:linear-gradient(135deg,color-mix(in srgb,var(--surface) 94%,transparent),color-mix(in srgb,#7d67ef 12%,var(--surface)));overflow:hidden}.fee-hero span,.panel-title span{color:#8d67e8;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.fee-hero h1{margin-top:7px;color:var(--text-base);font-size:34px;font-weight:750;letter-spacing:-.05em}.fee-hero p,.panel-copy,.create-auction p{margin-top:8px;color:var(--text-muted);font-size:11px}.fee-hero>strong{font-size:42px;color:var(--text-base);letter-spacing:-.05em}
.panel{margin-top:18px;padding:24px;border:1px solid var(--border-base);border-radius:24px;background:var(--surface)}.panel-title{display:flex;align-items:center;justify-content:space-between;gap:14px}.panel-title h2{margin-top:4px;color:var(--text-base);font-size:20px;font-weight:700}.panel-title em{color:#31b975;font-size:10px}.fee-parts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:20px}.fee-parts article,.claim-grid article{padding:16px;border:1px solid var(--border-base);border-radius:16px;background:var(--surface-2)}.fee-parts strong{color:#8d67e8;font-size:18px}.fee-parts h3{margin-top:8px;color:var(--text-base);font-size:12px}.fee-parts p{margin-top:6px;color:var(--text-muted);font-size:9px;line-height:1.5}
.claim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:17px}.claim-grid article{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px 12px}.claim-grid span,.pool-stats span,.auction-values span,.account-balances span,.history span{color:var(--text-muted);font-size:9px}.claim-grid strong{color:var(--text-base);font-size:14px}.claim-grid button,.account-actions button{grid-row:1/3;grid-column:2;padding:8px 11px;border:1px solid var(--border-base);border-radius:10px;color:#8d67e8;font-size:10px}.claim-grid button:disabled,.account-actions button:disabled{opacity:.4}.primary{padding:11px 15px;border-radius:12px;background:linear-gradient(135deg,#7d67ef,#25b9cd);color:#fff;font-size:11px;font-weight:750}.primary:disabled{cursor:not-allowed;opacity:.45}.primary.small{padding:9px 12px}
.pool-stats,.auction-values,.account-balances{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:20px;overflow:hidden;border:1px solid var(--border-base);border-radius:16px;background:var(--border-base)}.pool-stats>div,.auction-values>div,.account-balances>div{display:flex;min-width:0;flex-direction:column;gap:5px;padding:15px;background:var(--surface-2)}.pool-stats strong,.auction-values strong,.account-balances strong{overflow:hidden;color:var(--text-base);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.active-auction,.create-auction{margin-top:14px;padding:18px;border:1px solid rgba(125,103,239,.3);border-radius:18px;background:rgba(125,103,239,.06)}.auction-head,.create-auction{display:flex;align-items:center;justify-content:space-between;gap:16px}.auction-head h3,.create-auction h3{color:var(--text-base);font-size:16px}.auction-head span{color:#8d67e8;font-size:10px}.auction-head b{color:var(--text-muted);font-size:9px}.auction-values{margin:14px 0}.bid-row,.account-actions,.account-actions>div{display:flex;gap:9px}.bid-row input,.account-actions input{min-width:0;flex:1;padding:11px 13px;border:1px solid var(--border-base);border-radius:12px;background:var(--surface);color:var(--text-base);font-size:11px}.account-balances{margin-top:14px}.account-actions{justify-content:flex-end;margin-top:10px}.account-actions>div{max-width:360px;flex:1}.account-actions button{grid-row:auto;grid-column:auto}.action-error{margin-top:12px;color:var(--color-red,#ef596f);font-size:10px}
.create-auction p.auction-threshold{color:#e77a27;font-weight:700}
.history{margin-top:16px}.history article{display:grid;grid-template-columns:55px repeat(3,minmax(0,1fr)) auto;align-items:center;gap:12px;padding:14px 4px;border-top:1px solid var(--border-base)}.history article>b{color:#8d67e8}.history article>div{display:flex;min-width:0;flex-direction:column;gap:3px}.history strong{overflow:hidden;color:var(--text-base);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.history em{padding:5px 8px;border-radius:99px;background:rgba(239,123,69,.1);color:#ef7b45;font-size:9px}.history em.done{background:rgba(49,185,117,.1);color:#31b975}.empty{padding:38px;text-align:center;color:var(--text-muted);font-size:11px}
@media(max-width:800px){.fee-parts{grid-template-columns:repeat(2,1fr)}.pool-stats,.auction-values,.account-balances{grid-template-columns:1fr}.history article{grid-template-columns:45px 1fr auto}.history article>div:nth-of-type(2),.history article>div:nth-of-type(3){display:none}}
@media(max-width:600px){.fees-shell{padding-top:14px}.fee-hero{align-items:flex-start;flex-direction:column;padding:24px}.fee-hero h1{font-size:28px}.fee-hero>strong{font-size:34px}.panel{padding:19px}.claim-grid{grid-template-columns:1fr}.fee-parts{grid-template-columns:1fr}.auction-head,.create-auction{align-items:flex-start;flex-direction:column}.bid-row{flex-direction:column}.account-actions{flex-direction:column}.account-actions>div{max-width:none}.history article{grid-template-columns:40px 1fr auto}}
</style>
