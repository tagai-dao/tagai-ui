/**
 * TagAI Mini App SDK Types
 * Complete type definitions for TagAI Mini Apps framework
 * Based on Farcaster mini apps specification with TagAI-specific extensions
 */

import type { MiniAppContext, MiniAppNotificationDetails } from '../../miniapp-core/src/context';
import type { WalletClient, Hash, Address } from 'viem';

// ==========================================
// Auth Module Types
// ==========================================

export interface SignInOptions {
  /**
   * Nonce for signing (auto-generated if not provided)
   */
  nonce?: string;

  /**
   * Accept auth address in response (default: true)
   */
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

export interface AuthModule {
  /**
   * Get current JWT token (if available and not expired)
   */
  readonly token: string | undefined;

  /**
   * Get or generate JWT token
   * Implements automatic caching and refresh
   */
  getToken(options?: {
    forceRefresh?: boolean;
  }): Promise<{ token: string; expiresAt: number }>;

  /**
   * Sign in user (triggers Privy + Twitter auth)
   * Returns signed message for verification
   */
  signIn(options?: SignInOptions): Promise<SignInResult>;

  /**
   * Authenticated fetch (automatically adds Bearer token)
   * Similar to Farcaster's quickAuth.fetch
   */
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

// ==========================================
// Steem Module Types (TagAI-specific)
// ==========================================

export interface SteemPostOptions {
  title: string;
  body: string;
  tags?: string[];
  jsonMetadata?: Record<string, any>;
  beneficiaries?: Array<{
    account: string;
    weight: number;  // 0-10000 (100% = 10000)
  }>;
  /** Whether to also post to Twitter (default: true) */
  crossPostTwitter?: boolean;
}

export interface SteemPostResult {
  author: string;
  permlink: string;
  url: string;
  twitterTweetId?: string;
}

export interface SteemCommentOptions {
  parentAuthor: string;
  parentPermlink: string;
  body: string;
  jsonMetadata?: Record<string, any>;
}

export interface SteemModule {
  /**
   * Create a post on Steem (and optionally Twitter)
   */
  post(options: SteemPostOptions): Promise<SteemPostResult>;

  /**
   * Vote on a post/comment
   * @param weight - Vote weight 0-10000 (100% = 10000, 50% = 5000)
   */
  vote(author: string, permlink: string, weight: number): Promise<void>;

  /**
   * Comment on a post
   */
  comment(options: SteemCommentOptions): Promise<SteemPostResult>;

  /**
   * Reblog (resteem) a post
   */
  reblog(author: string, permlink: string): Promise<void>;
}

// ==========================================
// Wallet Module Types
// ==========================================

export interface WalletModule {
  /**
   * Get Viem wallet client (for BSC interactions)
   */
  getProvider(): Promise<WalletClient>;

  /**
   * Send transaction
   */
  sendTransaction(options: {
    to: Address;
    value?: bigint;
    data?: `0x${string}`;
    gas?: bigint;
  }): Promise<Hash>;

  /**
   * Sign message
   */
  signMessage(message: string): Promise<string>;

  /**
   * Get BNB balance
   */
  getBalance(): Promise<{
    value: bigint;
    formatted: string;
    symbol: string;
  }>;

  /**
   * Get current connected address
   */
  getAddress(): Promise<Address>;
}

// ==========================================
// Actions Module Types
// ==========================================

export interface ComposeOptions {
  text?: string;
  images?: string[];
  tags?: string[];
  /** Whether to close mini app after posting */
  closeOnPost?: boolean;
}

export interface ComposeResult {
  posted: boolean;
  permlink?: string;
  author?: string;
  tweetId?: string;
}

export interface SetPrimaryButtonOptions {
  text: string;
  enabled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export interface ReadyOptions {
  /**
   * Splash screen duration in ms (default: 0)
   */
  splashDuration?: number;
  /**
   * Disable native gestures like swipe back
   */
  disableNativeGestures?: boolean;
}

// ==========================================
// DeFi Actions Types
// ==========================================

/** CAIP-19 asset identifier (e.g., "eip155:56/erc20:0x...") */
export type AssetId = string;

/** Amount as numeric string (e.g., "1000000" for 1 USDC with 6 decimals) */
export type TokenAmount = string;

// Error Details
export interface ErrorDetails {
  error: string;
  message?: string;
}

// SwapToken
export interface SwapTokenOptions {
  /** Token to sell (CAIP-19 format) */
  sellToken?: AssetId;
  /** Token to buy (CAIP-19 format) */
  buyToken?: AssetId;
  /** Amount to sell (numeric string) */
  sellAmount?: TokenAmount;
}

export interface SwapTokenDetails {
  /** Transaction hashes in execution order (may include approval + swap) */
  transactions: `0x${string}`[];
}

export type SwapTokenErrorReason = 'rejected_by_user' | 'swap_failed';

export type SwapTokenResult =
  | { success: true; swap: SwapTokenDetails }
  | { success: false; reason: SwapTokenErrorReason; error?: ErrorDetails };

// SendToken
export interface SendTokenOptions {
  /** Token to send (CAIP-19 format) */
  token?: AssetId;
  /** Amount to send (numeric string) */
  amount?: TokenAmount;
  /** Recipient Ethereum address */
  recipientAddress?: Address;
  /** Recipient Twitter ID (TagAI-specific) */
  recipientTwitterId?: string;
}

export interface SendTokenDetails {
  /** Transaction hash */
  transaction: `0x${string}`;
}

export type SendTokenErrorReason = 'rejected_by_user' | 'send_failed';

export type SendTokenResult =
  | { success: true; send: SendTokenDetails }
  | { success: false; reason: SendTokenErrorReason; error?: ErrorDetails };

// ViewToken
export interface ViewTokenOptions {
  /** Token to view (CAIP-19 format, required) */
  token: AssetId;
}

export interface ActionsModule {
  /**
   * Signal that Mini App is ready to be displayed
   */
  ready(options?: ReadyOptions): Promise<void>;

