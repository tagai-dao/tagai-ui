<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useChainStore } from '@/stores/chain'
import { DISPLAY_READ_EVENT, type ReadStatus } from '@/utils/displayRead'
const props = defineProps<{ paths: string[]; scope?: string }>()
const emit = defineEmits<{ retry: []; updated: [] }>()
const chain = useChainStore()
const enteredAt = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined
const matches = (s: ReadStatus) => s.chainId === chain.activeChainId && s.touchedAt >= enteredAt - 1000 && props.paths.some(p => s.path.startsWith(p)) && (!props.scope || s.key.includes(JSON.stringify(props.scope)))
function changed(event: Event) {
  const s = (event as CustomEvent<ReadStatus>).detail
  if (s?.backgroundComplete && matches(s)) {
    clearTimeout(timer)
    timer = setTimeout(() => emit('updated'), 100)
  }
}
onMounted(() => window.addEventListener(DISPLAY_READ_EVENT, changed))
onBeforeUnmount(() => { window.removeEventListener(DISPLAY_READ_EVENT, changed); clearTimeout(timer) })
</script>

<template>
  <!-- Keep background refresh notifications active without rendering a status banner. -->
</template>
