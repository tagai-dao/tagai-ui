<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getRewardLeaderboard,
  type RewardCategory,
  type RewardPeriod,
} from '@/apis/api'
import { useStateStore } from '@/stores/common'
import { getTokenInfo } from '@/utils/pump'
import { formatUsd } from '@/utils/format'

type RewardEntry = {
  twitterId: string;
  account?: string;
  twitterName?: string;
  twitterUsername?: string;
  profile?: string;
  category: Exclude<RewardCategory, 'all'>;
  component: string;
  asset: string;
  assetType?: 'native' | 'token';
  tick?: string;
  token?: string;
  logo?: string;
  name?: string;
  claimableAmount: number | string;
  claimedAmount: number | string;
  totalAmount: number | string;
}

type RewardUser = {
  twitterId: string;
  twitterName?: string;
  twitterUsername?: string;
  profile?: string;
  claimableUsd: number;
  claimedUsd: number;
  totalUsd: number;
  assetCount: number;
  breakdown: Record<Exclude<RewardCategory, 'all'>, number>;
}

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

const stateStore = useStateStore()
const category = ref<RewardCategory>('all')
const period = ref<RewardPeriod>('all')
const loading = ref(false)
const entries = ref<RewardEntry[]>([])
const prices = ref(new Map<string, number>())

function entryUsd(entry: RewardEntry, amount: number | string) {
  const numeric = Number(amount || 0)
  if (entry.assetType === 'native' || entry.asset === 'native') {
    return numeric * stateStore.ethPrice
  }
  return numeric * (prices.value.get(entry.asset.toLowerCase()) || 0) * stateStore.ethPrice
}

const users = computed<RewardUser[]>(() => {
  type GroupedUser = RewardUser & { assets: Set<string> }
  const grouped = new Map<string, GroupedUser>()
  for (const entry of entries.value) {
    if (!entry.twitterId || !entry.asset) continue
    const user = grouped.get(entry.twitterId) || {
      twitterId: entry.twitterId,
      twitterName: entry.twitterName,
      twitterUsername: entry.twitterUsername,
      profile: entry.profile,
      claimableUsd: 0,
      claimedUsd: 0,
      totalUsd: 0,
      assetCount: 0,
      breakdown: { social: 0, nft_holding: 0, index_pool: 0, staking: 0 },
      assets: new Set<string>(),
    }
    const claimable = entryUsd(entry, entry.claimableAmount)
    const claimed = entryUsd(entry, entry.claimedAmount)
    const total = entryUsd(entry, entry.totalAmount)
    user.claimableUsd += claimable
    user.claimedUsd += claimed
    user.totalUsd += total
    user.breakdown[entry.category] += total
    user.assets.add(entry.asset.toLowerCase())
    user.assetCount = user.assets.size
    grouped.set(entry.twitterId, user)
  }
  return [...grouped.values()].sort((a, b) => b.totalUsd - a.totalUsd)
})

const totalRewardsUsd = computed(() => users.value.reduce((sum, user) => sum + user.totalUsd, 0))
const activeCategory = computed(() => categoryOptions.find(option => option.value === category.value)!)

async function load() {
  loading.value = true
  try {
    const response = await getRewardLeaderboard(category.value, period.value) as any
    const rows = (Array.isArray(response) ? response : response?.rows || []) as RewardEntry[]
    entries.value = rows
    const unique = new Map<string, any>()
    for (const row of rows) {
      if (!row.asset || row.asset === 'native') continue
      const key = row.asset.toLowerCase()
      if (!unique.has(key)) {
        unique.set(key, {
          ...row,
          token: row.asset,
          description: '',
          creator: '',
          distribution: [],
        })
      }
    }
    const hydrated = unique.size ? await getTokenInfo([...unique.values()]) : []
    prices.value = new Map(hydrated.map(token => [token.token.toLowerCase(), Number(token.price || 0)]))
  } catch (error) {
    console.warn('[Earn] reward leaderboard unavailable', error)
    entries.value = []
    prices.value = new Map()
  } finally {
    loading.value = false
  }
}

