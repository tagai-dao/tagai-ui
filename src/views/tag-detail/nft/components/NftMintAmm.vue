<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatEther } from 'viem'
import { useNutboxNftPool, formatToken } from '@/composables/useNutboxNftPool'
import { getNutboxNftTransactions, getNutboxNftTransactionsWebSocketUrl } from '@/apis/nutbox'
import type { NutboxIndexBrokerPool, NutboxNftTransaction } from '@/types/nutbox'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { handleErrorTip, notify } from '@/utils/notify'
import { useChainStore } from '@/stores/chain'
import NftArtwork from './NftArtwork.vue'

const props = defineProps<{ pool: NutboxIndexBrokerPool }>()
const route = useRoute()
const modalStore = useModalStore()
const chainStore = useChainStore()
const poolRef = toRef(props, 'pool')
const {
  state, loading, error, action, connected, ownedNfts, inventory,
  mintPreviewImage, approveErc20, mint, reveal, approveNft, buy, sell,
} = useNutboxNftPool(poolRef)

const mode = ref<'mint' | 'swap' | 'snipe'>('mint')
const side = ref<'buy' | 'sell'>('buy')
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
const mintNeedsApproval = computed(() => state.mintAllowance < state.communityTokenPrice)
const buyNeedsApproval = computed(() => state.ammAllowance < state.tokensPerNft)
const selectedOwnedApproved = computed(() => selectedOwned.value?.approved?.toLowerCase() === props.pool.amm.toLowerCase())
const explorer = computed(() => chainStore.browser.replace(/\/$/, ''))

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
const timestamp = (value: number) => new Date(value * 1000).toLocaleString()

