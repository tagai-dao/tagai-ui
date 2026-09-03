<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getIPShareList, getIPShareMarketSummary, type IPShareMarketSummary } from '@/apis/api'
import { formatAmount, formatPrice } from '@/utils/helper'
import { calculateIPsharePriceLocal } from '@/utils/ipshare'
import { getIPshareMarketStats } from '@/utils/ipshareAsset'
import { useStateStore } from '@/stores/common'
import { useChainStore } from '@/stores/chain'
import { useRouter } from 'vue-router'
import { handleErrorTip } from '@/utils/notify'
import IPShareTradeModal from '@/components/ipshare/IPShareTradeModal.vue'
import { isAddress } from 'viem'
import emptyProfile from '@/assets/icons/icon-default-avatar-v2.png'
import AccountOriginBadges from '@/components/common/AccountOriginBadges.vue'

type IPShareListItem = {
  twitterId?: string
  twitterName?: string
  twitterUsername?: string
  ethAddr?: string
  profile?: string
  followers?: number
  supply: number
  totalStaked: number
  accountSources?: string[] | string | null
  accountType?: number | null
  walletType?: number | null
}

const PAGE_SIZE = 30
const router = useRouter()
const stateStore = useStateStore()
const chainStore = useChainStore()

const refreshing = ref(false)
const listLoading = ref(false)
const listFinished = ref(false)
const list = ref<IPShareListItem[]>([])
const searchQuery = ref('')
const modalVisible = ref(false)
const selectedIP = ref<IPShareListItem | null>(null)
const marketSummary = ref<IPShareMarketSummary | null>(null)

const profile = (ip: IPShareListItem) =>
  ip.profile?.replace('normal', '200x200') ||
  (ip.twitterId ? `https://profile-images.heywallet.com/${ip.twitterId}` : emptyProfile)

const replaceEmptyProfile = (event: Event) => {
  const image = event.target as HTMLImageElement
  image.src = emptyProfile
}

const formatCompact = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return formatAmount(value)
}

const price = (ip: IPShareListItem) =>
  formatPrice(stateStore.ethPrice * calculateIPsharePriceLocal(ip.supply))

const stakedRatio = (ip: IPShareListItem) =>
  ip.supply > 0 ? Math.min(100, (ip.totalStaked / ip.supply) * 100) : 0

async function loadMarketSummary() {
  try {
    marketSummary.value = await getIPShareMarketSummary()
  } catch (error) {
    console.error('Get IPShare market summary failed:', error)
  }
}

const formatSummaryUsd = (nativeAmount?: number) =>
  formatPrice((Number(nativeAmount) || 0) * stateStore.ethPrice)

async function hydrateMarketStats(items: any[]): Promise<IPShareListItem[]> {
  const normalized = items.map(ip => ({
    ...ip,
    supply: Number(ip.supply) || 0,
    totalStaked: 0,
  })) as IPShareListItem[]
  const addresses = normalized
    .map(ip => ip.ethAddr)
    .filter((address): address is string => !!address && isAddress(address))

  if (addresses.length === 0) return normalized
  const stats = await getIPshareMarketStats(addresses)

  return normalized.map(ip => {
    if (!ip.ethAddr || !isAddress(ip.ethAddr)) return ip
    return {
      ...ip,
      supply: stats.supplies[ip.ethAddr] ?? ip.supply,
      totalStaked: stats.totalStaked[ip.ethAddr] ?? 0,
    }
  })
}

let refreshRequestId = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function refreshList(refreshSummary: boolean) {
  const requestId = ++refreshRequestId
  const keyword = searchQuery.value.trim()
  try {
    refreshing.value = true
    listFinished.value = false
    const [response] = await Promise.all([
      getIPShareList(0, keyword || undefined) as Promise<any[]>,
      refreshSummary ? loadMarketSummary() : Promise.resolve(),
    ])
    if (requestId !== refreshRequestId) return
    const items = Array.isArray(response) ? response.slice(0, PAGE_SIZE) : []
    list.value = await hydrateMarketStats(items)
    if (requestId !== refreshRequestId) return
    listFinished.value = !Array.isArray(response) || response.length < PAGE_SIZE
  } catch (error) {
    if (requestId === refreshRequestId) handleErrorTip(error)
  } finally {
    if (requestId === refreshRequestId) refreshing.value = false
  }
}

