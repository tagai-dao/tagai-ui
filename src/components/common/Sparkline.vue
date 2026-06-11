<script setup lang="ts">
import { computed } from 'vue'

// 轻量 inline SVG 走势线，无图表库依赖；首尾对比决定颜色（涨跌色随 locale CSS 变量）
const props = withDefaults(defineProps<{
  points: number[]
  width?: number
  height?: number
}>(), { width: 64, height: 20 })

const path = computed(() => {
  const pts = props.points
  if (!pts || pts.length < 2) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const stepX = props.width / (pts.length - 1)
  return pts
    .map((v, i) => {
      const x = (i * stepX).toFixed(1)
      const y = (props.height - 2 - ((v - min) / range) * (props.height - 4)).toFixed(1)
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
})

const trendClass = computed(() =>
  props.points[props.points.length - 1] >= props.points[0] ? 'text-up' : 'text-down'
)
</script>

<template>
  <svg v-if="path" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`"
       class="overflow-visible" :class="trendClass" aria-hidden="true">
    <path :d="path" fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</template>
