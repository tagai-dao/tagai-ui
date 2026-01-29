/**
 * TagAI Mini App SDK
 * Main entry point
 *
 * Based on Farcaster mini apps SDK with TagAI-specific extensions:
 * - Twitter authentication (vs Farcaster FID)
 * - Privy wallet (vs Farcaster wallet)
 * - Steem integration (unique to TagAI)
 * - Twitter cross-posting (unique to TagAI)
 */

import { transport } from '../../miniapp-core/src/transport';
import { getContext, isInMiniApp, refreshContext } from '../../miniapp-core/src/context';
import type { MiniAppContext } from '../../miniapp-core/src/context';
import { createAuthModule } from './modules/auth';
import { createQuickAuthModule } from './modules/quick-auth';
import { createSteemModule } from './modules/steem';
import { createWalletModule } from './modules/wallet';
import { createActionsModule } from './modules/actions';
import { NotificationsModule } from './modules/notifications';
import { createHapticsModule } from './modules/haptics';
import { createPlatformModule } from './modules/platform';
import { createBackModule } from './modules/back';
import { createTwitterModule } from './modules/twitter';
import { EventEmitter } from './utils/event-emitter';
import type {
  TagAIMiniAppSDK,
  MiniAppEventMap,
  MiniAppAddedEvent,
  MiniAppAddRejectedEvent,
  NotificationsEnabledEvent,
  AppState,
} from './types';

// Create event emitter
const emitter = new EventEmitter<MiniAppEventMap>();

// Create modules
const authModule = createAuthModule(transport);
const quickAuthModule = createQuickAuthModule(transport);
const steemModule = createSteemModule(transport);
const walletModule = createWalletModule(transport);
const actionsModule = createActionsModule(transport, emitter);
const notificationsModule = new NotificationsModule(transport.sendMessage.bind(transport));
const hapticsModule = createHapticsModule(transport);
const platformModule = createPlatformModule(transport, emitter);
const backModule = createBackModule(transport, emitter);
const twitterModule = createTwitterModule(transport);

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

  /**
   * Quick Auth - 便捷的认证方法
   * 自动处理 Token 缓存和刷新，提供便捷的 fetch 方法
   */
  quickAuth: quickAuthModule,

  // ==========================================
  // Steem Social (TagAI-specific)
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
  // Notifications
  // ==========================================

  notifications: notificationsModule,

  // ==========================================
  // Haptics (Vibration Feedback)
  // ==========================================

  haptics: hapticsModule,

  // ==========================================
  // Platform (Capabilities, Chains)
  // ==========================================

  platform: platformModule,

  // ==========================================
  // Back Navigation
  // ==========================================

  back: backModule,

  // ==========================================
  // Twitter Integration (TagAI-specific)
  // ==========================================

  twitter: twitterModule,

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

// ==========================================
// Event Handlers Setup
// ==========================================

// Setup event listeners from window messages
if (typeof window !== 'undefined') {
  // Listen for events from host (iframe environment)
  window.addEventListener('message', (event) => {
    // Handle TagAI mini app events
    if (event.data?.type === 'tagai:miniapp:event') {
      const { eventName, data } = event.data;
      handleMiniAppEvent(eventName, data);
    }

    // Handle Farcaster-style frame events (for compatibility)
    if (event.data?.type === 'frameEvent') {
      const miniAppEvent = event.data.event;
      handleClientEvent(miniAppEvent);
    }
  });
}

// React Native WebView events
if (typeof document !== 'undefined') {
  document.addEventListener('TagAIMiniAppEvent', (event: any) => {
    if (event instanceof MessageEvent) {
      const { eventName, data } = event.data;
      handleMiniAppEvent(eventName, data);
    }
  });

  // Farcaster-style events for compatibility
  document.addEventListener('FarcasterFrameEvent', (event: any) => {
    if (event instanceof MessageEvent) {
      handleClientEvent(event.data);
    }
  });
}

/**
 * Handle TagAI mini app events
 */
function handleMiniAppEvent(eventName: string, data: any) {
  switch (eventName) {
    case 'primaryButtonClicked':
      emitter.emit('primaryButtonClicked');
      break;
    case 'miniAppAdded':
      emitter.emit('miniAppAdded', data as MiniAppAddedEvent);
      break;
    case 'miniAppAddRejected':
      emitter.emit('miniAppAddRejected', data as MiniAppAddRejectedEvent);
      break;
    case 'miniAppRemoved':
      emitter.emit('miniAppRemoved');
      break;
    case 'notificationsEnabled':
      emitter.emit('notificationsEnabled', data as NotificationsEnabledEvent);
      break;
    case 'notificationsDisabled':
      emitter.emit('notificationsDisabled');
      break;
    case 'backNavigationTriggered':
      emitter.emit('backNavigationTriggered');
      break;
    case 'appStateChanged':
      emitter.emit('appStateChanged', data as AppState);
      break;
  }
}

/**
 * Handle Farcaster-style client events (for compatibility)
 */
function handleClientEvent(miniAppEvent: any) {
  if (!miniAppEvent?.event) return;

  switch (miniAppEvent.event) {
    case 'primary_button_clicked':
      emitter.emit('primaryButtonClicked');
      break;
    case 'miniapp_added':
      emitter.emit('miniAppAdded', {
        notificationDetails: miniAppEvent.notificationDetails,
      });
      break;
    case 'miniapp_add_rejected':
      emitter.emit('miniAppAddRejected', { reason: miniAppEvent.reason });
      break;
    case 'miniapp_removed':
      emitter.emit('miniAppRemoved');
      break;
    case 'notifications_enabled':
      emitter.emit('notificationsEnabled', {
        notificationDetails: miniAppEvent.notificationDetails,
      });
      break;
    case 'notifications_disabled':
      emitter.emit('notificationsDisabled');
      break;
    case 'back_navigation_triggered':
      emitter.emit('backNavigationTriggered');
      break;
  }
}

// Export types
export type { TagAIMiniAppSDK, MiniAppContext };
export * from './types';
export * from '../../miniapp-core/src/context';

// Export modules for advanced usage
export { createAuthModule } from './modules/auth';
export { createSteemModule } from './modules/steem';
export { createWalletModule } from './modules/wallet';
export { createActionsModule } from './modules/actions';
export { createHapticsModule } from './modules/haptics';
export { createPlatformModule } from './modules/platform';
export { createBackModule } from './modules/back';
export { createTwitterModule } from './modules/twitter';
export { NotificationsModule } from './modules/notifications';

// Default export
export default sdk;
