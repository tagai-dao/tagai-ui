<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalStore, useStateStore } from '@/stores/common'
import { useChainStore } from '@/stores/chain'
import { GlobalModalType } from '@/types'
import { getTradeCurationRecords, type TradeCardReward, type TradeCurationRecord } from '@/utils/tradeCurationCards'
import { formatTokenAmount, formatUsd } from '@/utils/format'
import UserAvatar from '@/components/common/UserAvatar.vue'
import SafeAvatar from '@/components/common/SafeAvatar.vue'
const modal = useModalStore(), state = useStateStore(), chain = useChainStore(), { t, locale } = useI18n()
const params = computed(() => modal.modalParams as { token: string; tweetId: string; tick?: string; price?: number } | null)
const summary = ref<TradeCardReward | null>(null), records = ref<TradeCurationRecord[]>([])
const loading = ref(false), failed = ref(false), nextCursor = ref<string | null>(null)
const price = computed(() => Number(params.value?.price) * state.ethPrice)
const usd = (amount: string) => Number.isFinite(price.value) && price.value > 0 ? formatUsd(Number(amount) * price.value) : '—'
const time = (timestamp: number) => new Date(timestamp * 1000).toLocaleString(locale.value)
let generation = 0
async function load(reset = false) {
  if (modal.modalType !== GlobalModalType.TradeCurationRewards) return
  if (chain.activeChainId !== 56) { modal.setModalVisible(false); return }
  const source = params.value
  if (!source?.token || !source.tweetId || (!reset && (loading.value || !nextCursor.value))) return
  const current = ++generation
  loading.value = true; failed.value = false
  try {
    const page = await getTradeCurationRecords({ token: source.token, tweetId: source.tweetId }, reset ? undefined : nextCursor.value!)
    if (current !== generation) return
    summary.value = page.summary
    records.value = reset ? page.records : [...new Map([...records.value, ...page.records].map(r => [r.twitterId, r])).values()]
    nextCursor.value = page.nextCursor
  } catch { if (current === generation) failed.value = true }
  finally { if (current === generation) loading.value = false }
}
watch(() => [params.value?.token, params.value?.tweetId, chain.activeChainId], () => {
  generation++; summary.value = null; records.value = []; nextCursor.value = null
  void load(true)
}, { immediate: true })
onUnmounted(() => { generation++ })
</script>
<template>
  <section class="text-content" aria-labelledby="trade-curation-modal-title">
    <header class="mb-4 flex items-center justify-between gap-3">
      <h2 id="trade-curation-modal-title" class="text-lg font-bold">{{ t('tradeCuration.title') }}<span v-if="params?.tick"> · {{ params.tick }}</span></h2>
      <button type="button" class="shrink-0 rounded-full p-2 text-grey-64" :aria-label="t('tradeCuration.close')" @click="modal.setModalVisible(false)">✕</button>
    </header>
    <div class="max-h-[70vh] overflow-y-auto overscroll-contain pr-1">
      <div v-if="summary" class="rounded-2xl bg-surface-2 p-4">
        <div class="text-sm text-grey-64">{{ t('tradeCuration.totalReward') }}</div>
        <div class="mt-1 break-words text-xl font-bold tabular-nums" :title="summary.amount">{{ formatTokenAmount(summary.amount) }} {{ params?.tick }} <span class="text-sm font-normal text-grey-64">≈ {{ usd(summary.amount) }}</span></div>
        <div class="mt-4 grid grid-cols-2 gap-4 border-t border-grey-6f/10 pt-3">
          <div class="min-w-0"><div class="text-xs text-grey-64">{{ t('tradeCuration.author') }}</div><div class="mt-1 break-words font-semibold" :title="summary.authorAmount">{{ formatTokenAmount(summary.authorAmount) }} {{ params?.tick }}</div><div class="text-xs text-grey-64">{{ usd(summary.authorAmount) }}</div></div>
          <div class="min-w-0"><div class="text-xs text-grey-64">{{ t('tradeCuration.buyers') }}</div><div class="mt-1 break-words font-semibold" :title="summary.buyerAmount">{{ formatTokenAmount(summary.buyerAmount) }} {{ params?.tick }}</div><div class="text-xs text-grey-64">{{ usd(summary.buyerAmount) }}</div></div>
        </div>
        <div class="mt-3 text-xs text-grey-64">{{ t(summary.state === 'settled' ? 'tradeCuration.settled' : 'tradeCuration.processing') }}</div>
        <div class="mt-1 text-xs text-grey-64">{{ t('tradeCuration.end') }}: {{ time(summary.endTime) }}</div>
      </div>
      <div class="mb-3 mt-5 flex items-center justify-between gap-3"><h3 class="font-semibold">{{ t('tradeCuration.records') }}</h3><button type="button" class="text-xs text-orange-normal disabled:opacity-50" :disabled="loading" @click="load(true)">{{ t('tradeCuration.refresh') }}</button></div>
      <p class="mb-3 text-xs text-grey-64">{{ t('tradeCuration.recordsHint') }}</p>
      <div v-for="record in records" :key="record.twitterId" class="mb-2 rounded-xl bg-surface-2 p-3">
        <div class="flex items-center gap-2.5">
          <UserAvatar :twitter-id="record.twitterId" :profile-img="record.profile" :name="record.twitterName" :username="record.twitterUsername" :eth-addr="record.wallet" :steem-id="''" :followers="undefined" :followings="undefined" :credit="undefined" :teleported="true">
            <template #avatar-img><SafeAvatar :src="record.profile" :seed="record.twitterId" class="h-8 w-8 min-w-8 rounded-full object-cover" /></template>
          </UserAvatar>
          <div class="min-w-0 flex-1"><div class="truncate text-sm font-semibold">{{ record.twitterName || record.twitterUsername || record.twitterId }}</div><div class="truncate text-xs text-grey-64">{{ time(record.lastBuyTime) }}</div></div>
          <div class="min-w-0 max-w-[45%] text-right"><div class="text-xs text-grey-64">{{ t('tradeCuration.buyerReward') }}</div><div class="break-words text-sm font-semibold text-orange-normal" :title="record.rewardAmount">{{ formatTokenAmount(record.rewardAmount) }} {{ params?.tick }}</div><div class="text-xs text-grey-64">{{ usd(record.rewardAmount) }}</div></div>
        </div>
        <div class="mt-2 flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-grey-64"><span :title="record.tokenAmount">{{ t('tradeCuration.bought') }} {{ formatTokenAmount(record.tokenAmount) }} {{ params?.tick }}</span><span>{{ t('tradeCuration.buyCount', { count: record.buyCount }) }}</span></div>
      </div>
      <p v-if="failed" class="py-3 text-center text-sm text-grey-64">{{ t('tradeCuration.recordsError') }} <button type="button" class="text-orange-normal" @click="load(true)">{{ t('tradeCuration.retry') }}</button></p>
      <p v-else-if="loading" class="py-3 text-center text-sm text-grey-64">{{ t('loading') }}</p>
      <p v-else-if="summary && !records.length" class="py-6 text-center text-sm text-grey-64">{{ t('tradeCuration.emptyRecords') }}</p>
      <button v-else-if="nextCursor" type="button" class="w-full rounded-xl border border-grey-6f/10 py-2 text-sm text-orange-normal" @click="load()">{{ t('tradeCuration.loadMore') }}</button>
    </div>
  </section>
</template>
