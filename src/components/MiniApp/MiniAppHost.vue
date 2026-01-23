<template>
  <div class="miniapp-host" :class="{ 'fullscreen': fullscreen }">
    <!-- Splash Screen -->
    <transition name="fade">
      <div
        v-if="showSplash"
        class="splash-screen"
        :style="{ backgroundColor: manifest?.splashBackgroundColor || '#ffffff' }"
      >
        <img
          v-if="manifest?.splashImageUrl"
          :src="manifest.splashImageUrl"
          alt="App Icon"
          class="splash-icon"
        />
        <div class="loading-spinner"></div>
      </div>
    </transition>

    <!-- iframe Container -->
    <iframe
      v-show="!showSplash"
      ref="iframeRef"
      :src="appUrl"
      :sandbox="sandboxPermissions"
      class="miniapp-iframe"
      @load="handleIframeLoad"
    ></iframe>

    <!-- Primary Button (optional) -->
    <transition name="slide-up">
      <button
        v-if="primaryButton.visible"
        class="primary-button"
        :class="{ 'loading': primaryButton.loading, 'disabled': !primaryButton.enabled }"
        :disabled="!primaryButton.enabled || primaryButton.loading"
        @click="handlePrimaryButtonClick"
      >
        <span v-if="primaryButton.loading" class="spinner"></span>
        <span v-else>{{ primaryButton.text }}</span>
      </button>
    </transition>

    <!-- Compose Dialog -->
    <MiniAppComposeDialog
      :visible="composeDialog.visible"
      :title="composeDialog.title"
      :text="composeDialog.text"
      :placeholder="composeDialog.placeholder"
      :submit-button-text="composeDialog.submitButtonText"
      :embed="composeDialog.embed"
      @close="handleComposeClose"
      @submit="handleComposeSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { usePrivyStore } from '@/stores/privy';
import { useAccountStore } from '@/stores/web3';
import type { MiniAppManifestFull, MiniAppContext } from '@/sdk/miniapp-core/src/types';
import type { Address, Hash } from 'viem';
import { formatEther } from 'viem';
import {
  generateMiniAppToken,
  createSteemPost,
  voteSteemPost,
  createSteemComment,
  reblogSteemPost,
} from '@/apis/api';
import MiniAppComposeDialog from './MiniAppComposeDialog.vue';

interface Props {
  appUrl: string;
  manifestUrl?: string;
  fullscreen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fullscreen: true,
});

const emit = defineEmits<{
  close: [];
  ready: [];
  error: [error: Error];
}>();

// Stores
const privyStore = usePrivyStore();
const accountStore = useAccountStore();

// Refs
const iframeRef = ref<HTMLIFrameElement | null>(null);
const showSplash = ref(true);
const manifest = ref<MiniAppManifestFull['miniapp'] | null>(null);
const primaryButton = ref({
  visible: false,
  text: '',
  enabled: true,
  loading: false,
});

// Token cache
const cachedToken = ref<string | null>(null);
const tokenExpiresAt = ref<number>(0);

// Compose dialog state
const composeDialog = ref({
  visible: false,
  title: '',
  text: '',
  placeholder: '',
  submitButtonText: '',
  embed: undefined as any,
});
let composeResolve: ((value: any) => void) | null = null;

// Sandbox permissions
const sandboxPermissions = computed(() => {
  return [
    'allow-scripts',
    'allow-same-origin',
    'allow-forms',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
  ].join(' ');
});

