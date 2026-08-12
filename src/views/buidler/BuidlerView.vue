<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IPList from '@/views/ip/IPList.vue'
import EarnView from '@/views/buidler/EarnView.vue'
const route = useRoute()
const router = useRouter()
const tab = computed(() => route.query.tab === 'earn' ? 'earn' : 'ipshare')
function select(next: 'ipshare' | 'earn') { router.replace({ query: next === 'earn' ? { tab: 'earn' } : {} }) }
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden pb-2 pt-2">
    <div class="mx-auto flex w-full max-w-[1240px] flex-shrink-0 gap-2 px-3">
      <button class="h-9 border-b-2 px-3 text-base" :class="tab === 'ipshare' ? 'border-orange-normal font-semibold text-orange-normal' : 'border-transparent text-content'" @click="select('ipshare')">IPShare</button>
      <button class="h-9 border-b-2 px-3 text-base" :class="tab === 'earn' ? 'border-orange-normal font-semibold text-orange-normal' : 'border-transparent text-content'" @click="select('earn')">Earn</button>
    </div>
    <div class="min-h-0 flex-1 overflow-auto"><IPList v-if="tab === 'ipshare'" /><EarnView v-else /></div>
  </div>
</template>
