<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type LocaleCode } from '@/lang'
import { useTheme } from '@/composables/useTheme'

const { locale } = useI18n()
const { isDark, setTheme } = useTheme()

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
        class="flex items-center gap-1.5 px-3 h-8 web:h-9 rounded-full bg-surface text-content hover:bg-surface-2 transition-colors text-xs web:text-sm"
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
          class="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:bg-surface-2"
          :class="locale === l.code ? 'font-semibold text-orange-normal' : 'text-content'"
          @click="onSelect(l.code)"
        >
          <span>{{ l.label }}</span>
          <span v-if="locale === l.code">✓</span>
        </button>
        <!-- 暗色模式 -->
        <div class="border-t border-grey-light mt-1 pt-2 px-3 pb-1">
          <div class="text-xs text-grey-64 mb-1.5">{{ $t('theme.label') }}</div>
          <div class="flex gap-1.5">
            <button class="flex-1 h-7 rounded-lg text-xs border-[1px] transition-colors"
                    :class="!isDark ? 'border-orange-normal text-orange-normal font-semibold' : 'border-grey-light-active text-grey-64'"
                    @click="setTheme('light')">☀ {{ $t('theme.light') }}</button>
            <button class="flex-1 h-7 rounded-lg text-xs border-[1px] transition-colors"
                    :class="isDark ? 'border-orange-normal text-orange-normal font-semibold' : 'border-grey-light-active text-grey-64'"
                    @click="setTheme('dark')">🌙 {{ $t('theme.dark') }}</button>
          </div>
        </div>
      </div>
    </template>
  </el-popover>
</template>

<style scoped>
</style>
