<template>
  <div class="testnet-host-wrapper">
    <MiniAppHost
      :app-url="'/testnet-defi'"
      :fullscreen="false"
      @app-loaded="handleAppLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAccountStore } from '@/stores/web3';
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';

const accountStore = useAccountStore();

const userInfo = computed(() => {
  const info = accountStore.getAccountInfo;
  return {
    twitterId: info?.twitterId || '',
    username: info?.username || '',
    ethAddr: info?.ethAddr || '',
  };
});

function handleAppLoaded() {
  console.log('[Testnet Host] Mini App loaded successfully');
}

onMounted(() => {
  console.log('[Testnet Host] Mounted - Using MiniAppHost with iframe');
});
</script>

<style scoped>
.testnet-host-wrapper {
  width: 100%;
  min-height: 100vh;
}
</style>