// Load manifest
onMounted(async () => {
  if (props.manifestUrl) {
    try {
      const response = await fetch(props.manifestUrl);
      const data: MiniAppManifestFull = await response.json();
      manifest.value = data.miniapp;
    } catch (error) {
      console.error('Failed to load manifest:', error);
    }
  }

  // Setup message listener
  window.addEventListener('message', handleMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
});

// Handle iframe load
function handleIframeLoad() {
  console.log('Mini App iframe loaded');
}

// Handle messages from Mini App
async function handleMessage(event: MessageEvent) {
  // Validate origin (should match appUrl origin in production)
  if (event.source !== iframeRef.value?.contentWindow) {
    return;
  }

  const { type, message } = event.data;

  if (type !== 'tagai:miniapp') {
    return;
  }

  const { id, method, params } = message;

  try {
    let result: any;

    switch (method) {
      case 'getContext':
        result = await handleGetContext();
        break;

      case 'auth.getToken':
        result = await handleAuthGetToken(params);
        break;

      case 'auth.signIn':
        result = await handleAuthSignIn(params);
        break;

      case 'steem.post':
        result = await handleSteemPost(params);
        break;

      case 'steem.vote':
        result = await handleSteemVote(params);
        break;

      case 'steem.comment':
        result = await handleSteemComment(params);
        break;

      case 'steem.reblog':
        result = await handleSteemReblog(params);
        break;

      case 'wallet.getAddress':
        result = await handleWalletGetAddress();
        break;

      case 'wallet.getBalance':
        result = await handleWalletGetBalance();
        break;

      case 'wallet.sendTransaction':
        result = await handleWalletSendTransaction(params);
        break;

      case 'wallet.signMessage':
        result = await handleWalletSignMessage(params);
        break;

      case 'wallet.request':
        result = await handleWalletRequest(params);
        break;

      case 'actions.ready':
        result = await handleActionsReady(params);
        break;

      case 'actions.close':
        result = await handleActionsClose();
        break;

      case 'actions.openUrl':
        result = await handleActionsOpenUrl(params);
        break;

      case 'actions.compose':
        result = await handleActionsCompose(params);
        break;

      case 'actions.share':
        result = await handleActionsShare(params);
        break;

      case 'actions.viewProfile':
        result = await handleActionsViewProfile(params);
        break;

      case 'actions.viewPost':
        result = await handleActionsViewPost(params);
        break;

      case 'actions.setPrimaryButton':
        result = await handleActionsSetPrimaryButton(params);
        break;

      case 'actions.addMiniApp':
        result = await handleActionsAddMiniApp();
        break;

      case 'actions.requestCameraAndMicrophoneAccess':
        result = await handleActionsRequestMedia();
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    sendResponse(id, result);
  } catch (error: any) {
    sendResponse(id, null, {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
    });
  }
}

// Send response to Mini App
function sendResponse(id: string, result?: any, error?: { code: string; message: string }) {
  if (!iframeRef.value?.contentWindow) return;

  iframeRef.value.contentWindow.postMessage(
    {
      type: 'tagai:miniapp:response',
      response: { id, result, error },
    },
    '*' // In production, use specific origin
  );
}

// ==========================================
// Message Handlers
// ==========================================

async function handleGetContext(): Promise<MiniAppContext> {
  const context = await accountStore.context;

  return {
    client: {
      platformType: 'web',
      clientTwitterId: 'tagai',
      added: false, // TODO: Check if app is added
      notificationDetails: undefined,
    },
    user: {
      twitterId: context.twitterId || '',
      twitterUsername: context.twitterUsername,
      twitterName: context.displayName,
      profile: context.avatar,
      ethAddr: accountStore.ethConnectAddress,
      fid: context.twitterId,
    },
    location: {
      type: 'launcher',
    },
  };
}

async function handleAuthGetToken(params: any) {
  try {
    // Check if we have a valid cached token
    const forceRefresh = params?.forceRefresh || false;
    if (!forceRefresh && cachedToken.value && tokenExpiresAt.value > Date.now() + 15000) {
      return {
        token: cachedToken.value,
        expiresAt: tokenExpiresAt.value,
      };
    }

    // Generate new token
    const context = await accountStore.context;
    const result = await generateMiniAppToken(
      context.twitterId || '',
      accountStore.ethConnectAddress,
      accountStore.steemUsername,
      context.twitterUsername
    );

    // Cache the token
    cachedToken.value = result.token;
    tokenExpiresAt.value = result.expiresAt;

    return {
      token: result.token,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    console.error('Failed to generate token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

async function handleAuthSignIn(params: any) {
  // Trigger Privy sign in
  if (!privyStore.viemWalletClient) {
    await privyStore.initWallet();
  }

  const address = accountStore.ethConnectAddress;
  const message = `Sign in to TagAI Mini App\nNonce: ${params.nonce || Date.now()}`;

  const signature = await privyStore.viemWalletClient!.signMessage({
    message,
  });

  return {
    ethAddress: address,
    twitterId: accountStore.twitterId,
    twitterUsername: accountStore.twitterUsername,
    steemUsername: accountStore.steemUsername,
    message,
    signature,
  };
}

async function handleSteemPost(params: any) {
  try {
    // Get JWT token first
    const tokenResult = await handleAuthGetToken({});
    const token = tokenResult.token;

    // Create Steem post
    const result = await createSteemPost(
      token,
      params.title,
      params.body,
      params.tags,
      params.jsonMetadata,
      params.beneficiaries
    );

    return result;
  } catch (error) {
    console.error('Failed to create Steem post:', error);
    throw new Error('Failed to create Steem post');
  }
}

async function handleSteemVote(params: any) {
  try {
    const tokenResult = await handleAuthGetToken({});
    const token = tokenResult.token;

    await voteSteemPost(
      token,
      params.author,
      params.permlink,
      params.weight
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to vote on Steem post:', error);
    throw new Error('Failed to vote on Steem post');
  }
}

async function handleSteemComment(params: any) {
  try {
    const tokenResult = await handleAuthGetToken({});
    const token = tokenResult.token;

    const result = await createSteemComment(
      token,
      params.parentAuthor,
      params.parentPermlink,
      params.body,
      params.jsonMetadata
    );

    return result;
  } catch (error) {
    console.error('Failed to create Steem comment:', error);
    throw new Error('Failed to create Steem comment');
  }
}

async function handleSteemReblog(params: any) {
  try {
    const tokenResult = await handleAuthGetToken({});
    const token = tokenResult.token;

    await reblogSteemPost(
      token,
      params.author,
      params.permlink
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to reblog Steem post:', error);
    throw new Error('Failed to reblog Steem post');
  }
}

async function handleWalletGetAddress(): Promise<Address> {
  return accountStore.ethConnectAddress as Address;
}

async function handleWalletGetBalance() {
  const balance = await privyStore.viemWalletClient!.getBalance({
    address: accountStore.ethConnectAddress as Address,
  });

  return {
    value: balance.toString(),
    symbol: 'BNB',
  };
}

async function handleWalletSendTransaction(params: any): Promise<Hash> {
  const hash = await privyStore.viemWalletClient!.sendTransaction(params);
  return hash;
}

async function handleWalletSignMessage(params: any): Promise<string> {
  const signature = await privyStore.viemWalletClient!.signMessage({
    message: params.message,
  });
  return signature;
}

async function handleWalletRequest(params: any) {
  // Forward EIP-1193 request to Privy provider
  const provider = privyStore.ethersProvider;
  return await provider.send(params.method, params.params || []);
}

async function handleActionsReady(params: any) {
  const splashDuration = params.splashDuration || 500;

  setTimeout(() => {
    showSplash.value = false;
    emit('ready');
  }, splashDuration);

  return {};
}

async function handleActionsClose() {
  emit('close');
  return {};
}

async function handleActionsOpenUrl(params: any) {
  window.open(params.url, '_blank');
  return {};
}

async function handleActionsCompose(params: any) {
  return new Promise((resolve) => {
    composeDialog.value = {
      visible: true,
      title: params.title || 'New Post',
      text: params.text || '',
      placeholder: params.placeholder || 'What\'s happening?',
      submitButtonText: params.submitButtonText || 'Post',
      embed: params.embed,
    };
    composeResolve = resolve;
  });
}

function handleComposeClose() {
  composeDialog.value.visible = false;
  if (composeResolve) {
    composeResolve({ posted: false });
    composeResolve = null;
  }
}

async function handleComposeSubmit(text: string) {
  try {
    // Get the token
    const tokenResult = await handleAuthGetToken({});
    const token = tokenResult.token;

    // Create the post with the composed text
    const embed = composeDialog.value.embed;
    const postBody = text + (embed ? `\n\n${embed.url}` : '');

    const result = await createSteemPost(
      token,
      composeDialog.value.title || 'Post from Mini App',
      postBody,
      ['tagai', 'miniapp'],
      {
        app: 'tagai-miniapp/1.0',
        embed: embed,
      }
    );

    // Close dialog and resolve
    composeDialog.value.visible = false;
    if (composeResolve) {
      composeResolve({
        posted: true,
        postUrl: result.url,
        author: result.author,
        permlink: result.permlink,
      });
      composeResolve = null;
    }
  } catch (error) {
    console.error('Failed to submit post:', error);
    // Don't close dialog on error, let user retry
  }
}

async function handleActionsShare(params: any) {
  if (navigator.share) {
    await navigator.share({
      url: params.url,
      text: params.text,
    });
  }
  return {};
}

async function handleActionsViewProfile(params: any) {
  // TODO: Navigate to profile
  return {};
}

async function handleActionsViewPost(params: any) {
  // TODO: Navigate to post
  return {};
}

async function handleActionsSetPrimaryButton(params: any) {
  primaryButton.value = {
    visible: true,
    text: params.text,
    enabled: params.enabled !== false,
    loading: params.loading || false,
  };
  return {};
}

async function handleActionsAddMiniApp() {
  // TODO: Add to user's mini app list
  return { added: true };
}

async function handleActionsRequestMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    stream.getTracks().forEach(track => track.stop());
    return { camera: true, microphone: true };
  } catch {
    return { camera: false, microphone: false };
  }
}

function handlePrimaryButtonClick() {
  if (!iframeRef.value?.contentWindow) return;

  iframeRef.value.contentWindow.postMessage(
    {
      type: 'tagai:miniapp:event',
      eventName: 'primaryButtonClicked',
      data: {},
    },
    '*'
  );
}
</script>

<style scoped>
.miniapp-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.miniapp-host.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.splash-screen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.splash-icon {
  width: 80px;
  height: 80px;
  object-fit: contain;
  margin-bottom: 20px;
  border-radius: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #5b21b6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.miniapp-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.primary-button {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  padding: 16px;
  background: #5b21b6;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 5;
}

.primary-button:hover:not(.disabled) {
  background: #6d28d9;
  transform: translateY(-2px);
}

.primary-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-button.loading {
  opacity: 0.7;
}

.primary-button .spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-left-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s;
}

.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
