<script setup lang="ts">
/**
 * CL 流动性价格区间滑杆：拖动左右手柄调整 min/max（BNB per Token）
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { bnbPerTokenToTick, tickToBnbPerToken } from '@/utils/pcsV4Liquidity'

const props = defineProps<{
  min: number
  max: number
  current: number
  tickSpacing: number
  /** 全范围模式下禁用拖动 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [min: number, max: number]
  dragStart: []
}>()

const trackEl = ref<HTMLElement | null>(null)
const dragging = ref<'min' | 'max' | null>(null)
/** 拖动期间冻结视图边界，避免手柄跳动 */
const frozenView = ref<{ min: number, max: number } | null>(null)

const computeViewBounds = (min: number, max: number, current: number) => {
  const span = Math.max(max - min, current * 0.01, 1e-12)
  const pad = Math.max(span * 0.4, current * 0.025)
  return {
    min: Math.max(min - pad, 1e-18),
    max: max + pad,
  }
}

const activeView = computed(() =>
  frozenView.value ?? computeViewBounds(props.min, props.max, props.current),
)

const snapPrice = (price: number) => {
  if (price <= 0 || !props.tickSpacing) return price
  const tick = bnbPerTokenToTick(price, props.tickSpacing)
  return tickToBnbPerToken(tick)
}

/** 至少相隔一个 tickSpacing */
const minPriceGap = () => {
  if (!props.tickSpacing) return props.min * 0.001
  const base = bnbPerTokenToTick(props.min, props.tickSpacing)
  const next = tickToBnbPerToken(base + props.tickSpacing)
  return Math.abs(next - props.min) || props.min * 0.001
}

const pctFromPrice = (price: number) => {
  const { min: vMin, max: vMax } = activeView.value
  if (vMax <= vMin) return 50
  return Math.min(100, Math.max(0, ((price - vMin) / (vMax - vMin)) * 100))
}

const priceFromPct = (pct: number) => {
  const { min: vMin, max: vMax } = activeView.value
  return vMin + (pct / 100) * (vMax - vMin)
}

const minPct = computed(() => pctFromPrice(props.min))
const maxPct = computed(() => pctFromPrice(props.max))
const currentPct = computed(() => pctFromPrice(props.current))

const ready = computed(
  () => props.min > 0 && props.max > props.min && props.current > 0,
)

const priceFromClientX = (clientX: number) => {
  const el = trackEl.value
  if (!el) return props.min
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return props.min
  const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
  return snapPrice(priceFromPct(pct))
}

const applyDrag = (clientX: number) => {
  if (!dragging.value) return
  const gap = minPriceGap()
  const price = priceFromClientX(clientX)

  if (dragging.value === 'min') {
    const capped = Math.min(price, props.max - gap)
    if (capped > 0 && capped < props.max) emit('change', capped, props.max)
    return
  }
  const capped = Math.max(price, props.min + gap)
  if (capped > props.min) emit('change', props.min, capped)
}

const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value) return
  applyDrag(e.clientX)
}

const endDrag = () => {
  dragging.value = null
  frozenView.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

const startDrag = (handle: 'min' | 'max', e: PointerEvent) => {
  if (props.disabled || !ready.value) return
  e.preventDefault()
  frozenView.value = computeViewBounds(props.min, props.max, props.current)
  dragging.value = handle
  emit('dragStart')
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

/** 点击轨道：移动最近的手柄 */
const onTrackClick = (e: PointerEvent) => {
  if (props.disabled || !ready.value || dragging.value) return
  const target = e.target as HTMLElement
  if (target.dataset.handle) return
  const price = priceFromClientX(e.clientX)
  const distMin = Math.abs(price - props.min)
  const distMax = Math.abs(price - props.max)
  frozenView.value = computeViewBounds(props.min, props.max, props.current)
  emit('dragStart')
  if (distMin <= distMax) {
    const gap = minPriceGap()
    const capped = Math.min(price, props.max - gap)
    if (capped > 0 && capped < props.max) emit('change', capped, props.max)
  } else {
    const gap = minPriceGap()
    const capped = Math.max(price, props.min + gap)
    if (capped > props.min) emit('change', props.min, capped)
  }
  frozenView.value = null
}

onBeforeUnmount(endDrag)

watch(() => props.disabled, (v) => { if (v) endDrag() })
</script>

<template>
  <div v-if="ready" class="relative pt-2 pb-1 select-none">
    <div
      ref="trackEl"
      class="relative h-10 mt-6 touch-none"
      :class="disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'"
      @click="onTrackClick"
    >
      <!-- 底轨 -->
      <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-grey-e7 rounded-full" />
      <!-- 选中区间 -->
      <div
        class="absolute top-1/2 -translate-y-1/2 h-2 bg-orange-normal/35 rounded-full border border-orange-normal/40 pointer-events-none"
        :style="{ left: `${minPct}%`, width: `${Math.max(maxPct - minPct, 0)}%` }"
      />
      <!-- 当前价 -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full pointer-events-none z-10"
        :class="current >= min && current <= max ? 'bg-orange-normal' : 'bg-grey-6f'"
        :style="{ left: `${currentPct}%` }"
      />
      <!-- Min 手柄 -->
      <button
        type="button"
        data-handle="min"
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
        :class="disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'"
        :style="{ left: `${minPct}%` }"
        :disabled="disabled"
        @pointerdown="startDrag('min', $event)"
        @click.stop
      >
        <span class="w-4 h-4 rounded-full bg-white border-2 border-orange-normal shadow-sm" />
      </button>
      <!-- Max 手柄 -->
      <button
        type="button"
        data-handle="max"
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
        :class="disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'"
        :style="{ left: `${maxPct}%` }"
        :disabled="disabled"
        @pointerdown="startDrag('max', $event)"
        @click.stop
      >
        <span class="w-4 h-4 rounded-full bg-white border-2 border-orange-normal shadow-sm" />
      </button>
    </div>
    <p v-if="!disabled" class="text-[10px] text-grey-93 text-center mt-2">
      {{ $t('liquidity.dragRangeHint') }}
    </p>
  </div>
  <div v-else class="h-10 bg-grey-e7 rounded-full my-1" />
</template>
