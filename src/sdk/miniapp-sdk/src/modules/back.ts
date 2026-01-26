/**
 * Back Navigation Module
 * Handles back navigation and history management
 * Based on Farcaster mini apps back navigation system
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { EventEmitter } from '../utils/event-emitter';
import type { MiniAppEventMap } from '../types';

/**
 * Back state options
 */
export interface BackState {
  /**
   * Whether back navigation should be enabled
   */
  enabled: boolean;

  /**
   * Custom handler for back navigation
   * If provided, this will be called instead of default browser back
   */
  handler?: () => void | Promise<void>;
}

/**
 * Back module interface
 */
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

/**
 * Create back module
 */
export function createBackModule(
  transport: MiniAppTransport,
  emitter: EventEmitter<MiniAppEventMap>
): BackModule {
  let currentState: BackState = { enabled: false };
  let customHandler: (() => void | Promise<void>) | undefined;

  // Listen for back navigation events from host
  emitter.on('backNavigationTriggered', async () => {
    if (customHandler) {
      await customHandler();
    } else {
      // Default behavior: browser back
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      }
    }
  });

  return {
    async updateState(state: BackState): Promise<void> {
      currentState = state;
      customHandler = state.handler;

      // Notify host about back state change
      await transport.sendMessage('back.updateState', {
        enabled: state.enabled,
      });
    },

    async enable(handler?: () => void | Promise<void>): Promise<void> {
      await this.updateState({
        enabled: true,
        handler,
      });
    },

    async disable(): Promise<void> {
      await this.updateState({
        enabled: false,
      });
    },

    async goBack(): Promise<void> {
      if (customHandler) {
        await customHandler();
      } else {
        // Trigger host back navigation
        try {
          await transport.sendMessage('back.goBack');
        } catch {
          // Fallback to browser back
          if (typeof window !== 'undefined' && window.history.length > 1) {
            window.history.back();
          }
        }
      }
    },

    isEnabled(): boolean {
      return currentState.enabled;
    },
  };
}

export type { BackState };
