<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getPnlLeaderboard, type PnlPeriod } from '@/apis/api'
import { formatUsd } from '@/utils/format'
import AccountOriginBadges from '@/components/common/AccountOriginBadges.vue'
import SafeAvatar from '@/components/common/SafeAvatar.vue'

type PnlUser = {
  accountId: number
  rank: number
  twitterId: string
  twitterName?: string
  twitterUsername?: string
  profile?: string
  accountSources?: string[] | string | null
  accountType?: number | null
  walletType?: number | null
  pnlUsd: number | string
  roiPercent?: number | string | null
  volumeUsd?: number | string | null
  winRate?: number | string | null
  tradeCount?: number | null
  pnlSource?: string | null
  sourceRank?: number | null
  capturedAt?: string | null
}

type PnlPage = {
  page: number
  size: number
  totalUsers: number
  totalPnlUsd: number
  hasMore: boolean
  generatedAt?: string | null
  rows: PnlUser[]
}

const router = useRouter()
const PAGE_SIZE = 30
const periods: Array<{ value: PnlPeriod; label: string; description: string }> = [
  { value: '1d', label: '24H', description: 'past 24 hours' },
  { value: '7d', label: '7D', description: 'past 7 days' },
  { value: '30d', label: '30D', description: 'past 30 days' },
  { value: 'all', label: 'All', description: 'all time' },
]
const period = ref<PnlPeriod>('7d')
const loading = ref(false)
const loadingMore = ref(false)
const users = ref<PnlUser[]>([])
const page = ref(0)
const hasMore = ref(false)
const totalUsers = ref(0)
const totalPnlUsd = ref(0)
const generatedAt = ref<string | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let requestGeneration = 0

function pnlClass(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 'text-grey-64'
  return Number(value || 0) >= 0 ? 'text-green-34' : 'text-red-e6'
}

function signedUsd(value: number | string | null | undefined) {
  const number = Number(value || 0)
  return `${number >= 0 ? '+' : '-'}${formatUsd(Math.abs(number))}`
}

function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const percent = Math.abs(number) <= 1 ? number * 100 : number
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
}

function sourceLabel(source?: string | null) {
  return source ? source.toUpperCase() : 'Awaiting data'
}

function openProfile(user: PnlUser) {
  if (user.twitterUsername) router.push(`/user/${user.twitterUsername}`)
}

async function load(reset = false) {
  if (reset) {
    requestGeneration += 1
    page.value = 0
    users.value = []
    hasMore.value = false
  }
  if ((loading.value || loadingMore.value) && !reset) return
  const generation = requestGeneration
  if (reset) loading.value = true
  else loadingMore.value = true
  try {
    const response = await getPnlLeaderboard(period.value, page.value, PAGE_SIZE) as PnlPage
    if (generation !== requestGeneration) return
    users.value = reset ? response.rows : [...users.value, ...response.rows]
    totalUsers.value = response.totalUsers
    totalPnlUsd.value = response.totalPnlUsd
    generatedAt.value = response.generatedAt || null
    hasMore.value = response.hasMore
    if (response.hasMore) page.value += 1
  } catch (error) {
    if (generation !== requestGeneration) return
    console.warn('[PnL] leaderboard unavailable', error)
    if (reset) users.value = []
    hasMore.value = false
  } finally {
    if (generation === requestGeneration) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function installObserver() {
  observer?.disconnect()
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting && hasMore.value) load(false)
  }, { rootMargin: '240px 0px' })
  observer.observe(sentinel.value)
}

