<script setup lang="ts">
import bnbLogo from '@/assets/bnb-logo.svg'

defineProps<{
  chain: 'bsc' | 'rh'
}>()
</script>

<template>
  <span class="chain-logo" :class="`chain-logo--${chain}`" aria-hidden="true">
    <img v-if="chain === 'bsc'" :src="bnbLogo" alt="">
    <svg v-else viewBox="0 0 32 32" fill="none">
      <path d="M9 23.5c1.1-6.3 5-11.2 12.8-14.6-1 2.4-2.4 4.4-4.3 6.1 1.7-.5 3.4-1.3 5.3-2.5-2.1 4.3-5.5 7.1-10.2 8.5l-1.8 2.5H9Z" fill="currentColor" />
      <path d="M11.4 24.4h8.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".55" />
    </svg>
  </span>
</template>

<style scoped>
.chain-logo {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .34), 0 5px 12px rgba(12, 15, 24, .1);
}

.chain-logo svg { width: 24px; height: 24px; }
.chain-logo img { width: 100%; height: 100%; object-fit: contain; }
.chain-logo--bsc { overflow: hidden; border-radius: 50%; background: #f0b90b; color: #171717; }
.chain-logo--rh { background: linear-gradient(145deg, #d9ff5f, #6cdf3b); color: #10220b; }
</style>
