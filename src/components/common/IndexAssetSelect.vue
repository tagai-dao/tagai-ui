<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElSelect, ElOption } from 'element-plus'
import 'element-plus/es/components/select/style/css'
import type { CreationOptions } from '@/utils/v13/creation'
import catalog from '@/utils/v13/creation-assets.json'

type Asset = CreationOptions['assets'][number]
const props = defineProps<{ modelValue: string; assets: Asset[]; excluded: string[]; label: string; unavailableLabel: string; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', address: `0x${string}`): void }>()
const failedLogos = ref(new Set<string>())
const selected = computed(() => props.assets.find(a => a.address.toLowerCase() === props.modelValue.toLowerCase()))
const logo = (a: Asset) => catalog.find(item => item.address.toLowerCase() === a.address.toLowerCase())?.logoUrl
const excluded = (a: Asset) => props.excluded.some(address => address.toLowerCase() === a.address.toLowerCase())
const failed = (a: Asset) => failedLogos.value.add(a.address)
</script>

<template>
  <ElSelect class="asset-select" :model-value="modelValue" :aria-label="label" :disabled="disabled" :placeholder="unavailableLabel" popper-class="index-asset-options" @update:model-value="emit('update:modelValue', $event)">
    <template #label>
      <span v-if="selected" class="asset-label"><img v-if="logo(selected) && !failedLogos.has(selected.address)" :src="logo(selected)" alt="" @error="failed(selected)" /><span v-else class="asset-avatar">{{ selected.symbol.slice(0, 2) }}</span><span>{{ selected.symbol }}</span></span>
      <span v-else>{{ unavailableLabel }}</span>
    </template>
    <ElOption v-for="asset in assets" :key="asset.address" :label="asset.symbol" :value="asset.address" :disabled="excluded(asset)">
      <span class="asset-label"><img v-if="logo(asset) && !failedLogos.has(asset.address)" :src="logo(asset)" alt="" @error="failed(asset)" /><span v-else class="asset-avatar">{{ asset.symbol.slice(0, 2) }}</span><span>{{ asset.symbol }}</span></span>
    </ElOption>
  </ElSelect>
</template>

<style scoped>
.asset-select { width:100%; min-width:0; --el-color-primary:#e77a27; --el-text-color-regular:var(--text-base); --el-fill-color-blank:var(--surface); --el-border-color:var(--border-base); --el-border-color-hover:#e77a27 }
.asset-select :deep(.el-select__wrapper) { min-height:44px; padding:8px 12px; border-radius:12px; background:color-mix(in srgb,var(--surface-2) 58%,transparent); box-shadow:0 0 0 1px var(--border-base) inset }
.asset-select :deep(.el-select__wrapper.is-focused) { box-shadow:0 0 0 1px #e77a27 inset }
.asset-label { display:flex; align-items:center; gap:9px; min-width:0; font-size:12px; line-height:24px }
.asset-label img,.asset-avatar { width:24px; height:24px; flex-shrink:0; border-radius:50%; object-fit:contain; background:#fff }
.asset-avatar { display:grid; place-items:center; background:var(--surface-2); color:var(--text-muted); font-size:9px }
</style>

<style>
.index-asset-options { --el-bg-color-overlay:var(--surface); --el-border-color-light:var(--border-base); --el-fill-color-light:var(--surface-2); --el-text-color-regular:var(--text-base); --el-text-color-placeholder:var(--text-muted); --el-color-primary:#e77a27 }
.index-asset-options .el-select-dropdown__item { display:flex; align-items:center; min-height:40px }
</style>
