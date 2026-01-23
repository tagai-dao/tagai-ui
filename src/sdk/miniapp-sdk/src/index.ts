/**
 * TagAI Mini App SDK
 * Main entry point
 */

import { transport } from '../../miniapp-core/src/transport';
import { getContext, isInMiniApp, refreshContext } from '../../miniapp-core/src/context';
import type { MiniAppContext } from '../../miniapp-core/src/context';
import { createAuthModule } from './modules/auth';
import { createSteemModule } from './modules/steem';
import { createWalletModule } from './modules/wallet';
import { createActionsModule } from './modules/actions';
import { EventEmitter } from './utils/event-emitter';
import type { TagAIMiniAppSDK, MiniAppEventMap } from './types';

// Create event emitter
const emitter = new EventEmitter<MiniAppEventMap>();

// Create modules
const authModule = createAuthModule(transport);
const steemModule = createSteemModule(transport);
const walletModule = createWalletModule(transport);
const actionsModule = createActionsModule(transport, emitter);

/**
 * Main SDK object
 */
export const sdk: TagAIMiniAppSDK = {
  // ==========================================
  // Core
  // ==========================================

  /**
   * Check if running in TagAI Mini App
   */
  isInMiniApp,

  /**
   * Get current context (user, app, location)
   */
  get context(): Promise<MiniAppContext> {
    return getContext();
  },

  /**
   * Refresh context
   */
  refreshContext,

  // ==========================================
  // Authentication
  // ==========================================

  auth: authModule,

  // ==========================================
  // Steem Social
  // ==========================================

  steem: steemModule,

  // ==========================================
  // Wallet (Privy BSC)
  // ==========================================

  wallet: walletModule,

  // ==========================================
  // Actions
  // ==========================================

  actions: actionsModule,

  // ==========================================
  // Events
  // ==========================================

  /**
   * Listen to events
   */
  on: emitter.on.bind(emitter),

  /**
   * Remove event listener
   */
  off: emitter.off.bind(emitter),

  /**
   * Emit event (for testing)
   */
  emit: emitter.emit.bind(emitter),

  /**
   * Remove all listeners
   */
  removeAllListeners: emitter.removeAllListeners.bind(emitter),
};

// Setup event listeners from window messages
if (typeof window !== 'undefined') {
  // Listen for events from host
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'tagai:miniapp:event') {
      const { eventName, data } = event.data;
      emitter.emit(eventName, data);
    }
  });

  // React Native WebView events
  if (typeof document !== 'undefined') {
    document.addEventListener('TagAIMiniAppEvent', (event: any) => {
      if (event instanceof MessageEvent) {
        const { eventName, data } = event.data;
        emitter.emit(eventName, data);
      }
    });
  }
}

// Export types
export type { TagAIMiniAppSDK, MiniAppContext };
export * from './types';
export * from '../../miniapp-core/src/context';

// Default export
export default sdk;
