<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FeedTokenSheetAsset } from '@/types'
import BuyAndSellView from '@/views/buy-sell/BuyAndSellView.vue'

const props = defineProps<{
  modelValue: boolean
  asset: FeedTokenSheetAsset | null
}>()
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
}>()

const panel = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const offset = ref(0)
const dragging = ref(false)
let startY = 0
let startAt = 0
let canDrag = false

function resetDrag() {
  offset.value = 0
  dragging.value = false
  canDrag = false
}

function close() {
  resetDrag()
  emit('update:modelValue', false)
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  startY = event.touches[0]!.clientY
  startAt = performance.now()
  canDrag = (scroller.value?.scrollTop || 0) <= 0
  offset.value = 0
  dragging.value = false
}

function onTouchMove(event: TouchEvent) {
  if (!canDrag || event.touches.length !== 1) return
  const deltaY = event.touches[0]!.clientY - startY
  if (deltaY <= 0) return
  if ((scroller.value?.scrollTop || 0) > 0) {
    canDrag = false
    return
  }
  if (deltaY > 4) dragging.value = true
  if (!dragging.value) return
  event.preventDefault()
  offset.value = deltaY
}

function onTouchEnd() {
  if (!canDrag) return resetDrag()
  const elapsed = Math.max(performance.now() - startAt, 1)
  const velocity = offset.value / elapsed
  const threshold = Math.min((panel.value?.offsetHeight || 500) * 0.22, 140)
  if (offset.value >= threshold || (offset.value >= 44 && velocity >= 0.65)) close()
  else resetDrag()
}

watch(() => props.modelValue, visible => {
  if (visible) resetDrag()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="feed-trade-sheet">
      <div v-if="modelValue && asset" class="feed-trade-sheet-layer fixed inset-x-0 top-0 z-[140]">
        <button type="button" class="absolute inset-0 w-full bg-black/25" aria-label="Close trade" @click="close" />
        <section
          ref="panel"
          class="feed-trade-sheet-panel absolute inset-x-0 bottom-0 z-10 mx-auto flex max-h-[78dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] border border-grey-light-hover bg-surface shadow-2xl"
          :class="{ 'feed-trade-sheet-panel--dragging': dragging }"
          :style="offset ? { transform: `translateY(${offset}px)` } : undefined"
          @click.stop
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <div class="flex shrink-0 justify-center py-2.5">
            <span class="h-1 w-10 rounded-full bg-grey-light-active" />
          </div>
          <div class="flex items-center gap-3 border-b border-grey-light-hover px-4 pb-3">
            <img v-if="asset.logo" :src="asset.logo" class="h-9 w-9 rounded-full object-cover" alt="">
            <div v-else class="h-9 w-9 rounded-full bg-grey-light-active" />
            <div class="min-w-0 flex-1">
              <strong class="block truncate text-base text-content">{{ asset.name || asset.tick }}</strong>
              <span class="text-xs text-grey-64">${{ asset.tick }}</span>
            </div>
          </div>
          <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 no-scroll-bar">
            <BuyAndSellView :key="`${asset.tick}-${asset.sellsman || ''}`" :tick="asset.tick" :sellsman="asset.sellsman" />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.feed-trade-sheet-layer { bottom: calc(3.5rem + var(--safe-area-bottom, 0px)); }
.feed-trade-sheet-panel { transition: transform .22s ease-out; }
.feed-trade-sheet-panel--dragging { transition: none; }
.feed-trade-sheet-enter-active, .feed-trade-sheet-leave-active { transition: opacity .2s ease; }
.feed-trade-sheet-enter-active .feed-trade-sheet-panel, .feed-trade-sheet-leave-active .feed-trade-sheet-panel { transition: transform .24s ease; }
.feed-trade-sheet-enter-from, .feed-trade-sheet-leave-to { opacity: 0; }
.feed-trade-sheet-enter-from .feed-trade-sheet-panel, .feed-trade-sheet-leave-to .feed-trade-sheet-panel { transform: translateY(100%); }
@media (min-width: 804px) { .feed-trade-sheet-layer { bottom: 0; } }
</style>
