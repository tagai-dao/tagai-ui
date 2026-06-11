<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type LocaleCode } from '@/lang'

const { locale } = useI18n()

const currentLabel = () =>
  SUPPORTED_LOCALES.find(l => l.code === locale.value)?.label ?? 'English'

const onSelect = (code: LocaleCode) => {
  setLocale(code)
}
</script>

<template>
  <el-popover popper-class="c-select-popper" trigger="click" width="140" :persistent="false" placement="bottom-end">
    <template #reference>
      <button
        class="flex items-center gap-1.5 px-3 h-8 web:h-9 rounded-full bg-white text-black hover:bg-gray-50 transition-colors text-xs web:text-sm"
        :aria-label="$t('language')"
      >
        <img class="w-4 h-4" src="~@/assets/icons/icon-lang-en.svg" alt="">
        <span>{{ currentLabel() }}</span>
      </button>
    </template>
    <template #default>
      <div class="p-1 flex flex-col">
        <button
          v-for="l of SUPPORTED_LOCALES"
          :key="l.code"
          class="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:bg-gray-50"
          :class="locale === l.code ? 'font-semibold text-orange-normal' : 'text-black'"
          @click="onSelect(l.code)"
        >
          <span>{{ l.label }}</span>
          <span v-if="locale === l.code">✓</span>
        </button>
      </div>
    </template>
  </el-popover>
</template>

<style scoped>
</style>
