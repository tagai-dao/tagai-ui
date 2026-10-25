<script setup lang="ts">
import tagaiLogo from '@/assets/logo.png'
import gangLogo from '@/assets/gang-launchpad.svg'
import flapLogo from '@/assets/flap-launchpad.svg'
import fourLogo from '@/assets/four-launchpad.svg'
defineProps<{ platform: 'tagai' | 'gang' | 'flap' | 'four' }>()
</script>

<template>
  <span class="absolute -bottom-1 -right-1 z-10 inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-orange-normal shadow-sm ring-2 ring-surface web:h-6 web:w-6" :class="platform === 'flap' ? 'bg-[#171a1c]' : 'bg-white'" :title="platform === 'four' ? 'Four.meme Agent ID' : platform === 'flap' ? 'Flap ID Agent Curve' : platform === 'gang' ? 'Launched on gang.fun' : 'Launched on TagAI'">
    <img :src="platform === 'four' ? fourLogo : platform === 'flap' ? flapLogo : platform === 'gang' ? gangLogo : tagaiLogo" :alt="platform === 'four' ? 'Four.meme' : platform === 'flap' ? 'Flap' : platform === 'gang' ? 'gang.fun' : 'TagAI'" :class="platform !== 'tagai' ? 'h-full w-full object-contain' : 'h-auto w-3.5 object-contain web:w-[18px]'" />
  </span>
</template>