function onRefresh() {
  return refreshList(true)
}

async function onLoad() {
  if (refreshing.value || listFinished.value || listLoading.value || list.value.length === 0) return
  const requestId = refreshRequestId
  try {
    listLoading.value = true
    const pageIndex = Math.floor((list.value.length - 1) / PAGE_SIZE) + 1
    const keyword = searchQuery.value.trim()
    const response = await getIPShareList(pageIndex, keyword || undefined) as any[]
    if (requestId !== refreshRequestId || keyword !== searchQuery.value.trim()) return
    const items = Array.isArray(response) ? response : []
    if (items.length < PAGE_SIZE) listFinished.value = true
    if (items.length === 0) return

    const hydrated = await hydrateMarketStats(items)
    const existing = new Set(list.value.map(ip => ip.ethAddr || ip.twitterId))
    list.value = [...list.value, ...hydrated.filter(ip => !existing.has(ip.ethAddr || ip.twitterId))]
  } catch (error) {
    handleErrorTip(error)
  } finally {
    listLoading.value = false
  }
}

function gotoUserPage(ip: IPShareListItem) {
  if (ip.twitterUsername) router.push(`/user/${ip.twitterUsername}`)
}

function onTrade(ip: IPShareListItem) {
  selectedIP.value = ip
  modalVisible.value = true
}

function onModalClose() {
  modalVisible.value = false
  selectedIP.value = null
  void onRefresh()
}

watch(searchQuery, () => {
  // Invalidate any list/pagination response issued for the previous keyword.
  refreshRequestId += 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    void refreshList(false)
  }, 350)
})

onMounted(() => void onRefresh())
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  refreshRequestId += 1
})
</script>

