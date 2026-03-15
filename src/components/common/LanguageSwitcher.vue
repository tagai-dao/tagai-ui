<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const switchLanguage = (lang: string) => {
  locale.value = lang
  localStorage.setItem('language', lang)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      v-if="locale === 'zh'"
      @click="switchLanguage('en')"
      class="flex items-center gap-1.5 px-3 h-8 web:h-9 rounded-full bg-white text-black hover:bg-gray-50 transition-colors text-xs web:text-sm"
    >
      <img class="w-4 h-4" src="~@/assets/icons/icon-lang-en.svg" alt="">
      <span>EN</span>
    </button>
    <button
      v-if="locale === 'en'"
      @click="switchLanguage('zh')"
      class="flex items-center gap-1.5 px-3 h-8 web:h-9 rounded-full bg-white text-black hover:bg-gray-50 transition-colors text-xs web:text-sm"
    >
      <img class="w-4 h-4" src="~@/assets/icons/icon-lang-zh.svg" alt="">
      <span>中文</span>
    </button>
  </div>
</template>

<style scoped>
</style>
