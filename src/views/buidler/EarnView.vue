<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getRewardLeaderboard, type RewardCategory, type RewardPeriod } from '@/apis/api'
import { formatUsd } from '@/utils/format'
import AccountOriginBadges from '@/components/common/AccountOriginBadges.vue'
import SafeAvatar from '@/components/common/SafeAvatar.vue'

type RewardUser = {
  rank: number;
  twitterId: string;
  twitterName?: string;
  twitterUsername?: string;
  profile?: string;
  claimableUsd: number | string;
  claimedUsd: number | string;
  totalUsd: number | string;
  assetCount: number;
  socialUsd: number | string;
  nftHoldingUsd: number | string;
  indexPoolUsd: number | string;
  stakingUsd: number | string;
  accountSources?: string[] | string | null;
  accountType?: number | null;
  walletType?: number | null;
}

type LeaderboardPage = {
  page: number;
  size: number;
  totalUsers: number;
  totalRewardsUsd: number;
  hasMore: boolean;
  generatedAt?: string | null;
  rows: RewardUser[];
}

const PAGE_SIZE = 30
const categoryOptions: Array<{ value: RewardCategory; label: string; short: string }> = [
  { value: 'all', label: 'All', short: 'All' },
  { value: 'social', label: 'Social Reward', short: 'Social' },
  { value: 'nft_holding', label: 'NFT Holder Rewards', short: 'NFT' },
  { value: 'index_pool', label: 'Index Token Mining', short: 'Index' },
  { value: 'staking', label: 'Staking Rewards', short: 'Staking' },
]
const periodOptions: Array<{ value: RewardPeriod; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '1 month' },
]
const categoryDescriptions: Record<RewardCategory, string> = {
  all: 'Social, NFT holder, index mining and staking rewards',
  social: 'Creation, curation and Space rewards',
  nft_holding: 'Rewards distributed to eligible NFT holders',
  index_pool: 'Rewards from staking index tokens or NFT-created indexes',
  staking: 'Rewards from staking TagCoin',
}

