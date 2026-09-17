<script setup lang="ts">
import { applyPureReactInVue } from 'veaury'
import { useI18n } from 'vue-i18n'
import LoginWithOAuth from '@/react_app/LoginWithOAuth.jsx'
defineProps<{ returnPath: string; tradeDialog?: boolean }>()
const { locale } = useI18n()
const TwitterLogin = applyPureReactInVue(LoginWithOAuth)
</script>
<template>
  <div class="min-w-0 flex-1" @click.stop>
    <TwitterLogin :returnPath="returnPath" :compact="true"
      :label="locale.startsWith('zh')
        ? (tradeDialog ? '授权登录 & 交易' : 'twitter 授权登录 & 交易')
        : (tradeDialog ? 'Log in & trade' : 'Log in with Twitter & trade')" />
  </div>
</template>