<template>
  <div class="ipshare-page">
    <van-pull-refresh
      v-model="refreshing"
      class="min-h-full"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
      @refresh="onRefresh"
    >
      <div class="ipshare-shell">
        <header class="hero">
          <div class="hero__grid" aria-hidden="true" />
          <div class="hero__content">
            <div class="hero__copy">
              <div class="network-badge"><i /> {{ chainStore.deployment.name }} · IPShare</div>
              <h1>{{ $t('ipshare.listTitle') }}</h1>
              <p>{{ $t('ipshare.listDesc') }}</p>
            </div>
            <div class="hero__stats">
              <div>
                <span>{{ $t('ipshare.totalTradeVolume') }}</span>
                <strong>{{ formatSummaryUsd(marketSummary?.totalTradeVolume) }}</strong>
              </div>
              <div>
                <span>{{ $t('ipshare.totalValueCaptured') }}</span>
                <strong>{{ formatSummaryUsd(marketSummary?.totalValueCaptured) }}</strong>
              </div>
            </div>
          </div>
        </header>

        <div class="toolbar">
          <label class="search-field">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="5.75" stroke="currentColor" stroke-width="1.5" />
              <path d="m13.25 13.25 3.25 3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <input v-model="searchQuery" type="search" :placeholder="$t('ipshare.searchPlaceholder')">
          </label>
          <button class="refresh-button" type="button" :disabled="refreshing" @click="onRefresh">
            <svg viewBox="0 0 20 20" fill="none" :class="{ 'animate-spin': refreshing }" aria-hidden="true">
              <path d="M15.9 8a6.25 6.25 0 1 0 .1 3.6M16 4.5V8h-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ $t('ipshare.refresh') }}</span>
          </button>
        </div>

        <van-list
          :loading="listLoading"
          :finished="listFinished"
          :immediate-check="false"
          :loading-text="$t('loading')"
          :finished-text="list.length ? $t('noMore') : ''"
          @load="onLoad"
        >
          <div v-if="!refreshing && list.length === 0" class="empty-state">
            <img v-if="!searchQuery" src="~@/assets/images/empty-data.svg" alt="">
            <span>{{ searchQuery ? $t('ipshare.noResults') : '' }}</span>
          </div>

          <div v-else class="ipshare-grid">
            <article
              v-for="ip in list"
              :key="ip.ethAddr || ip.twitterId"
              class="ipshare-card"
              @click="gotoUserPage(ip)"
            >
              <div class="card__header">
                <div class="identity">
                  <img :src="profile(ip)" @error="replaceEmptyProfile" alt="">
                  <div>
                    <div class="identity__name">
                      <strong>{{ ip.twitterName || 'Unknown' }}</strong>
                      <AccountOriginBadges :sources="ip.accountSources" :account-type="ip.accountType" :wallet-type="ip.walletType" :eth-addr="ip.ethAddr" />
                    </div>
                    <span>@{{ ip.twitterUsername || 'unknown' }}</span>
                  </div>
                </div>
                <button type="button" class="trade-button" @click.stop="onTrade(ip)">
                  {{ $t('trade') }}
                </button>
              </div>

              <div class="card__price">
                <span>IPShare {{ $t('postView.price') }}</span>
                <strong>{{ price(ip) }}</strong>
              </div>

              <div class="card__metrics">
                <div>
                  <span>{{ $t('ipshare.totalSupply') }}</span>
                  <strong>{{ formatCompact(ip.supply) }}</strong>
                </div>
                <div>
                  <span>{{ $t('ipshare.totalStaked') }}</span>
                  <strong>{{ formatCompact(ip.totalStaked) }}</strong>
                </div>
                <div>
                  <span>{{ $t('ipshare.stakedRatio') }}</span>
                  <strong>{{ stakedRatio(ip).toFixed(1) }}%</strong>
                </div>
              </div>

            </article>
          </div>
        </van-list>
      </div>
    </van-pull-refresh>

    <IPShareTradeModal
      v-if="selectedIP?.ethAddr"
      v-model="modalVisible"
      :subject-address="selectedIP.ethAddr"
      :subject-info="{ name: selectedIP.twitterName, supply: selectedIP.supply }"
      @success="onModalClose"
    />
  </div>
</template>

<style scoped>
.ipshare-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(circle at 10% 0%, rgba(255, 122, 0, 0.07), transparent 25rem),
    radial-gradient(circle at 94% 28%, rgba(252, 164, 84, 0.06), transparent 22rem);
}

.ipshare-shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: 18px 16px 40px; }

.hero {
  position: relative;
  overflow: hidden;
  padding: 28px;
  border: 1px solid var(--border-base);
  border-radius: 26px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}
