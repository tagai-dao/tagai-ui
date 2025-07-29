<script setup lang="ts">
import { useUserStore } from "@/stores/privy";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { usePrivyIframe } from "@/composables/usePrivyIframe";

const store = useUserStore();
const router = useRouter();
const { initPrivyIframe, waitForInitialization } = usePrivyIframe();

onMounted(async () => {
  try {
    // 首先初始化 Privy iframe
    await initPrivyIframe();
    
    // 等待 iframe 初始化完成
    await waitForInitialization();
    
    // 然后处理回调
    await store.handleCallback();
    await store.initWallet();
    router.replace("/"); // 登录后跳转首页
  } catch (error) {
    console.error('Error in callback processing:', error);
    // 即使出错也跳转到首页
    router.replace("/");
  }
});
</script>
<template>
  <div>登录中…</div>
</template>