watch([category, period], load, { immediate: true })
</script>

<template>
  <div class="mx-auto w-full max-w-[760px] px-3 py-3">
    <nav class="category-tabs" aria-label="Reward category">
      <button
        v-for="option in categoryOptions"
        :key="option.value"
        class="category-tab"
        :class="{ 'category-tab--active': category === option.value }"
        @click="category = option.value"
      >
        <span class="sm:hidden">{{ option.short }}</span>
        <span class="hidden sm:inline">{{ option.label }}</span>
      </button>
    </nav>

    <section class="earn-hero mt-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <span class="text-xs uppercase tracking-[.16em] text-grey-64">TagAI community rewards</span>
          <h1 class="mt-2 text-2xl font-bold text-content">{{ activeCategory.label }}</h1>
          <p class="mt-1 max-w-[420px] text-sm text-grey-64">{{ categoryDescriptions[category] }}</p>
        </div>
        <div class="text-right">
          <strong class="block text-2xl font-bold tabular-nums text-content">{{ formatUsd(totalRewardsUsd) }}</strong>
          <span class="text-xs text-grey-64">{{ users.length }} users</span>
        </div>
      </div>
      <div class="period-tabs mt-5">
        <button
          v-for="option in periodOptions"
          :key="option.value"
          class="period-tab"
          :class="{ 'period-tab--active': period === option.value }"
          @click="period = option.value"
        >{{ option.label }}</button>
      </div>
    </section>

    <div v-if="loading" class="flex justify-center py-12">
      <i-ep-loading class="h-7 w-7 animate-spin text-orange-normal" />
    </div>
    <div v-else-if="!users.length" class="mt-3 rounded-2xl bg-white p-8 text-center text-grey-64">
      No reward data for this category and period yet.
    </div>
    <div v-else class="mt-3 space-y-2">
      <article v-for="(user, index) in users" :key="user.twitterId" class="reward-user">
        <div class="rank" :class="index < 3 ? `rank--${index + 1}` : ''">{{ index + 1 }}</div>
        <img v-if="user.profile" :src="user.profile.replace('normal', '200x200')" class="h-11 w-11 rounded-full object-cover" alt="">
        <div v-else class="h-11 w-11 flex-none rounded-full bg-grey-light-active" />
        <div class="min-w-0 flex-1">
          <strong class="block truncate text-base text-content">{{ user.twitterName || user.twitterUsername || 'TagAI user' }}</strong>
          <span class="block truncate text-xs text-grey-64">@{{ user.twitterUsername || user.twitterId }} · {{ user.assetCount }} assets</span>
          <div v-if="category === 'all'" class="mt-1 flex flex-wrap gap-x-2 text-[10px] text-grey-64">
            <span v-if="user.breakdown.social">Social {{ formatUsd(user.breakdown.social) }}</span>
            <span v-if="user.breakdown.nft_holding">NFT {{ formatUsd(user.breakdown.nft_holding) }}</span>
            <span v-if="user.breakdown.index_pool">Index {{ formatUsd(user.breakdown.index_pool) }}</span>
            <span v-if="user.breakdown.staking">Staking {{ formatUsd(user.breakdown.staking) }}</span>
          </div>
        </div>
        <div class="text-right">
          <strong class="block text-base tabular-nums text-content">{{ formatUsd(user.totalUsd) }}</strong>
          <span class="block text-[10px] text-grey-64">Claimable {{ formatUsd(user.claimableUsd) }}</span>
          <span class="block text-[10px] text-grey-64">Claimed {{ formatUsd(user.claimedUsd) }}</span>
        </div>
      </article>
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
.rank--1 { background:#fff0b8; color:#a36600; }
.rank--2 { background:#edf0f5; color:#626a79; }
.rank--3 { background:#f7dfd0; color:#9a5936; }
@media (max-width:420px) { .earn-hero { padding:16px; } .reward-user { gap:9px; padding:12px 10px; } }
</style>
