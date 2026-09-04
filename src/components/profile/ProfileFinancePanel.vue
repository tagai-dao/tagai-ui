<script setup lang="ts">
import { ref } from 'vue'
import ProfilePnlCard from '@/components/profile/ProfilePnlCard.vue'

defineProps<{
  twitterId?: string | null
  username?: string | null
}>()

const active = ref<'pnl' | 'ipshare'>('pnl')
</script>

<template>
  <section class="mx-3 flex-none overflow-hidden rounded-2xl bg-white">
    <nav class="flex border-b border-grey-e6 px-3 pt-1" aria-label="Profile finance">
      <button class="finance-tab" :class="{ 'finance-tab--active': active === 'pnl' }" @click="active = 'pnl'">
        PnL
      </button>
      <button class="finance-tab" :class="{ 'finance-tab--active': active === 'ipshare' }" @click="active = 'ipshare'">
        IPShare
      </button>
    </nav>
    <ProfilePnlCard v-if="active === 'pnl'" :twitter-id="twitterId" :username="username" />
    <div v-else class="p-3"><slot name="ipshare" /></div>
  </section>
</template>

<style scoped>
.finance-tab {
  position: relative;
  min-width: 5rem;
  padding: .7rem 1rem;
  color: #8d8d8d;
  font-size: .875rem;
  font-weight: 700;
}
.finance-tab--active { color: #ff7a16; }
.finance-tab--active::after {
  position: absolute;
  right: 1rem;
  bottom: 0;
  left: 1rem;
  height: 2px;
  border-radius: 999px;
  background: #ff7a16;
  content: '';
}
</style>
