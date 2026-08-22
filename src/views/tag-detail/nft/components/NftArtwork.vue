<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ src?: string; sources?: string[]; alt: string }>(), {
  src: '',
  sources: () => [],
})
const sourceIndex = ref(0)
const candidates = computed(() => [...new Set([props.src, ...props.sources].filter(Boolean))])
const currentSource = computed(() => candidates.value[sourceIndex.value] || '')
watch(() => candidates.value.join('\n'), () => { sourceIndex.value = 0 })
const useNextSource = () => { sourceIndex.value += 1 }
</script>

<template>
  <div class="aspect-square overflow-hidden rounded-2xl border border-line bg-surface-2">
    <img
      v-if="currentSource"
      :src="currentSource"
      :alt="alt"
      class="h-full w-full object-contain"
      @error="useNextSource"
    />
    <div v-else class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-grey-3f">
      <span class="text-2xl">◇</span>
      <span class="text-sm">{{ alt }}</span>
    </div>
  </div>
</template>
