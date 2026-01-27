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

    <!-- Send Token Dialog -->
    <MiniAppSendTokenDialog
      :visible="sendTokenDialog.visible"
      :token-info="sendTokenDialog.tokenInfo"
      :amount="sendTokenDialog.amount"
      :recipient-address="sendTokenDialog.recipientAddress"
      :recipient-twitter-id="sendTokenDialog.recipientTwitterId"
      :estimated-gas="sendTokenDialog.estimatedGas"
      :submitting="sendTokenDialog.submitting"
      @close="handleSendTokenClose"
      @confirm="handleSendTokenConfirm"
      @reject="handleSendTokenReject"
    />

    <!-- Swap Token Dialog -->
    <MiniAppSwapTokenDialog
      :visible="swapTokenDialog.visible"
      :sell-token-info="swapTokenDialog.sellTokenInfo"
      :buy-token-info="swapTokenDialog.buyTokenInfo"
      :sell-amount="swapTokenDialog.sellAmount"
      :quote="swapTokenDialog.quote"
      :estimated-gas="swapTokenDialog.estimatedGas"
      :needs-approval="swapTokenDialog.needsApproval"
      :loading="swapTokenDialog.loading"
      :submitting="swapTokenDialog.submitting"
      @close="handleSwapTokenClose"
      @confirm="handleSwapTokenConfirm"
      @reject="handleSwapTokenReject"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePrivyStore } from '@/stores/privy';
import { useAccountStore } from '@/stores/web3';
import type { MiniAppManifestFull } from '@/sdk/miniapp-core/src/types';
import type { MiniAppContext } from '@/sdk/miniapp-core/src/context';
import type { Address, Hash } from 'viem';
import { formatEther, getAddress, formatUnits, isAddress, zeroAddress } from 'viem';
import {
  generateMiniAppToken,
  createSteemPost,
  voteSteemPost,
  createSteemComment,
  reblogSteemPost,
  getEthAddressByTwitterId,
} from '@/apis/api';
import MiniAppComposeDialog from './MiniAppComposeDialog.vue';
import MiniAppSendTokenDialog from './MiniAppSendTokenDialog.vue';
import MiniAppSwapTokenDialog from './MiniAppSwapTokenDialog.vue';
import { parseCAIP19 } from '@/utils/caip';
import { getTokenInfo } from '@/utils/token';
import type { TokenInfo } from '@/utils/token';
import {
  getSwapQuote,
  buildSwapTransaction,
  checkAllowance,
  buildApprovalTransaction,
  type SwapQuote,
} from '@/utils/dex';

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

// Stores and Router
const privyStore = usePrivyStore();
const accountStore = useAccountStore();
const router = useRouter();

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

// Send token dialog state
const sendTokenDialog = ref({
  visible: false,
  tokenInfo: undefined as TokenInfo | undefined,
  amount: undefined as string | undefined,
  recipientAddress: undefined as Address | undefined,
  recipientTwitterId: undefined as string | undefined,
  estimatedGas: undefined as string | undefined,
  submitting: false,
});
let sendTokenResolve: ((value: any) => void) | null = null;

// Swap token dialog state
const swapTokenDialog = ref({
  visible: false,
  sellTokenInfo: undefined as TokenInfo | undefined,
  buyTokenInfo: undefined as TokenInfo | undefined,
  sellAmount: undefined as string | undefined,
  quote: undefined as SwapQuote | undefined,
  estimatedGas: undefined as string | undefined,
  needsApproval: false,
  loading: false,
  submitting: false,
});
let swapTokenResolve: ((value: any) => void) | null = null;

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

// 安全: 计算允许的 origin，用于 postMessage
const allowedOrigin = computed(() => {
  try {
    // 如果 appUrl 是完整 URL，提取 origin
    if (props.appUrl.startsWith('http://') || props.appUrl.startsWith('https://')) {
      return new URL(props.appUrl).origin;
    }
    // 如果是相对路径（如 /testnet-defi），使用当前 origin
    return window.location.origin;
  } catch {
    // 解析失败时使用当前 origin
    return window.location.origin;
  }
});