watch(period, async () => {
  await load(true)
  await nextTick()
  installObserver()
}, { immediate: true })

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="mx-auto w-full max-w-[760px] px-3 py-3">
    <section class="pnl-hero">
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div>
          <span class="text-xs font-semibold uppercase tracking-[.16em] text-orange-normal">TagAI Leaderboard</span>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-content">Top PnL</h1>
          <p class="mt-1 max-w-[420px] text-sm text-grey-64">
            PnL for TagAI, imported and callout accounts · updated hourly
          </p>
        </div>
        <div class="text-right">
          <strong class="block text-xl font-bold tabular-nums" :class="pnlClass(totalPnlUsd)">{{ signedUsd(totalPnlUsd) }}</strong>
          <span class="text-xs text-grey-64">{{ totalUsers }} accounts</span>
        </div>
      </div>
      <div class="period-tabs relative z-10 mt-5">
        <button v-for="option in periods" :key="option.value" class="period-tab"
          :class="{ 'period-tab--active': period === option.value }" @click="period = option.value">
          {{ option.label }}
        </button>
      </div>
    </section>

    <div class="mt-3 flex items-center justify-between px-1 text-xs text-grey-64">
      <span>Ranked by PnL · {{ periods.find(item => item.value === period)?.description }}</span>
      <span v-if="generatedAt">Updated {{ new Date(generatedAt).toLocaleString() }}</span>
    </div>

    <div v-if="loading" class="flex justify-center py-14">
      <i-ep-loading class="h-7 w-7 animate-spin text-orange-normal" />
    </div>
    <div v-else-if="!users.length" class="mt-3 rounded-2xl bg-white p-10 text-center text-grey-64">
      PnL data is being indexed. The leaderboard will update automatically.
    </div>
    <div v-else class="mt-3 space-y-2">
      <article v-for="user in users" :key="user.accountId" class="pnl-user"
        :class="{ 'cursor-pointer hover:border-orange-normal/40': user.twitterUsername }"
        @click="openProfile(user)">
        <div class="rank" :class="user.rank <= 3 ? `rank--${user.rank}` : ''">{{ user.rank }}</div>
        <SafeAvatar :src="user.profile" :seed="user.twitterId || user.twitterUsername || user.accountId"
          class="h-11 w-11 flex-none rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <strong class="truncate text-base text-content">{{ user.twitterName || user.twitterUsername || 'TagAI account' }}</strong>
            <AccountOriginBadges :sources="user.accountSources" :account-type="user.accountType" :wallet-type="user.walletType" />
          </div>
          <span class="block truncate text-xs text-grey-64">@{{ user.twitterUsername || user.twitterId }}</span>
          <div class="mt-1 flex items-center gap-2 text-[10px] text-grey-64">
            <span class="rounded-full bg-grey-light px-2 py-0.5 font-semibold">{{ sourceLabel(user.pnlSource) }}</span>
            <span v-if="user.tradeCount">{{ user.tradeCount }} trades</span>
            <span v-if="user.winRate !== null && user.winRate !== undefined">Win {{ formatPercent(user.winRate).replace('+', '') }}</span>
          </div>
        </div>
        <div class="min-w-[92px] text-right">
          <strong class="block text-base font-bold tabular-nums" :class="pnlClass(user.pnlSource ? user.pnlUsd : null)">
            {{ user.pnlSource ? signedUsd(user.pnlUsd) : '—' }}
          </strong>
          <span class="block text-xs tabular-nums" :class="pnlClass(user.roiPercent)">
            {{ user.pnlSource ? `${formatPercent(user.roiPercent)} ROI` : 'Indexing' }}
          </span>
        </div>
      </article>
      <div ref="sentinel" class="flex min-h-10 items-center justify-center py-3">
        <i-ep-loading v-if="loadingMore" class="h-5 w-5 animate-spin text-orange-normal" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pnl-hero { position:relative; overflow:hidden; padding:22px; border:1px solid var(--border-base); border-radius:24px; background:linear-gradient(145deg,#fff8f0 0%,var(--surface) 62%); }
.pnl-hero::after { position:absolute; width:190px; height:190px; border-radius:999px; background:rgba(254,145,63,.16); content:''; right:-64px; top:-92px; filter:blur(2px); }
.period-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; padding:4px; border-radius:14px; background:rgba(31,35,41,.06); }
.period-tab { height:34px; border-radius:10px; color:var(--text-muted); font-size:12px; font-weight:700; }
.period-tab--active { background:#fe913f; color:#fff; box-shadow:0 3px 10px rgba(254,145,63,.25); }
.pnl-user { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid var(--border-base); border-radius:16px; background:var(--surface); transition:border-color .15s ease,transform .15s ease; }
.pnl-user:hover { transform:translateY(-1px); }
.rank { display:flex; width:28px; height:28px; flex:none; align-items:center; justify-content:center; border-radius:999px; background:var(--surface-2); color:var(--text-muted); font-size:12px; font-weight:700; }
.rank--1 { background:#fff0b8; color:#a36600; }.rank--2 { background:#edf0f5; color:#626a79; }.rank--3 { background:#f7dfd0; color:#9a5936; }
@media (max-width:420px) { .pnl-hero { padding:17px; }.pnl-user { gap:9px; padding:12px 10px; } }
</style>
