/**
 * TagAI Mini App SDK Types
 */

import type { MiniAppContext } from '../../miniapp-core/src/context';
import type { WalletClient, Hash, Address } from 'viem';

// ==========================================
// Auth Module Types
// ==========================================

export interface AuthModule {
  /**
   * Get current JWT token (if available)
   */
  readonly token: string | undefined;

  /**
   * Get or generate JWT token
   */
  getToken(options?: {
    forceRefresh?: boolean;
  }): Promise<{ token: string; expiresAt: number }>;

  /**
   * Sign in user (triggers Privy + Twitter auth)
   */
  signIn(options?: {
    nonce?: string;
  }): Promise<{
    ethAddress: Address;
    twitterId?: string;
    twitterUsername?: string;
    steemUsername?: string;
    message: string;
    signature: string;
  }>;

  /**
   * Authenticated fetch (automatically adds Bearer token)
   */
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

// ==========================================
// Steem Module Types
// ==========================================

export interface SteemPostOptions {
  title: string;
  body: string;
  tags?: string[];
  jsonMetadata?: Record<string, any>;
  beneficiaries?: Array<{
    account: string;
    weight: number;
  }>;
}

export interface SteemPostResult {
  author: string;
  permlink: string;
  url: string;
}

export interface SteemCommentOptions {
  parentAuthor: string;
  parentPermlink: string;
  body: string;
  jsonMetadata?: Record<string, any>;
}

export interface SteemModule {
  /**
   * Create a post on Steem
   */
  post(options: SteemPostOptions): Promise<SteemPostResult>;

  /**
   * Vote on a post/comment
   */
  vote(author: string, permlink: string, weight: number): Promise<void>;

  /**
   * Comment on a post
   */
  comment(options: SteemCommentOptions): Promise<SteemPostResult>;

  /**
   * Reblog a post
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
}

export interface ComposeResult {
  posted: boolean;
  permlink?: string;
  author?: string;
}

export interface SetPrimaryButtonOptions {
  text: string;
  enabled?: boolean;
  loading?: boolean;
}

export interface ActionsModule {
  /**
   * Signal that Mini App is ready to be displayed
   */
  ready(options?: {
    splashDuration?: number;
    disableNativeGestures?: boolean;
  }): Promise<void>;

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
}

// ==========================================
// Event Types
// ==========================================

export type MiniAppEventMap = {
  /** Primary button was clicked */
  primaryButtonClicked: () => void;

  /** Mini App was added to user's list */
  miniAppAdded: () => void;

  /** Mini App was removed from user's list */
  miniAppRemoved: () => void;

  /** Notification permission was granted */
  notificationsEnabled: () => void;

  /** Notification permission was revoked */
  notificationsDisabled: () => void;

  /** Back navigation was triggered */
  backNavigationTriggered: () => void;
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
   * Steem social module
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