  /**
   * Close the Mini App
   */
  close(): Promise<void>;

  /**
   * Open URL (external or internal)
   */
  openUrl(url: string): Promise<void>;

  /**
   * Open compose dialog (create Steem post)
   */
  compose(options?: ComposeOptions): Promise<ComposeResult>;

  /**
   * Share content
   */
  share(options: {
    url: string;
    text?: string;
  }): Promise<void>;

  /**
   * View user profile
   */
  viewProfile(username: string): Promise<void>;

  /**
   * View post
   */
  viewPost(author: string, permlink: string): Promise<void>;

  /**
   * Set primary button
   */
  setPrimaryButton(options: SetPrimaryButtonOptions): Promise<void>;

  /**
   * Add this Mini App to user's app list
   */
  addMiniApp(): Promise<{ added: boolean }>;

  /**
   * Request camera and microphone access
   */
  requestCameraAndMicrophoneAccess(): Promise<{
    camera: boolean;
    microphone: boolean;
  }>;

  /**
   * Open another Mini App
   */
  openMiniApp(options: {
    domain: string;
    url?: string;
  }): Promise<void>;

  // ===== DeFi Actions =====

  /**
   * Swap tokens using DEX
   * Opens swap dialog with pre-filled parameters (user can modify)
   * May execute multiple transactions (approval + swap)
   */
  swapToken(options: SwapTokenOptions): Promise<SwapTokenResult>;

  /**
   * Send tokens to address
   * Opens send confirmation dialog
   * Executes transfer transaction
   */
  sendToken(options: SendTokenOptions): Promise<SendTokenResult>;

  /**
   * View token details
   * Navigates to token detail page
   */
  viewToken(options: ViewTokenOptions): Promise<void>;
}

// ==========================================
// Haptics Module Types
// ==========================================

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type NotificationType = 'success' | 'warning' | 'error';

export interface HapticsModule {
  /**
   * Trigger impact feedback
   */
  impactOccurred: (style?: ImpactStyle) => Promise<void>;

  /**
   * Trigger notification feedback
   */
  notificationOccurred: (type: NotificationType) => Promise<void>;

  /**
   * Trigger selection change feedback
   */
  selectionChanged: () => Promise<void>;
}

// ==========================================
// Platform Module Types
// ==========================================

export type TagAICapability =
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

export type AppState = 'active' | 'inactive' | 'background';

export interface PlatformModule {
  /**
   * Get list of supported capabilities
   */
  getCapabilities: () => Promise<TagAICapability[]>;

  /**
   * Check if a specific capability is supported
   */
  hasCapability: (capability: TagAICapability) => Promise<boolean>;

  /**
   * Get list of supported chains (CAIP-2 format)
   */
  getChains: () => Promise<string[]>;

  /**
   * Check if a specific chain is supported
   */
  isChainSupported: (chainId: string) => Promise<boolean>;

  /**
   * Get current platform type
   */
  getPlatformType: () => Promise<'web' | 'mobile' | 'desktop'>;

  /**
   * Get SDK version
   */
  getVersion: () => string;

  /**
   * Check if running in development mode
   */
  isDevelopment: () => boolean;

  /**
   * Listen to app state changes
   */
  onAppStateChange: (callback: (state: AppState) => void) => () => void;
}

// ==========================================
// Back Module Types
// ==========================================

export interface BackState {
  enabled: boolean;
  handler?: () => void | Promise<void>;
}

export interface BackModule {
  /**
   * Update back navigation state
   */
  updateState: (state: BackState) => Promise<void>;

  /**
   * Enable back navigation
   */
  enable: (handler?: () => void | Promise<void>) => Promise<void>;

