<script setup lang="ts">
import tagaiLogo from '@/assets/logo.png'
</script>

<template>
  <span class="absolute -bottom-1 -right-1 z-10 inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-orange-normal bg-white shadow-sm ring-2 ring-surface web:h-6 web:w-6" title="Launched on TagAI">
    <img :src="tagaiLogo" alt="TagAI" class="h-auto w-3.5 object-contain web:w-[18px]" />
  </span>
</template>
