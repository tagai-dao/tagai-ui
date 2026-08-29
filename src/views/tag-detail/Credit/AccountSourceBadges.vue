<script setup lang="ts">
import { computed } from 'vue'
import { externalSourceLogos } from '@/assets/externalSourceLogos'

const props = defineProps<{
  sources?: string[] | string | null
}>()

const supportedSources = computed(() => {
  const values = Array.isArray(props.sources)
    ? props.sources
    : String(props.sources || '').split(',')
  return [...new Set(values.map(source => source.trim().toUpperCase()))]
    .filter((source): source is keyof typeof externalSourceLogos => source in externalSourceLogos)
})
</script>

<template>
  <span v-if="supportedSources.length" class="inline-flex shrink-0 items-center gap-0.5">
    <img
      v-for="source in supportedSources"
      :key="source"
      :src="externalSourceLogos[source]"
      :alt="`${source} account`"
      :title="source"
      class="h-4 w-4 rounded-full border border-black/10 object-cover"
    />
  </span>
</template>
