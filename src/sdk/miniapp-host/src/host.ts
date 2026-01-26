/**
 * TagAI Mini App Host
 * Host-side implementation for handling Mini App messages
 */

import type {
  MiniAppMessage,
  MiniAppResponse,
  MiniAppHandler,
  MiniAppHandlers,
  HostContext,
  Capability,
} from './types';
import type { MiniAppContext } from '../../miniapp-core/src/context';

// Default capabilities supported by TagAI
const DEFAULT_CAPABILITIES: Capability[] = [
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

// Default supported chains (CAIP-2 format)
const DEFAULT_CHAINS = [
  'eip155:56',   // BSC Mainnet
  'eip155:97',   // BSC Testnet
];

export interface MiniAppHostOptions {
  /** The iframe element containing the Mini App */
  iframe: HTMLIFrameElement;
  /** Target origin for postMessage security */
  targetOrigin?: string;
  /** Mini App context */
  context: MiniAppContext;
  /** Mini App domain */
  domain: string;
  /** Mini App URL */
  url: string;
  /** Callback when Mini App is closed */
  onClose?: () => void;
  /** Callback when primary button is clicked */
  onPrimaryButtonClick?: () => void;
  /** Custom handlers */
  handlers?: Partial<MiniAppHandlers>;
  /** Supported capabilities */
  capabilities?: Capability[];
  /** Supported chains */
  chains?: string[];
}

/**
 * Create Mini App Host
 */
export function createMiniAppHost(options: MiniAppHostOptions) {
  const {
    iframe,
    targetOrigin = '*',
    context,
    domain,
    url,
    onClose,
    onPrimaryButtonClick,
    handlers = {},
    capabilities = DEFAULT_CAPABILITIES,
    chains = DEFAULT_CHAINS,
  } = options;

  // Handler registry
  const handlerRegistry = new Map<string, MiniAppHandler>();

  // Host context for handlers
  const hostContext: HostContext = {
    miniAppContext: context,
    domain,
    url,
    twitterId: context.user.twitterId || '',
    ethAddress: (context.user.ethAddr || '0x0') as `0x${string}`,
    sendEvent: (eventName: string, data?: any) => {
      sendEventToMiniApp(eventName, data);
    },
    closeMiniApp: () => {
      onClose?.();
    },
  };

  /**
   * Send response to Mini App
   */
  function sendResponse(response: MiniAppResponse) {
    if (!iframe.contentWindow) {
      console.error('Mini App iframe not available');
      return;
    }

    iframe.contentWindow.postMessage(
      {
        type: 'tagai:miniapp:response',
        response,
      },
      targetOrigin
    );
  }

  /**
   * Send event to Mini App
   */
  function sendEventToMiniApp(eventName: string, data?: any) {
    if (!iframe.contentWindow) {
      console.error('Mini App iframe not available');
      return;
    }

    iframe.contentWindow.postMessage(
      {
        type: 'tagai:miniapp:event',
        eventName,
        data,
      },
      targetOrigin
    );
  }

  /**
   * Handle incoming message from Mini App
   */
  async function handleMessage(event: MessageEvent) {
    // Verify origin if specified
    if (targetOrigin !== '*' && event.origin !== targetOrigin) {
      return;
    }

    // Verify message format
    const data = event.data;
    if (!data || data.type !== 'tagai:miniapp') {
      return;
    }

    const message: MiniAppMessage = data.message;
    if (!message || !message.id || !message.method) {
      return;
    }

    try {
      // Find handler
      const handler = handlerRegistry.get(message.method) || handlers[message.method as keyof MiniAppHandlers];

      if (!handler) {
        sendResponse({
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          },
        });
        return;
      }

      // Execute handler
      const result = await handler(message.params, hostContext);

      // Send success response
      sendResponse({
        id: message.id,
        result,
      });
    } catch (error: any) {
      // Send error response
      sendResponse({
        id: message.id,
        error: {
          code: error.code || -32000,
          message: error.message || 'Internal error',
        },
      });
    }
  }

  /**
   * Register handler
   */
  function registerHandler<T extends keyof MiniAppHandlers>(
    method: T,
    handler: MiniAppHandlers[T]
  ) {
    handlerRegistry.set(method, handler as MiniAppHandler);
  }

  /**
   * Register default handlers
   */
  function registerDefaultHandlers() {
    // Context
    registerHandler('getContext', () => context);

    // Platform
    registerHandler('platform.getCapabilities', () => capabilities);
    registerHandler('platform.getChains', () => chains);
    registerHandler('platform.getPlatformType', () => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
        return 'mobile';
      }
      return 'web';
    });

    // Actions - Basic
    registerHandler('actions.ready', async (params) => {
      // Hide splash screen after duration
      if (params?.splashDuration) {
        await new Promise(resolve => setTimeout(resolve, params.splashDuration));
      }
    });

    registerHandler('actions.close', () => {
      onClose?.();
    });

    // Notifications - Basic implementation
    registerHandler('notifications.isEnabled', () => ({
      enabled: 'Notification' in window && Notification.permission === 'granted',
    }));

    // Haptics - Web Vibration API fallback
    registerHandler('haptics.impactOccurred', (params) => {
      if ('vibrate' in navigator) {
        const patterns: Record<string, number> = {
          light: 10,
          medium: 20,
          heavy: 40,
          soft: 5,
          rigid: 15,
        };
        navigator.vibrate(patterns[params?.style || 'medium'] || 20);
      }
    });

    registerHandler('haptics.notificationOccurred', (params) => {
      if ('vibrate' in navigator) {
        const patterns: Record<string, number[]> = {
          success: [10, 50, 10],
          warning: [20, 50, 20, 50, 20],
          error: [30, 50, 30, 50, 30],
        };
        navigator.vibrate(patterns[params?.type || 'success'] || [10, 50, 10]);
      }
    });

    registerHandler('haptics.selectionChanged', () => {
      if ('vibrate' in navigator) {
        navigator.vibrate(5);
      }
    });

    // Back Navigation
    registerHandler('back.updateState', (params) => {
      // Store back state - implementation depends on host UI
    });

    registerHandler('back.goBack', () => {
      if (window.history.length > 1) {
        window.history.back();
      }
    });
  }

  /**
   * Start listening for messages
   */
  function start() {
    registerDefaultHandlers();
    window.addEventListener('message', handleMessage);
  }

  /**
   * Stop listening and cleanup
   */
  function stop() {
    window.removeEventListener('message', handleMessage);
    handlerRegistry.clear();
  }

  /**
   * Emit event to Mini App
   */
  function emit(eventName: string, data?: any) {
    sendEventToMiniApp(eventName, data);
  }

  /**
   * Emit primary button clicked event
   */
  function emitPrimaryButtonClick() {
    sendEventToMiniApp('primaryButtonClicked');
    onPrimaryButtonClick?.();
  }

  /**
   * Emit mini app added event
   */
  function emitMiniAppAdded(notificationDetails?: any) {
    sendEventToMiniApp('miniAppAdded', { notificationDetails });
  }

  /**
   * Emit mini app removed event
   */
  function emitMiniAppRemoved() {
    sendEventToMiniApp('miniAppRemoved');
  }

  /**
   * Emit notifications enabled event
   */
  function emitNotificationsEnabled(notificationDetails: any) {
    sendEventToMiniApp('notificationsEnabled', { notificationDetails });
  }

  /**
   * Emit notifications disabled event
   */
  function emitNotificationsDisabled() {
    sendEventToMiniApp('notificationsDisabled');
  }

  /**
   * Emit back navigation triggered event
   */
  function emitBackNavigationTriggered() {
    sendEventToMiniApp('backNavigationTriggered');
  }

  return {
    start,
    stop,
    registerHandler,
    emit,
    emitPrimaryButtonClick,
    emitMiniAppAdded,
    emitMiniAppRemoved,
    emitNotificationsEnabled,
    emitNotificationsDisabled,
    emitBackNavigationTriggered,
    hostContext,
  };
}

export type MiniAppHost = ReturnType<typeof createMiniAppHost>;
