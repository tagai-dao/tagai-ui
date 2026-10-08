<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ label: string }>()
const open = ref(false)
const { locale } = useI18n()
const closeLabel = computed(() => locale.value.toLowerCase().startsWith('zh') ? '关闭详情' : 'Close details')
let timer: ReturnType<typeof setTimeout> | undefined
function show() { clearTimeout(timer); open.value = true }
function hide() { clearTimeout(timer); timer = setTimeout(() => { open.value = false }, 150) }
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <el-popover :visible="open" placement="bottom-start" :width="340" :show-after="0" popper-class="take-detail-popper" @hide="open = false">
    <template #reference>
      <button type="button" class="take-detail-trigger" :aria-expanded="open" @mouseenter="show" @mouseleave="hide" @focus="show" @blur="hide" @click="show" @keydown.esc="open = false">
        {{ label }}
      </button>
    </template>
    <div class="take-detail-content" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide" @keydown.esc="open = false">
      <button type="button" class="take-detail-close" :aria-label="closeLabel" @click="open = false">×</button>
      <slot />
    </div>
  </el-popover>
</template>

<style scoped>
.take-detail-trigger { color: inherit; text-align: left; text-decoration: underline; text-decoration-style: dotted; text-decoration-color: rgb(128 128 128 / 60%); text-underline-offset: 4px; font-size: inherit; line-height: 1.6; }
.take-detail-trigger:hover, .take-detail-trigger:focus-visible { text-decoration-style: solid; }
.take-detail-trigger:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 2px; }
.take-detail-close { float: right; margin: -.25rem -.25rem .25rem .5rem; width: 1.5rem; height: 1.5rem; font-size: 1.25rem; line-height: 1; color: inherit; background: none; border: 0; cursor: pointer; }
.take-detail-content { max-height: min(24rem, 60vh); overflow-y: auto; font-size: .8125rem; line-height: 1.65; overflow-wrap: anywhere; }
</style>
<style>
.take-detail-popper.el-popover { max-width: calc(100vw - 32px); padding: 1rem; border-radius: .75rem; }
</style>
