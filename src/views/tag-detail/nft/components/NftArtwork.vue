<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ src?: string; alt: string }>()
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>

<template>
  <div class="aspect-square overflow-hidden rounded-xl bg-surface-2">
    <img v-if="src && !failed" :src="src" :alt="alt" class="h-full w-full object-cover" @error="failed = true" />
    <div v-else class="flex h-full items-center justify-center text-sm text-grey-3f">{{ alt }}</div>
  </div>
</template>
