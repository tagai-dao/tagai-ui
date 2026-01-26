<template>
  <div class="sdk-test-host">
    <!-- Header -->
    <div class="host-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
      </button>
      <div class="header-title">
        <span class="title">SDK 功能测试</span>
        <span class="subtitle">TagAI Mini App SDK</span>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="reloadIframe">🔄</button>
      </div>
    </div>

    <!-- Mini App Host -->
    <div class="host-content">
      <MiniAppHost
        v-if="showHost"
        :app-url="appUrl"
        :app-domain="appDomain"
        @close="handleClose"
        @error="handleError"
      />
    </div>

    <!-- Primary Button (if set by Mini App) -->
    <div v-if="primaryButton.visible" class="primary-button-container">
      <button 
        class="primary-button"
        :disabled="primaryButton.disabled || primaryButton.loading"
        @click="handlePrimaryButtonClick"
      >
        <span v-if="primaryButton.loading" class="loading-spinner"></span>
        {{ primaryButton.text }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';

const router = useRouter();

// Mini App configuration
const appUrl = ref(`${window.location.origin}/sdk-test`);
const appDomain = ref(window.location.hostname);
const showHost = ref(true);

// Primary button state
const primaryButton = ref({
  visible: false,
  text: '',
  disabled: false,
  loading: false,
});

onMounted(() => {
  console.log('[SDKTestHost] Mounting with URL:', appUrl.value);
});

function goBack() {
  router.back();
}

function reloadIframe() {
  showHost.value = false;
  setTimeout(() => {
    showHost.value = true;
  }, 100);
}

function handleClose() {
  console.log('[SDKTestHost] Mini App requested close');
  router.back();
}

function handleError(error: Error) {
  console.error('[SDKTestHost] Mini App error:', error);
}

function handlePrimaryButtonClick() {
  console.log('[SDKTestHost] Primary button clicked');
  // Emit event to Mini App
}
</script>

<style scoped>
.sdk-test-host {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.host-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.header-title {
  flex: 1;
  margin-left: 12px;
}

.title {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  display: block;
  font-size: 11px;
  opacity: 0.8;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.host-content {
  flex: 1;
  overflow: hidden;
}

.primary-button-container {
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #eee;
}

.primary-button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(254, 145, 63, 0.4);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
