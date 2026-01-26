/**
 * TagAI Mini App Host Types
 * Type definitions for the host-side implementation
 */

import type { MiniAppContext } from '../../miniapp-core/src/context';
import type { Address, Hash } from 'viem';

// ==========================================
// Message Types
// ==========================================

/**
 * Message sent from Mini App to Host
 */
export interface MiniAppMessage {
  id: string;
  method: string;
  params?: any;
}

/**
 * Response sent from Host to Mini App
 */
export interface MiniAppResponse {
  id: string;
  result?: any;
  error?: {
    code?: number;
    message: string;
  };
}

// ==========================================
// Handler Types
// ==========================================

/**
 * Handler function for Mini App requests
 */
export type MiniAppHandler<T = any, R = any> = (
  params: T,
  context: HostContext
) => Promise<R> | R;

/**
 * Host context available to handlers
 */
export interface HostContext {
  /** Current Mini App context */
  miniAppContext: MiniAppContext;
  /** Mini App domain */
  domain: string;
  /** Mini App URL */
  url: string;
  /** User's Twitter ID */
  twitterId?: string;
  /** User's ETH address */
  ethAddress?: Address;
  /** Send event to Mini App */
  sendEvent: (eventName: string, data?: any) => void;
  /** Close the Mini App */
  closeMiniApp: () => void;
}

// ==========================================
// Action Handlers
// ==========================================

export interface ReadyParams {
  splashDuration?: number;
  disableNativeGestures?: boolean;
}

export interface SetPrimaryButtonParams {
  text: string;
  enabled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export interface ComposeParams {
  text?: string;
  images?: string[];
  tags?: string[];
  closeOnPost?: boolean;
}

export interface ComposeResult {
  posted: boolean;
  permlink?: string;
  author?: string;
  tweetId?: string;
}

export interface ShareParams {
  url: string;
  text?: string;
}

export interface ViewProfileParams {
  username: string;
}

export interface ViewPostParams {
  author: string;
  permlink: string;
}

export interface OpenUrlParams {
  url: string;
}

export interface OpenMiniAppParams {
  domain: string;
  url?: string;
}

// ==========================================
// Auth Handlers
// ==========================================

export interface GetTokenParams {
  forceRefresh?: boolean;
}

export interface GetTokenResult {
  token: string;
  expiresAt: number;
}

export interface SignInParams {
  nonce?: string;
  acceptAuthAddress?: boolean;
}

export interface SignInResult {
  ethAddress: Address;
  twitterId?: string;
  twitterUsername?: string;
  steemUsername?: string;
  displayName?: string;
  avatar?: string;
  message: string;
  signature: string;
}

// ==========================================
// Wallet Handlers
// ==========================================

export interface SendTransactionParams {
  to: Address;
  value?: string;
  data?: `0x${string}`;
  gas?: string;
}

export interface SignMessageParams {
  message: string;
}

export interface GetBalanceResult {
  value: string;
  formatted: string;
  symbol: string;
}

// ==========================================
// DeFi Handlers
// ==========================================

export interface SwapTokenParams {
  sellToken?: string;
  buyToken?: string;
  sellAmount?: string;
  _parsedSellToken?: {
    chainId: number;
    namespace: string;
    address?: string;
  };
  _parsedBuyToken?: {
    chainId: number;
    namespace: string;
    address?: string;
  };
}

export interface SwapTokenResult {
  success: boolean;
  swap?: {
    transactions: `0x${string}`[];
  };
  reason?: 'rejected_by_user' | 'swap_failed';
  error?: {
    error: string;
    message?: string;
  };
}

export interface SendTokenParams {
  token?: string;
  amount?: string;
  recipientAddress?: Address;
  recipientTwitterId?: string;
  _parsed?: {
    chainId: number;
    namespace: string;
    address?: string;
  };
}

export interface SendTokenResult {
  success: boolean;
  send?: {
    transaction: `0x${string}`;
  };
  reason?: 'rejected_by_user' | 'send_failed';
  error?: {
    error: string;
    message?: string;
  };
}

export interface ViewTokenParams {
  token: string;
  _parsed?: {
    chainId: number;
    namespace: string;
    address?: string;
  };
}

// ==========================================
// Steem Handlers
// ==========================================

export interface SteemPostParams {
  title: string;
  body: string;
  tags?: string[];
  jsonMetadata?: Record<string, any>;
  beneficiaries?: Array<{
    account: string;
    weight: number;
  }>;
  crossPostTwitter?: boolean;
}

export interface SteemPostResult {
  author: string;
  permlink: string;
  url: string;
  twitterTweetId?: string;
}

export interface SteemVoteParams {
  author: string;
  permlink: string;
  weight: number;
}

export interface SteemCommentParams {
  parentAuthor: string;
  parentPermlink: string;
  body: string;
  jsonMetadata?: Record<string, any>;
}

export interface SteemReblogParams {
  author: string;
  permlink: string;
}

// ==========================================
// Notification Handlers
// ==========================================

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
}

export interface NotificationSubscribeParams {
  token: string;
}

