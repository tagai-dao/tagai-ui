<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { NutboxCommunityByTokenResponse, NutboxIndexBrokerPool } from '@/types/nutbox'
import { useNutboxNftPool } from '@/composables/useNutboxNftPool'
import NftMintAmm from './components/NftMintAmm.vue'
import NftActivateMining from './components/NftActivateMining.vue'
import NftHolderRewards from './components/NftHolderRewards.vue'
import NftAbout from './components/NftAbout.vue'
import NftPoolOverview from './components/NftPoolOverview.vue'

const props = defineProps<{
  community: NutboxCommunityByTokenResponse
}>()

const route = useRoute()
const router = useRouter()
const sections = [
  { key: 'mint-amm', label: 'Mint & AMM trading' },
  { key: 'mining', label: 'Activate mining' },
  { key: 'referral', label: 'Holder rewards' },
  { key: 'about', label: 'About' },
] as const
type Section = typeof sections[number]['key']

const nftPools = computed(() => props.community.pools
  .filter(pool => pool.status === 'OPENED' && pool.poolType === 'INDEX_BROKER_NFT' && pool.indexBroker)
  .sort((a, b) => Number(b.ratio || 0) - Number(a.ratio || 0)))
const selectedPoolAddress = ref('')
const selectedPool = computed<NutboxIndexBrokerPool | null>(() => {
  const selected = nftPools.value.find(pool => pool.pool.toLowerCase() === selectedPoolAddress.value.toLowerCase())
    || nftPools.value[0]
  return selected?.indexBroker || null
})
const activeSection = ref<Section>('mint-amm')
const nftModel = useNutboxNftPool(computed(() => selectedPool.value as NutboxIndexBrokerPool))

const syncFromRoute = () => {
  const requested = String(route.query.section || 'mint-amm') as Section
  activeSection.value = sections.some(item => item.key === requested) ? requested : 'mint-amm'
}
const selectSection = (section: Section) => {
  activeSection.value = section
  router.replace({ query: { ...route.query, section } })
}

watch(() => route.query.section, syncFromRoute, { immediate: true })
watch(nftPools, pools => {
  if (!pools.some(pool => pool.pool.toLowerCase() === selectedPoolAddress.value.toLowerCase())) {
    selectedPoolAddress.value = pools[0]?.pool || ''
  }
}, { immediate: true })

onMounted(syncFromRoute)
</script>

<template>
  <div class="flex flex-col gap-3 pb-8">
    <div v-if="nftPools.length > 1" class="rounded-2xl bg-surface p-3">
      <label class="text-xs text-grey-3f">NFT Pool</label>
      <select v-model="selectedPoolAddress" class="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-content">
        <option v-for="pool in nftPools" :key="pool.pool" :value="pool.pool">
          {{ pool.name || pool.indexBroker?.name || pool.pool }}
        </option>
      </select>
    </div>

    <div v-if="selectedPool" class="overflow-hidden rounded-2xl border border-line bg-surface">
      <NftPoolOverview :pool="selectedPool" :model="nftModel" @mining="selectSection('mining')" @rewards="selectSection('referral')" />
      <div class="overflow-x-auto no-scroll-bar">
      <div class="grid min-w-[620px] grid-cols-4" role="tablist" aria-label="NFT features">
        <button
          v-for="section in sections"
          :key="section.key"
          role="tab"
          :aria-selected="activeSection === section.key"
          class="h-14 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors"
          :class="activeSection === section.key ? 'border-orange-normal bg-orange-50 text-orange-normal' : 'border-transparent text-grey-3f hover:bg-surface-2 hover:text-content'"
          @click="selectSection(section.key)"
        >
          {{ section.label }}
        </button>
      </div>
      </div>
    </div>

    <template v-if="selectedPool">
      <NftMintAmm v-if="activeSection === 'mint-amm'" :pool="selectedPool" :model="nftModel" />
      <NftActivateMining v-else-if="activeSection === 'mining'" :pool="selectedPool" :model="nftModel" />
      <NftHolderRewards v-else-if="activeSection === 'referral'" :pool="selectedPool" :model="nftModel" />
      <NftAbout v-else :pool="selectedPool" :model="nftModel" />
    </template>
  </div>
</template>