// Load manifest
onMounted(async () => {
  if (props.manifestUrl) {
    try {
      const response = await fetch(props.manifestUrl, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: MiniAppManifestFull = await response.json();
      manifest.value = data.miniapp;
    } catch (error: any) {
      // Not critical, continue without manifest
      // Only log warning for non-timeout errors
      if (error.name !== 'AbortError' && error.name !== 'TypeError') {
        console.warn('Failed to load manifest (app will still work):', error.message || error);
      }
      // Continue without manifest - the app can still function
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
  // 安全验证 1: 验证消息来源是 iframe
  if (event.source !== iframeRef.value?.contentWindow) {
    return;
  }

  // 安全验证 2: 验证消息 origin 匹配允许的 origin
  if (event.origin !== allowedOrigin.value) {
    console.warn('[MiniAppHost] Origin mismatch:', event.origin, '!==', allowedOrigin.value);
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

      case 'actions.viewToken':
        result = await handleActionsViewToken(params);
        break;

      case 'actions.sendToken':
        result = await handleActionsSendToken(params);
        break;

      case 'actions.swapToken':
        result = await handleActionsSwapToken(params);
        break;

      case 'notifications.requestPermission':
        result = await handleNotificationsRequestPermission();
        break;

      case 'notifications.subscribe':
        result = await handleNotificationsSubscribe(params);
        break;

      case 'notifications.unsubscribe':
        result = await handleNotificationsUnsubscribe();
        break;

      case 'notifications.isEnabled':
        result = await handleNotificationsIsEnabled();
        break;

      case 'notifications.getStatus':
        result = await handleNotificationsGetStatus();
        break;

      // Haptics handlers
      case 'haptics.impactOccurred':
        result = await handleHapticsImpact(params);
        break;

      case 'haptics.notificationOccurred':
        result = await handleHapticsNotification(params);
        break;

      case 'haptics.selectionChanged':
        result = await handleHapticsSelection();
        break;

      // Platform handlers
      case 'platform.getCapabilities':
        result = await handlePlatformGetCapabilities();
        break;

      case 'platform.getChains':
        result = await handlePlatformGetChains();
        break;

      case 'platform.getPlatformType':
        result = await handlePlatformGetPlatformType();
        break;

      // Back navigation handlers
      case 'back.updateState':
        result = await handleBackUpdateState(params);
        break;

      case 'back.goBack':
        result = await handleBackGoBack();
        break;

      // Twitter handlers
      case 'twitter.isConnected':
        result = await handleTwitterIsConnected();
        break;

      case 'twitter.getUser':
        result = await handleTwitterGetUser();
        break;

      case 'twitter.post':
        result = await handleTwitterPost(params);
        break;

      case 'twitter.share':
        result = await handleTwitterShare(params);
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
    allowedOrigin.value // 安全: 使用具体的 origin 替代 '*'
  );
}

// ==========================================
// Message Handlers
// ==========================================

async function handleGetContext(): Promise<MiniAppContext> {
  const account = accountStore.getAccountInfo;

  return {
    client: {
      platformType: 'web',
      clientTwitterId: 'tagai',
      added: false, // TODO: Check if app is added
      notificationDetails: undefined,
    },
    user: {
      twitterId: account?.twitterId || '',
      twitterUsername: account?.twitterUsername || '',
      twitterName: account?.twitterName || '',
      profile: account?.profile || '',
      ethAddr: accountStore.ethConnectAddress,
      fid: account?.fid || account?.twitterId || '',
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
    const account = accountStore.getAccountInfo;
    const result = await generateMiniAppToken(
      account?.twitterId || '',
      accountStore.ethConnectAddress,
      account?.steemId || '',
      account?.twitterUsername || ''
    ) as any;

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

  const address = accountStore.ethConnectAddress as `0x${string}`;
  const account = accountStore.getAccountInfo;
  const message = `Sign in to TagAI Mini App\nNonce: ${params.nonce || Date.now()}`;

  const signature = await privyStore.viemWalletClient!.signMessage({
    account: address,
    message,
  });

  return {
    ethAddress: address,
    twitterId: account?.twitterId || '',
    twitterUsername: account?.twitterUsername || '',
    steemUsername: account?.steemId || '',
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

// ==========================================
// Twitter Handlers
// ==========================================

async function handleTwitterIsConnected(): Promise<{ connected: boolean }> {
  const account = accountStore.getAccountInfo;
  // Check if user has a Twitter ID connected
  return { connected: !!(account?.twitterId) };
}

async function handleTwitterGetUser(): Promise<{
  twitterId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
} | null> {
  const account = accountStore.getAccountInfo;

  if (!account?.twitterId) {
    return null;
  }

  return {
    twitterId: account.twitterId,
    username: account.twitterUsername || '',
    displayName: account.twitterName || account.twitterUsername || '',
    profileImageUrl: account.profile || undefined,
  };
}

async function handleTwitterPost(params: any): Promise<{
  tweetId: string;
  url: string;
  success: boolean;
}> {
  const { text, mediaUrls, quoteTweetId, replyToTweetId } = params;

  if (!text || text.length === 0) {
    throw new Error('Tweet text is required');
  }

  if (text.length > 280) {
    throw new Error('Tweet text exceeds 280 character limit');
  }

  // For now, we use the compose dialog which can post to Twitter
  // In the future, this could use a direct Twitter API call
  try {
    const tokenResult = await handleAuthGetToken({});
    const token = tokenResult.token;

    // Use Steem post with crossPostTwitter flag to also post to Twitter
    const result = await createSteemPost(
      token,
      '', // No title for tweet-style posts
      text,
      [], // No tags
      { mediaUrls, quoteTweetId, replyToTweetId },
      []
    );

    return {
      tweetId: result.data?.twitterTweetId || '',
      url: result.data?.twitterUrl || `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      success: true,
    };
  } catch (error) {
    console.error('Failed to post tweet:', error);
    throw new Error('Failed to post tweet');
  }
}

async function handleTwitterShare(params: any): Promise<void> {
  const { url, text, hashtags, via, intentUrl } = params;

  // Use the pre-built intent URL if provided, otherwise build one
  let shareUrl = intentUrl;

  if (!shareUrl) {
    const searchParams = new URLSearchParams();
    if (url) searchParams.set('url', url);
    if (text) searchParams.set('text', text);
    if (hashtags && hashtags.length > 0) searchParams.set('hashtags', hashtags.join(','));
    if (via) searchParams.set('via', via);
    shareUrl = `https://twitter.com/intent/tweet?${searchParams.toString()}`;
  }

  // Open Twitter share dialog
  window.open(shareUrl, '_blank', 'width=550,height=420');
}

async function handleWalletGetAddress(): Promise<Address> {
  return accountStore.ethConnectAddress as Address;
}

async function handleWalletGetBalance() {
  const chainId = privyStore.getChainId();
  const chain = privyStore.currentChain;

  // Create public client for balance query
  const { createPublicClient, http } = await import('viem');
  const client = createPublicClient({
    chain,
    transport: http(),
  });

  const balance = await client.getBalance({
    address: accountStore.ethConnectAddress as Address,
  });

  const nativeSymbols: Record<number, string> = {
    1: 'ETH',
    56: 'BNB',
    8453: 'ETH',
    10: 'ETH',
    42161: 'ETH',
  };

  return {
    value: balance.toString(),
    symbol: nativeSymbols[chainId] || 'ETH',
  };
}

async function handleWalletSendTransaction(params: any): Promise<Hash> {
  const hash = await privyStore.viemWalletClient!.sendTransaction(params);
  return hash;
}

async function handleWalletSignMessage(params: any): Promise<string> {
  const address = accountStore.ethConnectAddress as `0x${string}`;
  const signature = await privyStore.viemWalletClient!.signMessage({
    account: address,
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
        postUrl: (result as any).url,
        author: (result as any).author,
        permlink: (result as any).permlink,
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

// ==========================================
// DeFi Actions Handlers
// ==========================================

/**
 * Estimate gas for a transaction
 * @param tokenInfo Token information
 * @param amount Amount to send (in wei)
 * @param recipientAddress Recipient address
 * @returns Estimated gas in native token units (e.g., "0.0021 BNB")
 */
async function estimateTransactionGas(
  tokenInfo: TokenInfo,
  amount: string,
  recipientAddress: Address
): Promise<string | undefined> {
  try {
    if (!privyStore.viemWalletClient) {
      return undefined;
    }

    const userAddress = accountStore.ethConnectAddress as Address;
    const chain = privyStore.currentChain;

    let gasEstimate: bigint;

    if (tokenInfo.isNative) {
      // Estimate gas for native token transfer
      gasEstimate = await privyStore.viemWalletClient.estimateGas({
        account: userAddress,
        to: recipientAddress,
        value: BigInt(amount),
        chain,
      });
    } else {
      // Estimate gas for ERC20 transfer
      const { encodeFunctionData } = await import('viem');
      const data = encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [recipientAddress, BigInt(amount)],
      });

      gasEstimate = await privyStore.viemWalletClient.estimateGas({
        account: userAddress,
        to: tokenInfo.address!,
        data,
        chain,
      });
    }

    // Get current gas price
    const gasPrice = await privyStore.viemWalletClient.getGasPrice();

    // Calculate total gas cost
    const gasCost = gasEstimate * gasPrice;

    // Format to native token units with 4 decimal places
    const formatted = formatUnits(gasCost, 18);
    const number = parseFloat(formatted);
    return number.toFixed(6);
  } catch (error: any) {
    console.error('Failed to estimate gas:', error);
    // Return a reasonable default estimate if estimation fails
    return '0.001';
  }
}

async function handleActionsViewToken(params: any) {
  try {
    const { token, _parsed } = params;

    // Parse CAIP-19 token identifier
    const parsed = _parsed || parseCAIP19(token);
    const { chainId, namespace, address } = parsed;

    console.log('ViewToken:', { chainId, namespace, address });

    // ViewToken is meant to display token information to the user
    // Since Mini Apps run in an iframe, we shouldn't navigate the main app
    // Instead, we could:
    // 1. Show a modal/popup with token details
    // 2. Open an external block explorer link
    // 3. Simply log and return success (for testing purposes)
    
    // For now, just return success - the Mini App can handle displaying token info
    // In a production implementation, we might want to show a token detail modal
    // or open the block explorer in a new tab
    
    if (address) {
      // ERC20 token - could open block explorer
      const explorerUrls: Record<number, string> = {
        1: 'https://etherscan.io/token/',
        56: 'https://bscscan.com/token/',
        97: 'https://testnet.bscscan.com/token/',
        11155111: 'https://sepolia.etherscan.io/token/',
      };
      const baseUrl = explorerUrls[chainId];
      if (baseUrl) {
        window.open(`${baseUrl}${address}`, '_blank');
      }
    }

    return { chainId, namespace, address };
  } catch (error: any) {
    console.error('Failed to view token:', error);
    throw new Error('Failed to view token');
  }
}

async function handleActionsSendToken(params: any) {
  try {
    const { token, amount, recipientAddress, recipientTwitterId, _parsed } = params;

    // 验证必需参数
    if (!recipientAddress && !recipientTwitterId) {
      throw new Error('Either recipientAddress or recipientTwitterId is required');
    }

    // 验证地址格式
    if (recipientAddress && !isAddress(recipientAddress)) {
      return {
        success: false,
        reason: 'send_failed',
        error: {
          error: 'InvalidAddress',
          message: `Invalid recipient address: ${recipientAddress}`,
        },
      };
    }

    // 安全: 检查零地址，防止资金损失
    if (recipientAddress && recipientAddress.toLowerCase() === zeroAddress.toLowerCase()) {
      return {
        success: false,
        reason: 'send_failed',
        error: {
          error: 'ZeroAddress',
          message: 'Cannot send tokens to zero address (0x0000...0000)',
        },
      };
    }

    // 解析代币
    const parsedToken = _parsed || (token ? parseCAIP19(token) : null);

    // 如果没有指定代币，使用当前链的原生代币
    const finalParsedToken = parsedToken || {
      chainId: privyStore.getChainId(),
      namespace: 'native' as const,
    };

    // 获取代币信息
    const tokenInfo = await getTokenInfo(finalParsedToken);

    // 解析接收地址（如果提供了 Twitter ID，需要转换为地址）
    let finalRecipientAddress = recipientAddress as Address | undefined;

    if (!finalRecipientAddress && recipientTwitterId) {
      // 通过 Twitter ID 获取 ETH 地址
      const ethAddr = await getEthAddressByTwitterId(recipientTwitterId);

      if (!ethAddr) {
        return {
          success: false,
          reason: 'send_failed',
          error: {
            error: 'TwitterIdNotFound',
            message: `Unable to find ETH address for Twitter ID: ${recipientTwitterId}`,
          },
        };
      }

      finalRecipientAddress = ethAddr as Address;
    }

    if (!finalRecipientAddress) {
      throw new Error('Unable to resolve recipient address');
    }

    // 估算 gas
    const estimatedGas = await estimateTransactionGas(
      tokenInfo,
      amount || '0',
      finalRecipientAddress
    );

    // 显示确认对话框
    return new Promise((resolve) => {
      sendTokenDialog.value = {
        visible: true,
        tokenInfo,
        amount: amount || '0',
        recipientAddress: finalRecipientAddress,
        recipientTwitterId,
        estimatedGas,
        submitting: false,
      };
      sendTokenResolve = resolve;
    });
  } catch (error: any) {
    console.error('Failed to send token:', error);
    return {
      success: false,
      reason: 'send_failed',
      error: {
        error: error.name || 'SendTokenError',
        message: error.message || 'Failed to send token',
      },
    };
  }
}

function handleSendTokenClose() {
  sendTokenDialog.value.visible = false;
  if (sendTokenResolve) {
    sendTokenResolve({
      success: false,
      reason: 'rejected_by_user',
    });
    sendTokenResolve = null;
  }
}

function handleSendTokenReject() {
  handleSendTokenClose();
}

async function handleSendTokenConfirm() {
  // 设置提交状态，禁用按钮
  sendTokenDialog.value.submitting = true;

  try {
    const { tokenInfo, amount, recipientAddress } = sendTokenDialog.value;

    if (!tokenInfo || !amount || !recipientAddress) {
      throw new Error('Missing required parameters');
    }

    // 规范化接收地址（确保正确的校验和格式）
    const normalizedRecipientAddress = getAddress(recipientAddress);

    // 确保钱包已初始化
    if (!privyStore.viemWalletClient) {
      await privyStore.initWallet();
    }

    // 切换到正确的链（如果需要）
    const currentChainId = privyStore.getChainId();
    if (currentChainId !== tokenInfo.chainId) {
      await privyStore.switchChain(tokenInfo.chainId);
      // 等待链切换完成
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    let txHash: Hash;
    const userAddress = accountStore.ethConnectAddress as `0x${string}`;
    // 重新获取当前链，确保使用切换后的链
    const chain = privyStore.currentChain;

    // 原生代币转账
    if (tokenInfo.isNative) {
      txHash = await privyStore.viemWalletClient!.sendTransaction({
        account: userAddress,
        chain: chain,
        to: normalizedRecipientAddress,
        value: BigInt(amount),
      });
    } else {
      // ERC20 代币转账
      if (!tokenInfo.address) {
        throw new Error('Token address is required for ERC20 transfer');
      }

      // ERC20 transfer ABI
      const transferAbi = [
        {
          constant: false,
          inputs: [
            { name: '_to', type: 'address' },
            { name: '_value', type: 'uint256' },
          ],
          name: 'transfer',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function',
        },
      ] as const;

      txHash = await privyStore.viemWalletClient!.writeContract({
        account: userAddress,
        chain: chain,
        address: tokenInfo.address,
        abi: transferAbi,
        functionName: 'transfer',
        args: [normalizedRecipientAddress, BigInt(amount)],
      });
    }

    // 关闭对话框并返回成功结果
    sendTokenDialog.value.visible = false;
    sendTokenDialog.value.submitting = false;
    if (sendTokenResolve) {
      sendTokenResolve({
        success: true,
        send: {
          transaction: txHash,
        },
      });
      sendTokenResolve = null;
    }
  } catch (error: any) {
    console.error('Failed to send token:', error);

    // 重置提交状态
    sendTokenDialog.value.submitting = false;

    // 关闭对话框并返回错误
    sendTokenDialog.value.visible = false;
    if (sendTokenResolve) {
      sendTokenResolve({
        success: false,
        reason: 'send_failed',
        error: {
          error: error.name || 'SendTokenError',
          message: error.message || 'Failed to send token',
        },
      });
      sendTokenResolve = null;
    }
  }
}

async function handleActionsSwapToken(params: any) {
  try {
    const { sellToken, buyToken, sellAmount, _parsedSellToken, _parsedBuyToken } = params;

    // 验证必需参数
    if (!sellToken && !_parsedSellToken) {
      throw new Error('sellToken is required');
    }
    if (!buyToken && !_parsedBuyToken) {
      throw new Error('buyToken is required');
    }

    // 解析代币
    const parsedSellToken = _parsedSellToken || parseCAIP19(sellToken);
    const parsedBuyToken = _parsedBuyToken || parseCAIP19(buyToken);

    // 验证代币在同一条链上
    if (parsedSellToken.chainId !== parsedBuyToken.chainId) {
      return {
        success: false,
        reason: 'swap_failed',
        error: {
          error: 'CrossChainSwapNotSupported',
          message: 'Cross-chain swaps are not supported',
        },
      };
    }

    // 获取代币信息
    const [sellTokenInfo, buyTokenInfo] = await Promise.all([
      getTokenInfo(parsedSellToken),
      getTokenInfo(parsedBuyToken),
    ]);

    // 使用提供的金额或默认为 0
    const finalSellAmount = sellAmount || '0';

    // 显示对话框并开始获取报价
    return new Promise(async (resolve) => {
      // 先显示对话框（loading 状态）
      swapTokenDialog.value = {
        visible: true,
        sellTokenInfo,
        buyTokenInfo,
        sellAmount: finalSellAmount,
        quote: undefined,
        estimatedGas: undefined,
        needsApproval: false,
        loading: true,
      };
      swapTokenResolve = resolve;

      try {
        // 获取报价
        const sellTokenAddress = sellTokenInfo.isNative ? 'native' : sellTokenInfo.address!;
        const buyTokenAddress = buyTokenInfo.isNative ? 'native' : buyTokenInfo.address!;

        const quote = await getSwapQuote(
          sellTokenInfo.chainId,
          sellTokenAddress,
          buyTokenAddress,
          finalSellAmount
        );

        // 检查是否需要授权（仅针对 ERC20 代币）
        let needsApproval = false;
        if (!sellTokenInfo.isNative && sellTokenInfo.address) {
          const { allowance } = await checkAllowance(
            sellTokenInfo.chainId,
            sellTokenInfo.address,
            accountStore.ethConnectAddress as Address
          );
          needsApproval = allowance < BigInt(finalSellAmount);
        }

        // 更新对话框状态
        swapTokenDialog.value = {
          ...swapTokenDialog.value,
          quote,
          estimatedGas: quote.estimatedGas,
          needsApproval,
          loading: false,
        };
      } catch (error: any) {
        console.error('Failed to get swap quote:', error);
        // 关闭对话框并返回错误
        swapTokenDialog.value.visible = false;
        if (swapTokenResolve) {
          swapTokenResolve({
            success: false,
            reason: 'swap_failed',
            error: {
              error: 'QuoteError',
              message: error.message || 'Failed to get swap quote',
            },
          });
          swapTokenResolve = null;
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to prepare swap:', error);
    return {
      success: false,
      reason: 'swap_failed',
      error: {
        error: error.name || 'SwapTokenError',
        message: error.message || 'Failed to prepare swap',
      },
    };
  }
}

function handleSwapTokenClose() {
  swapTokenDialog.value.visible = false;
  if (swapTokenResolve) {
    swapTokenResolve({
      success: false,
      reason: 'rejected_by_user',
    });
    swapTokenResolve = null;
  }
}

function handleSwapTokenReject() {
  handleSwapTokenClose();
}

async function handleSwapTokenConfirm() {
  // 设置提交状态，禁用按钮
  swapTokenDialog.value.submitting = true;

  try {
    const { sellTokenInfo, buyTokenInfo, sellAmount, needsApproval } = swapTokenDialog.value;

    if (!sellTokenInfo || !buyTokenInfo || !sellAmount) {
      throw new Error('Missing required parameters');
    }

    // 确保钱包已初始化
    if (!privyStore.viemWalletClient) {
      await privyStore.initWallet();
    }

    // 切换到正确的链（如果需要）
    const currentChainId = privyStore.getChainId();
    if (currentChainId !== sellTokenInfo.chainId) {
      await privyStore.switchChain(sellTokenInfo.chainId);
      // 等待链切换完成
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const transactions: Hash[] = [];
    const userAddress = accountStore.ethConnectAddress as Address;
    // 重新获取当前链，确保使用切换后的链
    const chain = privyStore.currentChain;

    // Step 1: 如果需要，先执行授权交易
    if (needsApproval && sellTokenInfo.address) {
      const approvalTx = await buildApprovalTransaction(
        sellTokenInfo.chainId,
        sellTokenInfo.address
      );

      const approveTxHash = await privyStore.viemWalletClient!.sendTransaction({
        account: userAddress,
        chain: chain,
        to: approvalTx.to,
        data: approvalTx.data,
        value: BigInt(approvalTx.value),
      });

      transactions.push(approveTxHash);

      // 等待授权交易确认
      // TODO: 可以添加交易确认等待逻辑
    }

    // Step 2: 执行 swap 交易
    const sellTokenAddress = sellTokenInfo.isNative ? 'native' : sellTokenInfo.address!;
    const buyTokenAddress = buyTokenInfo.isNative ? 'native' : buyTokenInfo.address!;

    const swapTx = await buildSwapTransaction(
      sellTokenInfo.chainId,
      sellTokenAddress,
      buyTokenAddress,
      sellAmount,
      userAddress,
      1 // 1% slippage
    );

    const swapTxHash = await privyStore.viemWalletClient!.sendTransaction({
      account: userAddress,
      chain: chain,
      to: swapTx.to,
      data: swapTx.data,
      value: BigInt(swapTx.value),
    });

    transactions.push(swapTxHash);

    // 关闭对话框并返回成功结果
    swapTokenDialog.value.visible = false;
    swapTokenDialog.value.submitting = false;
    if (swapTokenResolve) {
      swapTokenResolve({
        success: true,
        swap: {
          transactions,
        },
      });
      swapTokenResolve = null;
    }
  } catch (error: any) {
    console.error('Failed to execute swap:', error);

    // 重置提交状态
    swapTokenDialog.value.submitting = false;

    // 关闭对话框并返回错误
    swapTokenDialog.value.visible = false;
    if (swapTokenResolve) {
      swapTokenResolve({
        success: false,
        reason: 'swap_failed',
        error: {
          error: error.name || 'SwapTokenError',
          message: error.message || 'Failed to execute swap',
        },
      });
      swapTokenResolve = null;
    }
  }
}

// ==========================================
// Notifications Handlers
// ==========================================

async function handleNotificationsRequestPermission(): Promise<{ granted: boolean; token?: string }> {
  try {
    // Check browser notification API support
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Generate a simple token for demonstration
        const token = `tagai_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return { granted: true, token };
      }
      return { granted: false };
    }
    return { granted: false };
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return { granted: false };
  }
}

async function handleNotificationsIsEnabled(): Promise<{ enabled: boolean }> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return { enabled: Notification.permission === 'granted' };
  }
  return { enabled: false };
}

async function handleNotificationsGetStatus(): Promise<{ subscribed: boolean; token?: string; enabled: boolean }> {
  const enabled = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  return {
    subscribed: enabled,
    token: enabled ? `tagai_notif_cached` : undefined,
    enabled,
  };
}

async function handleNotificationsSubscribe(params: any) {
  try {
    const { token } = params;

    if (!token) {
      throw new Error('Notification token is required');
    }

    // 获取当前应用的 domain
    const appDomain = new URL(props.appUrl).hostname;
    const account = accountStore.getAccountInfo;

    // 调用 webhook 通知后端保存 token
    // 注意：这里应该调用应用的 webhookUrl，而不是直接调用后端
    // 在实际实现中，应该通过后端代理 webhook 调用
    const webhookUrl = manifest.value?.webhookUrl;

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'miniapp_added',
          twitterId: account?.twitterId || '',
          notificationDetails: {
            url: webhookUrl,
            token: token
          }
        })
      });
    }

    return { subscribed: true };
  } catch (error) {
    console.error('Failed to subscribe to notifications:', error);
    throw new Error('Failed to subscribe to notifications');
  }
}

async function handleNotificationsUnsubscribe() {
  try {
    const appDomain = new URL(props.appUrl).hostname;
    const account = accountStore.getAccountInfo;

    const webhookUrl = manifest.value?.webhookUrl;

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'miniapp_removed',
          twitterId: account?.twitterId || ''
        })
      });
    }

    return { unsubscribed: true };
  } catch (error) {
    console.error('Failed to unsubscribe from notifications:', error);
    throw new Error('Failed to unsubscribe from notifications');
  }
}

// ==========================================
// Haptics Handlers
// ==========================================

const VIBRATION_PATTERNS: Record<string, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  soft: [5, 5, 5],
  rigid: [15, 5, 15],
};

const NOTIFICATION_PATTERNS: Record<string, number[]> = {
  success: [10, 50, 10],
  warning: [20, 50, 20, 50, 20],
  error: [30, 50, 30, 50, 30],
};

async function handleHapticsImpact(params: any): Promise<void> {
  const style = params?.style || 'medium';
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const pattern = VIBRATION_PATTERNS[style] || VIBRATION_PATTERNS.medium;
      navigator.vibrate(pattern);
    } catch {
      // Silently fail if vibration is not allowed
    }
  }
}

async function handleHapticsNotification(params: any): Promise<void> {
  const type = params?.type || 'success';
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const pattern = NOTIFICATION_PATTERNS[type] || NOTIFICATION_PATTERNS.success;
      navigator.vibrate(pattern);
    } catch {
      // Silently fail if vibration is not allowed
    }
  }
}

async function handleHapticsSelection(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(5);
    } catch {
      // Silently fail if vibration is not allowed
    }
  }
}

// ==========================================
// Platform Handlers
// ==========================================

const TAGAI_CAPABILITIES = [
  'wallet.getProvider',
  'wallet.sendTransaction',
  'wallet.signMessage',
  'wallet.getBalance',
  'actions.ready',
  'actions.close',
  'actions.openUrl',
  'actions.compose',
  'actions.share',
  'actions.viewProfile',
  'actions.viewPost',
  'actions.setPrimaryButton',
  'actions.addMiniApp',
  'actions.requestCameraAndMicrophoneAccess',
  'actions.swapToken',
  'actions.sendToken',
  'actions.viewToken',
  'actions.openMiniApp',
  'auth.getToken',
  'auth.signIn',
  'steem.post',
  'steem.vote',
  'steem.comment',
  'steem.reblog',
  'haptics.impactOccurred',
  'haptics.notificationOccurred',
  'haptics.selectionChanged',
  'notifications.requestPermission',
  'notifications.subscribe',
  'notifications.unsubscribe',
  'twitter.post',
  'twitter.share',
  'back',
];

const SUPPORTED_CHAINS = [
  'eip155:56',   // BSC Mainnet
  'eip155:97',   // BSC Testnet
  'eip155:1',    // Ethereum Mainnet (read-only)
];

async function handlePlatformGetCapabilities(): Promise<string[]> {
  return TAGAI_CAPABILITIES;
}

async function handlePlatformGetChains(): Promise<string[]> {
  return SUPPORTED_CHAINS;
}

async function handlePlatformGetPlatformType(): Promise<'web' | 'mobile' | 'desktop'> {
  if (typeof window === 'undefined') {
    return 'web';
  }
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
    return 'mobile';
  }
  if (/electron/i.test(userAgent)) {
    return 'desktop';
  }
  return 'web';
}

// ==========================================
// Back Navigation Handlers
// ==========================================

let backNavigationEnabled = false;

async function handleBackUpdateState(params: any): Promise<void> {
  backNavigationEnabled = params?.enabled || false;
}

async function handleBackGoBack(): Promise<void> {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
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
    allowedOrigin.value // 安全: 使用具体的 origin 替代 '*'
  );
}
</script>

<style scoped>
.miniapp-host {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow-y: auto;
}

.miniapp-host.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  overflow: hidden;
  min-height: auto;
  height: 100%;
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
  border-left-color: #FF7A00;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.miniapp-iframe {
  width: 100%;
  min-height: 100vh;
  border: none;
}

.miniapp-host.fullscreen .miniapp-iframe {
  min-height: auto;
  height: 100%;
}

.primary-button {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  padding: 16px;
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
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
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
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
