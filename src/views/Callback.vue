<script setup lang="ts">
import { useAccountStore } from "@/stores/web3";
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getWalletClient, signMessage } from "@/utils/wallets";
import { bondEth } from "@/apis/api";
import { BondEthMessage } from "@/config";
import emitter from "@/utils/emitter";

const router = useRouter();
const accStore = useAccountStore();

let finished = false
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

const finish = () => {
  if (finished) return
  finished = true
  emitter.off('authSuccess', finish)
  emitter.off('authError', finish)
  if (fallbackTimer) clearTimeout(fallbackTimer)
  const path = localStorage.getItem('current-route')
  localStorage.removeItem('current-route')
  router.replace(path ?? '/')
}

onMounted(() => {
  // Privy OAuth 回跳 URL 带 privy_oauth_* 参数，SDK 需要从 URL 读取完成换码。
  // 之前 onMounted 立即 replace 会在 SDK 处理前清掉参数（竞态→登录失败），
  // 改为等 SDK 发出 authSuccess/authError 后再跳，超时兜底。
  const hasOauthParams = /privy_oauth/.test(window.location.search)
  if (hasOauthParams) {
    emitter.on('authSuccess', finish)
    emitter.on('authError', finish)
    fallbackTimer = setTimeout(finish, 12000)
  } else {
    finish()
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
    </div>
  </div>

</template>