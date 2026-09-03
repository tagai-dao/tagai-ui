<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IPList from '@/views/ip/IPList.vue'
import EarnView from '@/views/buidler/EarnView.vue'
import PnlView from '@/views/buidler/PnlView.vue'
const route = useRoute()
const router = useRouter()
type BuidlerTab = 'ipshare' | 'pnl' | 'earn'
const tab = computed<BuidlerTab>(() => {
  if (route.query.tab === 'pnl') return 'pnl'
  if (route.query.tab === 'earn') return 'earn'
  return 'ipshare'
})
function select(next: BuidlerTab) { router.replace({ query: next === 'ipshare' ? {} : { tab: next } }) }
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden pb-2 pt-2">
    <div class="mx-auto flex w-full max-w-[1240px] flex-shrink-0 gap-2 px-3">
      <button class="h-9 border-b-2 px-3 text-base" :class="tab === 'ipshare' ? 'border-orange-normal font-semibold text-orange-normal' : 'border-transparent text-content'" @click="select('ipshare')">IPShare</button>
      <button class="h-9 border-b-2 px-3 text-base" :class="tab === 'pnl' ? 'border-orange-normal font-semibold text-orange-normal' : 'border-transparent text-content'" @click="select('pnl')">PnL</button>
      <button class="h-9 border-b-2 px-3 text-base" :class="tab === 'earn' ? 'border-orange-normal font-semibold text-orange-normal' : 'border-transparent text-content'" @click="select('earn')">Earn</button>
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      <IPList v-if="tab === 'ipshare'" />
      <PnlView v-else-if="tab === 'pnl'" />
      <EarnView v-else />
    </div>
  </div>
</template>
