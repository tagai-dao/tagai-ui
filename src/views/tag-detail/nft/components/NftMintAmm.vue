<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatEther } from 'viem'
import { formatToken, type NutboxNftPoolModel } from '@/composables/useNutboxNftPool'
import { getNutboxNftTransactions, getNutboxNftTransactionsWebSocketUrl } from '@/apis/nutbox'
import type { NutboxIndexBrokerPool, NutboxNftTransaction } from '@/types/nutbox'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { handleErrorTip, notify } from '@/utils/notify'
import { useChainStore } from '@/stores/chain'
import NftArtwork from './NftArtwork.vue'

const props = defineProps<{ pool: NutboxIndexBrokerPool; model: NutboxNftPoolModel }>()
const route = useRoute()
const modalStore = useModalStore()
const chainStore = useChainStore()
const {
  state, loading, ready, error, action, connected, ownedNfts, inventory,
  mintPreviewImage, approveErc20, mint, reveal, approveNft, buy, sell,
} = props.model

const mode = ref<'mint' | 'swap' | 'snipe'>('mint')
const side = ref<'buy' | 'sell'>('buy')
const buyModes = [
  { key: 'mint', label: 'Mint', hint: '' },
  { key: 'swap', label: '↝ Buy queue head', hint: '(next available)' },
  { key: 'snipe', label: '⊕ Buy specific', hint: '(choose NFT)' },
] as const
const selectedInventoryId = ref('')
const selectedOwnedId = ref('')
const transactions = ref<NutboxNftTransaction[]>([])
const cursor = ref<{ blockNumber: number; logIndex: number } | null>(null)
const hasMore = ref(false)
const transactionsLoading = ref(false)
let socket: WebSocket | undefined

const referrerTokenId = computed(() => {
  const value = String(route.query.referrerTokenId || '')
  return /^\d+$/.test(value) && BigInt(value) > 0n ? BigInt(value) : 0n
})
const selectedInventory = computed(() => inventory.value.find(nft => nft.tokenId.toString() === selectedInventoryId.value))
const selectedOwned = computed(() => ownedNfts.value.find(nft => nft.tokenId.toString() === selectedOwnedId.value))
const mintArtwork = computed(() => mintPreviewImage.value || inventory.value[0]?.image || ownedNfts.value[0]?.image || '')
const mintArtworkFallbacks = computed(() => mintPreviewImage.value
  ? [inventory.value[0]?.image, ...(inventory.value[0]?.imageFallbacks || [])].filter(Boolean) as string[]
  : inventory.value[0]?.imageFallbacks || ownedNfts.value[0]?.imageFallbacks || [])
const mintNeedsApproval = computed(() => state.mintAllowance < state.communityTokenPrice)
const buyNeedsApproval = computed(() => state.ammAllowance < state.tokensPerNft)
const selectedOwnedApproved = computed(() => selectedOwned.value?.approved?.toLowerCase() === props.pool.amm.toLowerCase())
const explorer = computed(() => chainStore.browser.replace(/\/$/, ''))
const nativeSymbol = computed(() => chainStore.nativeCurrency.symbol)

const connect = () => modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
const run = async (fn: () => Promise<unknown>, success: string) => {
  try {
    await fn()
    notify({ type: 'success', message: success })
  } catch (reason) {
    handleErrorTip(reason)
  }
}

const executeMint = () => run(
  () => mint(referrerTokenId.value),
  'NFT minted. Complete Reveal when the reveal window opens.',
)
const executeBuy = () => run(
  () => buy(mode.value === 'snipe' ? selectedInventory.value?.tokenId : undefined),
  'NFT purchased',
)
const executeSell = () => selectedOwned.value && run(() => sell(selectedOwned.value!.tokenId), 'NFT sold')