.hero::after {
  content: '';
  position: absolute;
  right: -80px;
  top: -125px;
  width: 330px;
  height: 330px;
  border-radius: 50%;
  background: conic-gradient(from 60deg, rgba(255,122,0,.28), rgba(252,164,84,.16), rgba(255,196,120,.12), rgba(255,122,0,.28));
  filter: blur(30px);
  opacity: .6;
}
.hero__grid {
  position: absolute;
  inset: 0;
  opacity: .055;
  background-image: linear-gradient(var(--text-base) 1px, transparent 1px), linear-gradient(90deg, var(--text-base) 1px, transparent 1px);
  background-size: 30px 30px;
  mask-image: linear-gradient(to right, transparent, #000 72%);
}
.hero__content { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.hero__copy { max-width: 540px; }
.network-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.network-badge i { width: 7px; height: 7px; border-radius: 50%; background: #ff8a2a; box-shadow: 0 0 10px rgba(255,138,42,.8); }
.hero h1 { margin-top: 16px; color: var(--text-base); font-size: clamp(30px, 4vw, 46px); font-weight: 750; line-height: 1; letter-spacing: -.05em; }
.hero p { margin-top: 12px; color: var(--text-muted); font-size: 14px; line-height: 1.65; }
.hero__stats { display: grid; grid-template-columns: repeat(2, minmax(145px, 1fr)); gap: 9px; }
.hero__stats > div {
  display: flex;
  min-width: 105px;
  flex-direction: column;
  gap: 4px;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--surface-2) 72%, transparent);
}
.hero__stats span, .card__metrics span { color: var(--text-muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.hero__stats strong { color: var(--text-base); font-size: 18px; line-height: 24px; }

.toolbar { display: flex; gap: 10px; margin: 18px 0; }
.search-field {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 15px;
  border: 1px solid var(--border-base);
  border-radius: 15px;
  background: var(--surface);
  color: var(--text-muted);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.search-field:focus-within { border-color: #ff8a2a; box-shadow: 0 0 0 3px rgba(255,138,42,.1); }
.search-field svg, .refresh-button svg { width: 18px; height: 18px; flex-shrink: 0; }
.search-field input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 13px; }
.search-field input::placeholder { color: var(--text-faint); }
.refresh-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  padding: 0 16px;
  border: 1px solid var(--border-base);
  border-radius: 15px;
  background: var(--surface);
  color: var(--text-base);
  font-size: 12px;
  font-weight: 650;
}
.refresh-button:hover:not(:disabled) { background: var(--surface-2); }
.refresh-button:disabled { opacity: .6; cursor: wait; }

.ipshare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.ipshare-card {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border-base);
  border-radius: 20px;
  background: var(--surface);
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}
.ipshare-card:hover { transform: translateY(-2px); border-color: rgba(255,122,0,.45); box-shadow: 0 14px 32px rgba(15,16,20,.08); }
.card__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.identity { display: flex; min-width: 0; align-items: center; gap: 11px; }
.identity img { width: 44px; height: 44px; flex: 0 0 44px; border: 1px solid var(--border-base); border-radius: 50%; object-fit: cover; }
.identity div { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.identity .identity__name { flex-direction: row; align-items: center; gap: 4px; }
.identity strong { overflow: hidden; color: var(--text-base); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.identity span { overflow: hidden; color: var(--text-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.trade-button { height: 32px; padding: 0 15px; border: 1px solid #ff7a00; border-radius: 999px; color: #ff7a00; font-size: 12px; font-weight: 650; transition: color 160ms ease, background 160ms ease; }
.trade-button:hover { background: #ff7a00; color: #fff; }
.card__price { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--border-base); }
.card__price span { color: var(--text-muted); font-size: 11px; }
.card__price strong { color: var(--text-base); font-size: 22px; line-height: 1; }
.card__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.card__metrics > div { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.card__metrics strong { overflow: hidden; color: var(--text-base); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.empty-state { display: flex; min-height: 250px; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-muted); font-size: 13px; }
.empty-state img { width: 120px; }

@media (max-width: 900px) {
  .hero__content { align-items: stretch; flex-direction: column; }
  .hero__stats { width: 100%; }
  .hero__stats > div { min-width: 0; }
}
@media (max-width: 720px) { .ipshare-grid { grid-template-columns: 1fr; } }
@media (max-width: 803px) {
  .ipshare-shell { padding: 14px 12px 88px; }
  .hero { padding: 22px 18px; border-radius: 22px; }
}
@media (max-width: 460px) {
  .hero__stats { grid-template-columns: 1fr; }
  .hero__stats { gap: 6px; }
  .hero__stats > div { padding: 11px 9px; }
  .hero__stats strong { font-size: 15px; }
  .refresh-button { width: 46px; padding: 0; }
  .refresh-button span { display: none; }
  .ipshare-card { padding: 15px; }
}
</style>