watch(() => props.pool.pool, () => { loadTransactions(); openSocket() })
onMounted(() => { loadTransactions(); openSocket() })
onBeforeUnmount(() => socket?.close())
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-2xl bg-surface p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-xl font-semibold text-content">{{ state.name || pool.name || 'NFT' }}</div>
          <div class="mt-1 text-sm text-grey-3f">{{ state.symbol }} · {{ state.totalSupply.toString() }} / {{ state.maxSupply.toString() }}</div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-right text-sm">
          <div><span class="block text-xs text-grey-3f">Mint cost</span><b>{{ formatToken(state.communityTokenPrice, state.communityDecimals) }} {{ state.communitySymbol }}</b></div>
          <div><span class="block text-xs text-grey-3f">Public price</span><b>{{ formatEther(state.nativePrice) }} BNB</b></div>
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{{ error }}</div>
    <div v-if="loading" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">Loading NFT market…</div>

    <div v-else class="rounded-2xl bg-surface p-4">
      <div class="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
        <button v-for="item in ['mint', 'swap', 'snipe']" :key="item" class="flex-1 rounded-lg px-2 py-2 text-sm font-medium capitalize" :class="mode === item ? 'bg-surface text-content shadow-sm' : 'text-grey-3f'" @click="mode = item as any; side = 'buy'">{{ item }}</button>
        <button class="flex-1 rounded-lg px-2 py-2 text-sm font-medium" :class="side === 'sell' ? 'bg-surface text-content shadow-sm' : 'text-grey-3f'" @click="side = 'sell'">Sell</button>
      </div>

      <template v-if="side === 'buy' && mode === 'mint'">
        <div class="grid gap-4 web:grid-cols-[220px_1fr]">
          <NftArtwork :src="mintPreviewImage" :alt="`Next ${state.name || 'NFT'} #${state.totalSupply + 1n}`" />
          <div class="flex flex-col justify-center gap-3">
            <div class="rounded-xl bg-surface-2 p-3 text-sm">
              <span class="text-grey-3f">Payment</span>
              <strong class="mt-1 block text-content">{{ formatToken(state.communityTokenPrice, state.communityDecimals) }} {{ state.communitySymbol }}<template v-if="state.whitelistRemaining === 0n"> + {{ formatEther(state.nativePrice) }} BNB</template></strong>
              <small v-if="referrerTokenId" class="mt-1 block text-grey-3f">Referrer NFT #{{ referrerTokenId }}</small>
            </div>
            <button v-if="!connected" class="rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" @click="connect">Connect wallet</button>
            <button v-else-if="mintNeedsApproval" class="rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveErc20(pool.communityToken, pool.pool, state.communityTokenPrice, 'approve-mint'), 'Mint token approved')">Approve {{ state.communitySymbol }}</button>
            <button v-else class="rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || state.totalSupply >= state.maxSupply || state.communityBalance < state.communityTokenPrice" @click="executeMint">{{ action === 'mint' ? 'Minting…' : 'Mint NFT' }}</button>
          </div>
        </div>
      </template>

      <template v-else-if="side === 'buy'">
        <div v-if="mode === 'swap' && inventory[0]" class="mx-auto max-w-[240px]"><NftArtwork :src="inventory[0].image" :alt="`NFT #${inventory[0].tokenId}`" /><b class="mt-2 block text-center">Next available #{{ inventory[0].tokenId }}</b></div>
        <div v-else-if="mode === 'snipe'" class="grid grid-cols-3 gap-2 web:grid-cols-6">
          <button v-for="nft in inventory" :key="nft.tokenId.toString()" class="rounded-xl border p-1" :class="selectedInventoryId === nft.tokenId.toString() ? 'border-grey-normal' : 'border-line'" @click="selectedInventoryId = nft.tokenId.toString()"><NftArtwork :src="nft.image" :alt="`#${nft.tokenId}`" /><small>#{{ nft.tokenId }}</small></button>
        </div>
        <div v-if="inventory.length === 0" class="py-8 text-center text-grey-3f">AMM inventory is empty</div>
        <div class="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
          <div class="flex justify-between"><span>Community token</span><b>{{ formatToken(state.tokensPerNft, state.communityDecimals) }} {{ state.communitySymbol }}</b></div>
          <div class="mt-2 flex justify-between"><span>Maximum BNB fee</span><b>{{ formatEther(mode === 'snipe' ? state.specificFee : state.normalFee) }} BNB</b></div>
        </div>
        <button v-if="!connected" class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" @click="connect">Connect wallet</button>
        <button v-else-if="buyNeedsApproval" class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveErc20(pool.communityToken, pool.amm, state.tokensPerNft, 'approve-buy'), 'AMM token approved')">Approve {{ state.communitySymbol }}</button>
        <button v-else class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || !state.ammActive || inventory.length === 0 || (mode === 'snipe' && !selectedInventory)" @click="executeBuy">Buy {{ mode === 'snipe' && selectedInventory ? `#${selectedInventory.tokenId}` : 'next NFT' }}</button>
      </template>

      <template v-else>
        <div class="grid grid-cols-3 gap-2 web:grid-cols-6">
          <button v-for="nft in ownedNfts" :key="nft.tokenId.toString()" class="rounded-xl border p-1" :class="selectedOwnedId === nft.tokenId.toString() ? 'border-grey-normal' : 'border-line'" @click="selectedOwnedId = nft.tokenId.toString()"><NftArtwork :src="nft.image" :alt="`#${nft.tokenId}`" /><small>#{{ nft.tokenId }}</small></button>
        </div>
        <div v-if="ownedNfts.length === 0" class="py-8 text-center text-grey-3f">No NFTs in this wallet</div>
        <div class="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
          <div class="flex justify-between"><span>Estimated payout</span><b>{{ formatToken(state.tokensPerNft, state.communityDecimals) }} {{ state.communitySymbol }}</b></div>
          <div class="mt-2 flex justify-between"><span>Maximum BNB fee</span><b>{{ formatEther(state.normalFee) }} BNB</b></div>
        </div>
        <button v-if="!connected" class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" @click="connect">Connect wallet</button>
        <button v-else-if="selectedOwned && !selectedOwnedApproved" class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white" :disabled="!!action" @click="run(() => approveNft(selectedOwned!.tokenId), 'NFT approved')">Approve NFT #{{ selectedOwned.tokenId }}</button>
        <button v-else class="mt-3 w-full rounded-xl bg-grey-normal px-4 py-3 font-medium text-white disabled:opacity-50" :disabled="!!action || !selectedOwned || !state.ammActive" @click="executeSell">Sell selected NFT</button>
      </template>
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
              <td>{{ formatEther(BigInt(event.secondaryAmount || 0) + BigInt(event.tertiaryAmount || 0)) }} BNB</td>
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