const mergeTransactions = (rows: NutboxNftTransaction[]) => {
  const byId = new Map([...rows, ...transactions.value].map(item => [item.id, item]))
  transactions.value = [...byId.values()].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
}
const loadTransactions = async (more = false) => {
  transactionsLoading.value = true
  try {
    const result = await getNutboxNftTransactions(props.pool.pool, more && cursor.value ? {
      beforeBlock: cursor.value.blockNumber,
      beforeLogIndex: cursor.value.logIndex,
      size: 12,
    } : { size: 12 })
    if (more) transactions.value.push(...result.list)
    else transactions.value = result.list
    cursor.value = result.nextCursor
    hasMore.value = result.hasMore
  } catch (reason) {
    if (!more) transactions.value = []
  } finally {
    transactionsLoading.value = false
  }
}
const openSocket = () => {
  socket?.close()
  try {
    socket = new WebSocket(getNutboxNftTransactionsWebSocketUrl(props.pool.pool))
    socket.onmessage = event => {
      try {
        const payload = JSON.parse(event.data)
        if (Array.isArray(payload.transactions)) mergeTransactions(payload.transactions)
      } catch { /* ignore malformed heartbeat payloads */ }
    }
  } catch { socket = undefined }
}

const eventLabel = (event: NutboxNftTransaction) => event.eventType.includes('MINTED')
  ? 'Mint' : event.eventType.includes('BOUGHT') ? 'Buy' : 'Sell'
