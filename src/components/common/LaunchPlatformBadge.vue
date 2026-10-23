<script setup lang="ts">
import tagaiLogo from '@/assets/logo.png'
import gangLogo from '@/assets/gang-launchpad.svg'
defineProps<{ platform: 'tagai' | 'gang' }>()
</script>

<template>
  <span class="absolute -bottom-1 -right-1 z-10 inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-orange-normal bg-white shadow-sm ring-2 ring-surface web:h-6 web:w-6" :title="platform === 'gang' ? 'Launched on gang.fun' : 'Launched on TagAI'">
    <img :src="platform === 'gang' ? gangLogo : tagaiLogo" :alt="platform === 'gang' ? 'gang.fun' : 'TagAI'" :class="platform === 'gang' ? 'h-full w-full object-contain' : 'h-auto w-3.5 object-contain web:w-[18px]'" />
  </span>
</template>
