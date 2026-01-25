<template>
  <div class="test-miniapp-page">
    <MiniAppHost
      app-url="http://localhost:5173/test-defi"
      :fullscreen="true"
      @ready="handleReady"
    />
  </div>
</template>

<script setup lang="ts">
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';

function handleReady() {
  console.log('✅ Test Mini App Ready');
}
</script>

<style scoped>
.test-miniapp-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
