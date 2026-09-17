<script setup lang="ts">
import { useAccountStore } from "@/stores/web3";
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getWalletClient, signMessage } from "@/utils/wallets";
import { bondEth } from "@/apis/api";
import { BondEthMessage } from "@/config";
import emitter from "@/utils/emitter";
import { takeBlinkLoginReturn } from '@/utils/blinkLoginReturn'

const router = useRouter();
const accStore = useAccountStore();

let finished = false
let fallbackTimer: ReturnType<typeof setTimeout> | null = null
const takingLonger = ref(false)

const finish = () => {
  if (finished) return
  finished = true
  emitter.off('authSuccess', finish)
  emitter.off('authError', finish)
  if (fallbackTimer) clearTimeout(fallbackTimer)
  // Layout owns auth completion navigation. A second replace here used to
  // overwrite the original Blinks destination with '/'.
}

onMounted(() => {
  // Privy OAuth 回跳 URL 带 privy_oauth_* 参数，SDK 需要从 URL 读取完成换码。
  // 之前 onMounted 立即 replace 会在 SDK 处理前清掉参数（竞态→登录失败），
  // 改为等 SDK 发出 authSuccess/authError 后再跳，超时兜底。
  const hasOauthParams = /privy_oauth/.test(window.location.search)
  if (hasOauthParams) {
    emitter.on('authSuccess', finish)
    emitter.on('authError', finish)
    // A slow mobile connection is not a completed login. Do not erase the
    // OAuth params or silently send users home after twelve seconds.
    fallbackTimer = setTimeout(() => { takingLonger.value = true }, 45000)
  } else {
    finish()
    const path = takeBlinkLoginReturn() || localStorage.getItem('current-route')
    localStorage.removeItem('current-route')
    router.replace(path ?? '/')
  }
});

onUnmounted(() => {
  emitter.off('authSuccess', finish)
  emitter.off('authError', finish)
  if (fallbackTimer) clearTimeout(fallbackTimer)
});
</script>
<template>
  <div class="w-full h-full flex justify-center items-center">
    <img class="w-14 h-14 mr-3" src="~@/assets/loading.gif" alt="">
    <div>
      Waiting for login...
      <p v-if="takingLonger" class="mt-2 text-sm">
        Login is taking longer than expected. Check your connection; keep this page open to complete login.
      </p>
    </div>
  </div>

</template>
