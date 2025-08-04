<script setup lang="ts">
import { useUserStore } from "@/stores/privy";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
const privyStore = useUserStore();
const router = useRouter();

onMounted(async () => {
  try {
    // 等待全局iframe初始化完成（在App.vue中已经初始化）
    await privyStore.waitForIframeInitialization();
    
    // 然后处理回调
    await privyStore.handleCallback();
    await privyStore.initWallet();
  } catch (error) {
    console.error('Error in callback processing:', error);
  }
  // 即使出错也跳转到之前的页面
  const path = localStorage.getItem('current-route')
  localStorage.removeItem('current-route')
  router.replace(path ?? '/')
});
</script>
<template>
  <div>Waiting for login...</div>
</template>