export interface NotificationStatusResult {
  subscribed: boolean;
  token?: string;
  enabled: boolean;
}

// ==========================================
// Haptics Handlers
// ==========================================

export interface ImpactOccurredParams {
  style?: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
}

export interface NotificationOccurredParams {
  type: 'success' | 'warning' | 'error';
}

// ==========================================
// Back Navigation Handlers
// ==========================================

export interface UpdateBackStateParams {
  enabled: boolean;
}

// ==========================================
// Platform Handlers
// ==========================================

export type Capability =
  | 'wallet.getProvider'
  | 'wallet.sendTransaction'
  | 'wallet.signMessage'
  | 'wallet.getBalance'
  | 'actions.ready'
  | 'actions.close'
  | 'actions.openUrl'
  | 'actions.compose'
  | 'actions.share'
  | 'actions.viewProfile'
  | 'actions.viewPost'
  | 'actions.setPrimaryButton'
  | 'actions.addMiniApp'
  | 'actions.requestCameraAndMicrophoneAccess'
  | 'actions.swapToken'
  | 'actions.sendToken'
  | 'actions.viewToken'
  | 'actions.openMiniApp'
  | 'auth.getToken'
  | 'auth.signIn'
  | 'steem.post'
  | 'steem.vote'
  | 'steem.comment'
  | 'steem.reblog'
  | 'haptics.impactOccurred'
  | 'haptics.notificationOccurred'
  | 'haptics.selectionChanged'
  | 'notifications.requestPermission'
  | 'notifications.subscribe'
  | 'notifications.unsubscribe'
  | 'twitter.post'
  | 'twitter.share'
  | 'back';

// ==========================================
// Handler Map
// ==========================================

export interface MiniAppHandlers {
  // Context
  getContext: MiniAppHandler<void, MiniAppContext>;

  // Actions
  'actions.ready': MiniAppHandler<ReadyParams, void>;
  'actions.close': MiniAppHandler<void, void>;
  'actions.openUrl': MiniAppHandler<OpenUrlParams, void>;
  'actions.compose': MiniAppHandler<ComposeParams, ComposeResult>;
  'actions.share': MiniAppHandler<ShareParams, void>;
  'actions.viewProfile': MiniAppHandler<ViewProfileParams, void>;
  'actions.viewPost': MiniAppHandler<ViewPostParams, void>;
  'actions.setPrimaryButton': MiniAppHandler<SetPrimaryButtonParams, void>;
  'actions.addMiniApp': MiniAppHandler<void, { added: boolean }>;
  'actions.requestCameraAndMicrophoneAccess': MiniAppHandler<void, { camera: boolean; microphone: boolean }>;
  'actions.openMiniApp': MiniAppHandler<OpenMiniAppParams, void>;

  // DeFi Actions
  'actions.swapToken': MiniAppHandler<SwapTokenParams, SwapTokenResult>;
  'actions.sendToken': MiniAppHandler<SendTokenParams, SendTokenResult>;
  'actions.viewToken': MiniAppHandler<ViewTokenParams, void>;

  // Auth
  'auth.getToken': MiniAppHandler<GetTokenParams, GetTokenResult>;
  'auth.signIn': MiniAppHandler<SignInParams, SignInResult>;

  // Wallet
  'wallet.getProvider': MiniAppHandler<void, any>;
  'wallet.sendTransaction': MiniAppHandler<SendTransactionParams, Hash>;
  'wallet.signMessage': MiniAppHandler<SignMessageParams, string>;
  'wallet.getBalance': MiniAppHandler<void, GetBalanceResult>;
  'wallet.getAddress': MiniAppHandler<void, Address>;

  // Steem
  'steem.post': MiniAppHandler<SteemPostParams, SteemPostResult>;
  'steem.vote': MiniAppHandler<SteemVoteParams, void>;
  'steem.comment': MiniAppHandler<SteemCommentParams, SteemPostResult>;
  'steem.reblog': MiniAppHandler<SteemReblogParams, void>;

  // Notifications
  'notifications.requestPermission': MiniAppHandler<void, NotificationPermissionResult>;
  'notifications.subscribe': MiniAppHandler<NotificationSubscribeParams, void>;
  'notifications.unsubscribe': MiniAppHandler<void, void>;
  'notifications.isEnabled': MiniAppHandler<void, { enabled: boolean }>;
  'notifications.getStatus': MiniAppHandler<void, NotificationStatusResult>;

  // Haptics
  'haptics.impactOccurred': MiniAppHandler<ImpactOccurredParams, void>;
  'haptics.notificationOccurred': MiniAppHandler<NotificationOccurredParams, void>;
  'haptics.selectionChanged': MiniAppHandler<void, void>;

  // Back Navigation
  'back.updateState': MiniAppHandler<UpdateBackStateParams, void>;
  'back.goBack': MiniAppHandler<void, void>;

  // Platform
  'platform.getCapabilities': MiniAppHandler<void, Capability[]>;
  'platform.getChains': MiniAppHandler<void, string[]>;
  'platform.getPlatformType': MiniAppHandler<void, 'web' | 'mobile' | 'desktop'>;
}