  /**
   * Disable back navigation
   */
  disable: () => Promise<void>;

  /**
   * Trigger back navigation programmatically
   */
  goBack: () => Promise<void>;

  /**
   * Check if back navigation is currently enabled
   */
  isEnabled: () => boolean;
}

// ==========================================
// Twitter Module Types (TagAI-specific)
// ==========================================

export interface TwitterPostOptions {
  /** Tweet text content (max 280 chars) */
  text: string;
  /** Media URLs to attach (max 4 images) */
  mediaUrls?: string[];
  /** Quote tweet ID */
  quoteTweetId?: string;
  /** Reply to tweet ID */
  replyToTweetId?: string;
}

export interface TwitterPostResult {
  /** Tweet ID */
  tweetId: string;
  /** Tweet URL */
  url: string;
  /** Whether post was successful */
  success: boolean;
}

export interface TwitterShareOptions {
  /** URL to share */
  url: string;
  /** Pre-filled tweet text */
  text?: string;
  /** Hashtags to include */
  hashtags?: string[];
  /** Via account */
  via?: string;
}

export interface TwitterModule {
  /**
   * Post a tweet through TagAI
   */
  post(options: TwitterPostOptions): Promise<TwitterPostResult>;

  /**
   * Open Twitter share dialog
   */
  share(options: TwitterShareOptions): Promise<void>;

  /**
   * Check if user has Twitter connected
   */
  isConnected(): Promise<boolean>;

  /**
   * Get current user's Twitter info
   */
  getUser(): Promise<{
    twitterId: string;
    username: string;
    displayName: string;
    profileImageUrl?: string;
  } | null>;
}

// ==========================================
// Notifications Module Types
// ==========================================

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
}

export interface NotificationsModule {
  /**
   * Request notification permission
   */
  requestPermission(): Promise<NotificationPermissionResult>;

  /**
   * Subscribe to notifications
   */
  subscribe(): Promise<string>;

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(): Promise<void>;

  /**
   * Check if notifications are enabled
   */
  isEnabled(): Promise<boolean>;
}

// ==========================================
// Event Types
// ==========================================

export type MiniAppAddedEvent = {
  notificationDetails?: MiniAppNotificationDetails;
};

export type MiniAppAddRejectedEvent = {
  reason: 'invalid_domain_manifest' | 'rejected_by_user';
};

export type NotificationsEnabledEvent = {
  notificationDetails: MiniAppNotificationDetails;
};

export type MiniAppEventMap = {
  /** Primary button was clicked */
  primaryButtonClicked: () => void;

  /** Mini App was added to user's list */
  miniAppAdded: (event: MiniAppAddedEvent) => void;

  /** Mini App add was rejected */
  miniAppAddRejected: (event: MiniAppAddRejectedEvent) => void;

  /** Mini App was removed from user's list */
  miniAppRemoved: () => void;

  /** Notification permission was granted */
  notificationsEnabled: (event: NotificationsEnabledEvent) => void;

  /** Notification permission was revoked */
  notificationsDisabled: () => void;

  /** Back navigation was triggered */
  backNavigationTriggered: () => void;

  /** App state changed */
  appStateChanged: (state: AppState) => void;
};

// ==========================================
// Main SDK Interface
// ==========================================

export interface TagAIMiniAppSDK {
  /**
   * Check if running in Mini App environment
   */
  isInMiniApp(timeoutMs?: number): Promise<boolean>;

  /**
   * Get current context
   */
  readonly context: Promise<MiniAppContext>;

  /**
   * Refresh context
   */
  refreshContext(): Promise<MiniAppContext>;

  /**
   * Authentication module
   */
  auth: AuthModule;

  /**
   * Steem social module (TagAI-specific)
   */
  steem: SteemModule;

  /**
   * Wallet module (Privy BSC)
   */
  wallet: WalletModule;

  /**
   * Actions module
   */
  actions: ActionsModule;

  /**
   * Notifications module
   */
  notifications: NotificationsModule;

  /**
   * Haptics module (vibration feedback)
   */
  haptics: HapticsModule;

  /**
   * Platform module (capabilities, chains)
   */
  platform: PlatformModule;

  /**
   * Back navigation module
   */
  back: BackModule;

  /**
   * Twitter integration module (TagAI-specific)
   */
  twitter: TwitterModule;

  /**
   * Event listeners
   */
  on<K extends keyof MiniAppEventMap>(
    event: K,
    handler: MiniAppEventMap[K]
  ): void;

  off<K extends keyof MiniAppEventMap>(
    event: K,
    handler: MiniAppEventMap[K]
  ): void;

  emit<K extends keyof MiniAppEventMap>(
    event: K,
    ...args: Parameters<MiniAppEventMap[K]>
  ): void;

  removeAllListeners(): void;
}

// Re-export context types
export type { MiniAppContext, MiniAppNotificationDetails };
