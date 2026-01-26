/**
 * Platform Module
 * Provides platform-specific features and capabilities detection
 * Based on Farcaster mini apps capabilities system
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { EventEmitter } from '../utils/event-emitter';
import type { MiniAppEventMap } from '../types';

/**
 * Supported capability identifiers
 * Similar to Farcaster's miniAppHostCapabilityList
 */
export const TAGAI_CAPABILITIES = [
  // Wallet capabilities
  'wallet.getProvider',
  'wallet.sendTransaction',
  'wallet.signMessage',
  'wallet.getBalance',

  // Action capabilities
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

  // DeFi capabilities
  'actions.swapToken',
  'actions.sendToken',
  'actions.viewToken',
  'actions.openMiniApp',

  // Auth capabilities
  'auth.getToken',
  'auth.signIn',

  // Steem capabilities
  'steem.post',
  'steem.vote',
  'steem.comment',
  'steem.reblog',

  // Haptics capabilities
  'haptics.impactOccurred',
  'haptics.notificationOccurred',
  'haptics.selectionChanged',

  // Notifications capabilities
  'notifications.requestPermission',
  'notifications.subscribe',
  'notifications.unsubscribe',

  // Back navigation
  'back',

  // Twitter integration
  'twitter.post',
  'twitter.share',
] as const;

export type TagAICapability = (typeof TAGAI_CAPABILITIES)[number];

/**
 * Supported chains (CAIP-2 format)
 */
export const SUPPORTED_CHAINS = [
  'eip155:56',   // BSC Mainnet
  'eip155:97',   // BSC Testnet
  'eip155:1',    // Ethereum Mainnet (read-only)
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

/**
 * App state types
 */
export type AppState = 'active' | 'inactive' | 'background';

/**
 * Platform module interface
 */
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

/**
 * SDK Version
 */
const SDK_VERSION = '1.0.0';

/**
 * Create platform module
 */
export function createPlatformModule(
  transport: MiniAppTransport,
  emitter: EventEmitter<MiniAppEventMap>
): PlatformModule {
  // Cache for capabilities
  let cachedCapabilities: TagAICapability[] | null = null;
  let cachedChains: string[] | null = null;

  // App state listeners
  const appStateListeners: Array<(state: AppState) => void> = [];

  // Setup app state listener
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      const state: AppState = document.hidden ? 'background' : 'active';
      appStateListeners.forEach(cb => cb(state));
    });
  }

  return {
    async getCapabilities(): Promise<TagAICapability[]> {
      if (cachedCapabilities) {
        return cachedCapabilities;
      }

      try {
        // Request capabilities from host
        const capabilities = await transport.sendMessage<TagAICapability[]>(
          'platform.getCapabilities'
        );
        cachedCapabilities = capabilities;
        return capabilities;
      } catch {
        // Return default capabilities on error
        return [...TAGAI_CAPABILITIES];
      }
    },

    async hasCapability(capability: TagAICapability): Promise<boolean> {
      const capabilities = await this.getCapabilities();
      return capabilities.includes(capability);
    },

    async getChains(): Promise<string[]> {
      if (cachedChains) {
        return cachedChains;
      }

      try {
        // Request chains from host
        const chains = await transport.sendMessage<string[]>('platform.getChains');
        cachedChains = chains;
        return chains;
      } catch {
        // Return default chains on error
        return [...SUPPORTED_CHAINS];
      }
    },

    async isChainSupported(chainId: string): Promise<boolean> {
      const chains = await this.getChains();
      return chains.includes(chainId);
    },

    async getPlatformType(): Promise<'web' | 'mobile' | 'desktop'> {
      try {
        return await transport.sendMessage<'web' | 'mobile' | 'desktop'>(
          'platform.getPlatformType'
        );
      } catch {
        // Detect platform type
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
    },

    getVersion(): string {
      return SDK_VERSION;
    },

    isDevelopment(): boolean {
      if (typeof window === 'undefined') {
        return false;
      }

      // Check for development indicators
      return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.port === '3000' ||
        window.location.port === '5173' ||
        window.location.search.includes('debug=true')
      );
    },

    onAppStateChange(callback: (state: AppState) => void): () => void {
      appStateListeners.push(callback);

      // Return unsubscribe function
      return () => {
        const index = appStateListeners.indexOf(callback);
        if (index > -1) {
          appStateListeners.splice(index, 1);
        }
      };
    },
  };
}

export type { AppState, TagAICapability, SupportedChain };