const short = (value?: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'
const formatNative = (value: bigint, digits = 6) => Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: digits })
const timestamp = (value: number) => {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - value)
  if (elapsed < 60) return 'just now'
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`
  if (elapsed < 2_592_000) return `${Math.floor(elapsed / 86400)}d ago`
  return new Date(value * 1000).toLocaleDateString()
}

watch(() => props.pool.pool, () => { loadTransactions(); openSocket() })
onMounted(() => { loadTransactions(); openSocket() })
onBeforeUnmount(() => socket?.close())
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
      {{ error }} <button class="ml-2 underline disabled:opacity-50" :disabled="loading" @click="model.load()">Retry</button>
    </div>
    <div v-if="loading" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">Loading NFT market…</div>

    <div v-else-if="ready" class="overflow-hidden rounded-2xl border border-line bg-surface">
      <div v-if="side === 'buy'" class="grid grid-cols-3 border-b border-line" role="tablist" aria-label="Buy NFT">
        <button
          v-for="item in buyModes"
          :key="item.key"
          role="tab"
          :aria-selected="mode === item.key"
          class="min-h-14 border-b-2 px-2 py-3 text-center text-sm transition-colors"
          :class="mode === item.key ? 'border-orange-normal bg-orange-50 text-orange-normal' : 'border-transparent text-grey-3f hover:bg-surface-2'"
          @click="mode = item.key; side = 'buy'"
        >
          <b>{{ item.label }}</b><span v-if="item.hint" class="ml-1 text-xs">{{ item.hint }}</span>
        </button>
      </div>

      <div class="p-4 web:p-5">
      <template v-if="side === 'buy' && mode === 'mint'">
        <div class="mx-auto max-w-3xl">
          <strong class="mb-3 block text-sm text-content">Next NFT preview</strong>
          <div class="grid gap-5 web:grid-cols-[minmax(240px,360px)_1fr] web:items-center">
          <div class="rounded-2xl border border-line bg-surface-2 p-2">
            <NftArtwork :src="mintArtwork" :sources="mintArtworkFallbacks" :alt="`Next ${state.name || 'NFT'} #${state.totalSupply + 1n}`" />
          </div>
          <div>
            <span class="text-sm text-grey-3f">Mint price</span>
            <strong class="mt-2 block text-xl text-content">{{ formatToken(state.communityTokenPrice, state.communityDecimals) }} {{ state.communitySymbol }}<template v-if="state.whitelistRemaining === 0n"> + {{ formatEther(state.nativePrice) }} {{ nativeSymbol }}</template></strong>
              <small v-if="referrerTokenId" class="mt-1 block text-grey-3f">Referrer NFT #{{ referrerTokenId }}</small>
            <button v-if="!connected" class="mt-5 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" @click="connect">Connect wallet to mint and manage NFTs.</button>
            <button v-else-if="mintNeedsApproval" class="mt-5 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveErc20(pool.communityToken, pool.pool, state.communityTokenPrice, 'approve-mint'), 'Mint token approved')">Approve {{ state.communitySymbol }}</button>
            <button v-else class="mt-5 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || state.totalSupply >= state.maxSupply || state.communityBalance < state.communityTokenPrice" @click="executeMint">{{ action === 'mint' ? 'Minting…' : 'Mint NFT' }}</button>
          </div>
          </div>
        </div>
      </template>

      <template v-else-if="mode === 'swap'">
        <div class="rounded-2xl border border-line bg-surface-2">
          <div class="p-4">
            <div class="mb-3 flex justify-between text-sm"><strong>You pay</strong><span class="text-grey-3f">{{ side === 'buy' ? `${formatToken(state.communityBalance, state.communityDecimals)} ${state.communitySymbol} balance` : `${ownedNfts.length} in wallet` }}</span></div>
            <div v-if="side === 'buy'" class="flex items-center justify-between rounded-xl border border-dashed border-line bg-surface p-4">
              <div><span class="block text-xs text-grey-3f">Community token payment</span><b class="mt-1 block text-xl">{{ formatToken(state.tokensPerNft, state.communityDecimals) }}</b></div><strong>{{ state.communitySymbol }}</strong>
            </div>
            <div v-else-if="connected && ownedNfts.length" class="grid grid-cols-2 gap-3 web:grid-cols-5">
              <button v-for="nft in ownedNfts" :key="nft.tokenId.toString()" class="rounded-xl border p-1" :class="selectedOwnedId === nft.tokenId.toString() ? 'border-orange-normal' : 'border-line'" @click="selectedOwnedId = nft.tokenId.toString()"><NftArtwork :src="nft.image" :sources="nft.imageFallbacks" :alt="`#${nft.tokenId}`" /><small>#{{ nft.tokenId }}</small></button>
            </div>
            <div v-else class="rounded-xl border border-dashed border-line p-6 text-center text-grey-3f">{{ connected ? 'No NFTs in this wallet' : 'Connect wallet to select an NFT to sell' }}</div>
          </div>
          <div class="relative border-y border-line py-5 text-center"><button class="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface text-xl" :aria-label="side === 'buy' ? 'Sell NFT' : 'Buy NFT'" @click="side = side === 'buy' ? 'sell' : 'buy'">↕</button></div>
          <div class="p-4">
            <div class="mb-3 flex justify-between text-sm"><strong>You receive</strong><span class="text-grey-3f">{{ side === 'buy' ? `${inventory.length} in inventory` : 'Sale proceeds' }}</span></div>
            <div v-if="side === 'buy' && inventory[0]" class="grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-xl border border-line bg-surface p-3"><NftArtwork :src="inventory[0].image" :sources="inventory[0].imageFallbacks" :alt="`${state.name} #${inventory[0].tokenId}`" /><div><b>{{ state.name }} #{{ inventory[0].tokenId }}</b><span class="mt-1 block text-xs text-grey-3f">Next available · {{ inventory.length }} in inventory</span></div><strong>1 NFT</strong></div>
            <div v-else-if="side === 'sell'" class="flex items-center justify-between rounded-xl border border-line bg-surface p-4"><div><span class="block text-xs text-grey-3f">Sale proceeds</span><b class="mt-1 block text-xl">{{ formatToken(state.tokensPerNft, state.communityDecimals) }}</b></div><strong>{{ state.communitySymbol }}</strong></div>
            <div v-else class="rounded-xl border border-dashed border-line p-6 text-center text-grey-3f">AMM inventory is empty</div>
          </div>
        </div>
        <div class="mt-4 grid gap-2 text-sm web:grid-cols-2"><div class="flex justify-between"><span class="text-grey-3f">Exchange rate</span><b>1 NFT = {{ formatToken(state.tokensPerNft, state.communityDecimals) }} {{ state.communitySymbol }}</b></div><div class="flex justify-between"><span class="text-grey-3f">Maximum {{ nativeSymbol }} fee</span><b>{{ formatNative(state.normalFee) }} {{ nativeSymbol }}</b></div></div>
        <button v-if="!connected" class="mt-4 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" @click="connect">Connect wallet</button>
        <button v-else-if="side === 'buy' && buyNeedsApproval" class="mt-4 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveErc20(pool.communityToken, pool.amm, state.tokensPerNft, 'approve-buy'), 'AMM token approved')">Approve {{ state.communitySymbol }}</button>
        <button v-else-if="side === 'buy'" class="mt-4 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || !state.ammActive || inventory.length === 0" @click="executeBuy">Buy queue head</button>
        <button v-else-if="selectedOwned && !selectedOwnedApproved" class="mt-4 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveNft(selectedOwned!.tokenId), 'NFT approved')">Approve NFT #{{ selectedOwned.tokenId }}</button>
        <button v-else class="mt-4 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || !selectedOwned || !state.ammActive" @click="executeSell">Sell selected NFT</button>
        <p class="mt-3 text-xs text-grey-3f">⚠ Staked assets and index-mining weight transfer with the NFT.</p>
      </template>

      <template v-else>
        <div class="grid grid-cols-3 gap-2 web:grid-cols-6">
          <button v-for="nft in inventory" :key="nft.tokenId.toString()" class="rounded-xl border p-1" :class="selectedInventoryId === nft.tokenId.toString() ? 'border-grey-normal' : 'border-line'" @click="selectedInventoryId = nft.tokenId.toString()"><NftArtwork :src="nft.image" :sources="nft.imageFallbacks" :alt="`#${nft.tokenId}`" /><small>#{{ nft.tokenId }}</small></button>
        </div>
        <div v-if="inventory.length === 0" class="py-8 text-center text-grey-3f">AMM inventory is empty</div>
        <div class="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
          <div class="flex justify-between"><span>Community token</span><b>{{ formatToken(state.tokensPerNft, state.communityDecimals) }} {{ state.communitySymbol }}</b></div>
          <div class="mt-2 flex justify-between"><span>Maximum {{ nativeSymbol }} fee</span><b>{{ formatNative(mode === 'snipe' ? state.specificFee : state.normalFee) }} {{ nativeSymbol }}</b></div>
        </div>
        <button v-if="!connected" class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" @click="connect">Connect wallet</button>
        <button v-else-if="buyNeedsApproval" class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveErc20(pool.communityToken, pool.amm, state.tokensPerNft, 'approve-buy'), 'AMM token approved')">Approve {{ state.communitySymbol }}</button>
        <button v-else class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || !state.ammActive || inventory.length === 0 || (mode === 'snipe' && !selectedInventory)" @click="executeBuy">Buy {{ mode === 'snipe' && selectedInventory ? `#${selectedInventory.tokenId}` : 'next NFT' }}</button>
      </template>
      </div>
    </div>

    <div v-if="ownedNfts.some(nft => nft.revealPending)" class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 class="font-semibold text-amber-900">Reveal required</h3>
      <p class="mt-1 text-sm text-amber-800">Reveal opens after the target block and remains available for 256 blocks.</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button v-for="nft in ownedNfts.filter(item => item.revealPending)" :key="nft.tokenId.toString()" class="rounded-lg bg-amber-900 px-3 py-2 text-sm text-white disabled:opacity-50" :disabled="!!action || state.currentBlock <= nft.revealBlock || state.currentBlock > nft.revealBlock + 256n" @click="run(() => reveal(nft.tokenId), `NFT #${nft.tokenId} revealed`)">Reveal #{{ nft.tokenId }}</button>
      </div>
    </div>

    <div class="rounded-2xl bg-surface p-4">
      <h3 class="text-lg font-semibold text-content">Transactions</h3>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="text-grey-3f"><tr><th class="py-2">Time</th><th>Type</th><th>NFT ID</th><th>Token amount</th><th>Fee</th><th>Trader</th><th>Hash</th></tr></thead>
          <tbody>
            <tr v-for="event in transactions" :key="event.id" class="border-t border-line">
              <td class="py-3">{{ timestamp(event.blockTimestamp) }}</td><td>{{ eventLabel(event) }}</td><td>#{{ event.tokenId }}</td>
              <td>{{ formatToken(BigInt(event.amount || 0), state.communityDecimals) }} {{ state.communitySymbol }}</td>
              <td>{{ formatNative(BigInt(event.secondaryAmount || 0) + BigInt(event.tertiaryAmount || 0)) }} {{ nativeSymbol }}</td>
              <td><a :href="`${explorer}/address/${event.account}`" target="_blank" class="text-primary">{{ short(event.account) }}</a></td>
              <td><a :href="`${explorer}/tx/${event.transactionHash}`" target="_blank" class="text-primary">{{ short(event.transactionHash) }}</a></td>
            </tr>
          </tbody>
        </table>
        <div v-if="transactions.length === 0 && !transactionsLoading" class="py-8 text-center text-grey-3f">No NFT transactions yet</div>
      </div>
      <button v-if="hasMore" class="mt-3 rounded-lg border border-line px-3 py-2 text-sm" :disabled="transactionsLoading" @click="loadTransactions(true)">Load more</button>
    </div>
  </div>
</template>
