<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useChainStore } from '@/stores/chain'
import { useI18n } from 'vue-i18n'
import { displayReadStatus, DISPLAY_READ_EVENT, type ReadStatus } from '@/utils/displayRead'
import { invalidatePublicReads } from '@/apis/api'
const props = defineProps<{ paths: string[]; scope?: string }>()
const emit = defineEmits<{ retry: []; updated: [] }>()
const chain = useChainStore()
const { locale } = useI18n()
const zh = computed(() => String(locale.value).startsWith('zh'))
const version = ref(0)
const enteredAt = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined
const matches = (s: ReadStatus) => s.chainId === chain.activeChainId && s.touchedAt >= enteredAt - 1000 && props.paths.some(p => s.path.startsWith(p)) && (!props.scope || s.key.includes(JSON.stringify(props.scope)))
const statuses = computed(() => { version.value; return [...displayReadStatus.values()].filter(matches) })
const unavailable = computed(() => statuses.value.some(s => s.failed && !s.stale))
const stale = computed(() => statuses.value.some(s => s.stale))
const updatedAt = computed(() => statuses.value.filter(s => s.stale && s.updatedAt).map(s => s.updatedAt!).sort()[0])
function changed(event: Event) {
  version.value++
  const s = (event as CustomEvent<ReadStatus>).detail
  if (s?.backgroundComplete && matches(s)) {
    clearTimeout(timer)
    timer = setTimeout(() => emit('updated'), 100)
  }
}
function retry() { invalidatePublicReads(props.paths); emit('retry') }
onMounted(() => window.addEventListener(DISPLAY_READ_EVENT, changed))
onBeforeUnmount(() => { window.removeEventListener(DISPLAY_READ_EVENT, changed); clearTimeout(timer) })
</script>

<template>
  <div v-if="unavailable || stale" role="status" class="mx-2 my-1 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-grey-64">
    <span>
      {{ unavailable ? (zh ? '部分内容暂时加载失败，可重试。' : 'Some content is unavailable. Please retry.') : (zh ? '正在显示上次更新的数据' : 'Showing the last available data') }}
      <span v-if="updatedAt"> · {{ new Date(updatedAt).toLocaleString() }}</span>
    </span>
    <button class="shrink-0 px-2 py-1 text-orange-normal" @click="retry">{{ zh ? '刷新' : 'Refresh' }}</button>
  </div>
</template>