const category = ref<RewardCategory>('all')
const period = ref<RewardPeriod>('all')
const loading = ref(false)
const loadingMore = ref(false)
const users = ref<RewardUser[]>([])
const page = ref(0)
const hasMore = ref(false)
const totalUsers = ref(0)
const totalRewardsUsd = ref(0)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let requestGeneration = 0

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
    const response = await getRewardLeaderboard(
      category.value,
      period.value,
      page.value,
      PAGE_SIZE,
    ) as LeaderboardPage
    if (generation !== requestGeneration) return
    users.value = reset ? response.rows : [...users.value, ...response.rows]
    totalUsers.value = response.totalUsers
    totalRewardsUsd.value = response.totalRewardsUsd
    hasMore.value = response.hasMore
    if (response.hasMore) page.value += 1
  } catch (error) {
    if (generation !== requestGeneration) return
    console.warn('[Earn] reward leaderboard unavailable', error)
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

watch([category, period], async () => {
  await load(true)
  await nextTick()
  installObserver()
}, { immediate: true })

onMounted(installObserver)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="mx-auto w-full max-w-[760px] px-3 py-3">
    <nav class="category-tabs" aria-label="Reward category">
      <button v-for="option in categoryOptions" :key="option.value" class="category-tab"
        :class="{ 'category-tab--active': category === option.value }" @click="category = option.value">
        <span class="sm:hidden">{{ option.short }}</span><span class="hidden sm:inline">{{ option.label }}</span>
      </button>
    </nav>

    <section class="earn-hero mt-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <span class="text-xs uppercase tracking-[.16em] text-grey-64">TagAI community rewards</span>
          <h1 class="mt-2 text-2xl font-bold text-content">{{ categoryOptions.find(o => o.value === category)?.label }}</h1>
          <p class="mt-1 max-w-[420px] text-sm text-grey-64">{{ categoryDescriptions[category] }}</p>
        </div>
        <div class="text-right">
          <strong class="block text-2xl font-bold tabular-nums text-content">{{ formatUsd(totalRewardsUsd) }}</strong>
          <span class="text-xs text-grey-64">{{ totalUsers }} users</span>
        </div>
      </div>
      <div class="period-tabs mt-5">
        <button v-for="option in periodOptions" :key="option.value" class="period-tab"
          :class="{ 'period-tab--active': period === option.value }" @click="period = option.value">{{ option.label }}</button>
      </div>
    </section>

    <div v-if="loading" class="flex justify-center py-12"><i-ep-loading class="h-7 w-7 animate-spin text-orange-normal" /></div>
    <div v-else-if="!users.length" class="mt-3 rounded-2xl bg-white p-8 text-center text-grey-64">No reward data for this category and period yet.</div>
    <div v-else class="mt-3 space-y-2">
      <article v-for="user in users" :key="user.twitterId" class="reward-user">
        <div class="rank" :class="user.rank <= 3 ? `rank--${user.rank}` : ''">{{ user.rank }}</div>
        <SafeAvatar :src="user.profile" :seed="user.twitterId || user.twitterUsername"
          class="h-11 w-11 rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <strong class="truncate text-base text-content">{{ user.twitterName || user.twitterUsername || 'TagAI user' }}</strong>
            <AccountOriginBadges :sources="user.accountSources" :account-type="user.accountType" :wallet-type="user.walletType" />
          </div>
          <span class="block truncate text-xs text-grey-64">@{{ user.twitterUsername || user.twitterId }} · {{ user.assetCount }} assets</span>
          <div v-if="category === 'all'" class="mt-1 flex flex-wrap gap-x-2 text-[10px] text-grey-64">
            <span v-if="Number(user.socialUsd)">Social {{ formatUsd(Number(user.socialUsd)) }}</span>
            <span v-if="Number(user.nftHoldingUsd)">NFT {{ formatUsd(Number(user.nftHoldingUsd)) }}</span>
            <span v-if="Number(user.indexPoolUsd)">Index {{ formatUsd(Number(user.indexPoolUsd)) }}</span>
            <span v-if="Number(user.stakingUsd)">Staking {{ formatUsd(Number(user.stakingUsd)) }}</span>
          </div>
        </div>
        <div class="text-right">
          <strong class="block text-base tabular-nums text-content">{{ formatUsd(Number(user.totalUsd)) }}</strong>
          <span class="block text-[10px] text-grey-64">Claimable {{ formatUsd(Number(user.claimableUsd)) }}</span>
          <span class="block text-[10px] text-grey-64">Claimed {{ formatUsd(Number(user.claimedUsd)) }}</span>
        </div>
      </article>
      <div ref="sentinel" class="flex min-h-10 items-center justify-center py-3">
        <i-ep-loading v-if="loadingMore" class="h-5 w-5 animate-spin text-orange-normal" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-tabs { display:flex; gap:4px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
.category-tabs::-webkit-scrollbar { display:none; }
.category-tab { flex:none; height:34px; border-radius:999px; padding:0 13px; color:var(--text-muted); font-size:12px; font-weight:600; white-space:nowrap; }
.category-tab--active { background:#fe913f; color:#fff; }
.earn-hero { padding:20px; border:1px solid var(--border-base); border-radius:24px; background:radial-gradient(circle at 100% 0,rgba(254,145,63,.2),transparent 45%),var(--surface); }
.period-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; padding:4px; border-radius:12px; background:var(--surface-2); }
.period-tab { height:30px; border-radius:9px; color:var(--text-muted); font-size:11px; font-weight:600; }
.period-tab--active { background:var(--surface); color:var(--text); box-shadow:0 1px 4px rgba(31,35,41,.08); }
.reward-user { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid var(--border-base); border-radius:16px; background:var(--surface); }
.rank { display:flex; width:28px; height:28px; flex:none; align-items:center; justify-content:center; border-radius:999px; background:var(--surface-2); color:var(--text-muted); font-size:12px; font-weight:700; }
.rank--1 { background:#fff0b8; color:#a36600; }.rank--2 { background:#edf0f5; color:#626a79; }.rank--3 { background:#f7dfd0; color:#9a5936; }
@media (max-width:420px) { .earn-hero { padding:16px; }.reward-user { gap:9px; padding:12px 10px; } }
</style>
