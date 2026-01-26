<template>
  <div class="miniapp-view">
    <!-- Header -->
    <div class="miniapp-header" v-if="!hideHeader">
      <button class="back-btn" @click="handleBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="app-info">
        <img v-if="manifest?.iconUrl" :src="manifest.iconUrl" class="app-icon" />
        <span class="app-name">{{ manifest?.name || 'Mini App' }}</span>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="handleShare" v-if="manifest">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 11L17 7L13 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M17 7H9C6.79 7 5 8.79 5 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="action-btn" @click="handleClose">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mini App Host -->
    <MiniAppHost
      v-if="appUrl"
      :app-url="appUrl"
      :manifest-url="manifestUrl"
      :fullscreen="hideHeader"
      @close="handleClose"
      @ready="handleReady"
      @error="handleError"
      class="miniapp-content"
    />

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>{{ error.title }}</h3>
      <p>{{ error.message }}</p>
      <button @click="handleRetry" class="retry-btn">Retry</button>
    </div>

    <!-- Loading State -->
    <div v-else class="loading-state">
      <div class="spinner"></div>
      <p>Loading Mini App...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';
import type { MiniAppManifestFull } from '@/sdk/miniapp-core/src/types';

const route = useRoute();
const router = useRouter();

const appUrl = ref<string>('');
const manifestUrl = ref<string>('');
const manifest = ref<MiniAppManifestFull['miniapp'] | null>(null);
const error = ref<{ title: string; message: string } | null>(null);
const hideHeader = ref(false);

// Get app URL from route params or query
onMounted(async () => {
  try {
    const appId = route.params.appId as string;
    const urlParam = route.query.url as string;

    if (urlParam) {
      // Direct URL mode
      appUrl.value = urlParam;
      hideHeader.value = true; // Hide header when using direct URL
    } else if (appId) {
      // Load app by ID from backend
      await loadAppById(appId);
    } else {
      throw new Error('No app ID or URL provided');
    }

    // Load manifest
    if (appUrl.value) {
      await loadManifest();
    }
  } catch (err: any) {
    error.value = {
      title: 'Failed to Load App',
      message: err.message || 'Unknown error occurred',
    };
  }
});

async function loadAppById(appId: string) {
  // TODO: Fetch app info from backend
  // For now, mock the response
  const mockApps: Record<string, { url: string; manifestUrl: string }> = {
    'example': {
      url: 'https://example.com',
      manifestUrl: 'https://example.com/.well-known/farcaster.json',
    },
  };

  const app = mockApps[appId];
  if (!app) {
    throw new Error(`App "${appId}" not found`);
  }

  appUrl.value = app.url;
  manifestUrl.value = app.manifestUrl;
}

async function loadManifest() {
  if (!manifestUrl.value && appUrl.value) {
    // Construct manifest URL from app URL
    try {
      const url = new URL(appUrl.value);
      manifestUrl.value = `${url.origin}/.well-known/farcaster.json`;
    } catch (err) {
      // Invalid URL, skip manifest loading
      console.warn('Invalid app URL, skipping manifest load:', err);
      return;
    }
  }

  try {
    const response = await fetch(manifestUrl.value, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data: MiniAppManifestFull = await response.json();
    manifest.value = data.miniapp;
  } catch (err: any) {
    // Not critical, continue without manifest
    // Only log warning for non-timeout errors
    if (err.name !== 'AbortError' && err.name !== 'TypeError') {
      console.warn('Failed to load manifest (app will still work):', err.message || err);
    }
    // Continue without manifest - the app can still function
  }
}

function handleBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/miniapps');
  }
}

function handleClose() {
  router.push('/miniapps');
}

function handleReady() {
  console.log('Mini App ready');
}

function handleError(err: Error) {
  error.value = {
    title: 'Mini App Error',
    message: err.message,
  };
}

function handleRetry() {
  error.value = null;
  window.location.reload();
}

async function handleShare() {
  if (!manifest.value) return;

  const shareData = {
    title: manifest.value.name,
    text: manifest.value.description || manifest.value.subtitle || '',
    url: appUrl.value,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(appUrl.value);
      alert('Link copied to clipboard!');
    }
  } catch (err) {
    console.error('Share failed:', err);
  }
}
</script>

<style scoped>
.miniapp-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.miniapp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  min-height: 56px;
}

.back-btn,
.action-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: #374151;
  border-radius: 8px;
  transition: background 0.2s;
}

.back-btn:hover,
.action-btn:hover {
  background: #f3f4f6;
}

.app-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  margin-left: 8px;
}

.app-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
}

.app-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.miniapp-content {
  flex: 1;
  overflow: hidden;
}

/* Loading State */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #FF7A00;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
}

.error-state p {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 24px;
}

.retry-btn {
  padding: 12px 24px;
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: linear-gradient(213.44deg, #FF7A00 -14.77%, #FCA454 116.22%);
}
</style>
