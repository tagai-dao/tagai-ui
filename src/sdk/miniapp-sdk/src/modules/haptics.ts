/**
 * Haptics Module
 * Provides vibration feedback for native-like user experience
 * Based on Farcaster mini apps haptics implementation
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';

/**
 * Haptic feedback styles for impact feedback
 */
export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

/**
 * Notification types for notification feedback
 */
export type NotificationType = 'success' | 'warning' | 'error';

/**
 * Haptics module interface
 */
export interface HapticsModule {
  /**
   * Trigger impact feedback
   * Used for button taps, drag gestures, and similar interactions
   */
  impactOccurred: (style?: ImpactStyle) => Promise<void>;

  /**
   * Trigger notification feedback
   * Used for success, warning, or error notifications
   */
  notificationOccurred: (type: NotificationType) => Promise<void>;

  /**
   * Trigger selection change feedback
   * Used for picker changes and similar selections
   */
  selectionChanged: () => Promise<void>;
}

/**
 * Vibration patterns for different haptic styles (in milliseconds)
 */
const VIBRATION_PATTERNS: Record<ImpactStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  soft: [5, 5, 5],
  rigid: [15, 5, 15],
};

/**
 * Vibration patterns for notification types
 */
const NOTIFICATION_PATTERNS: Record<NotificationType, number | number[]> = {
  success: [10, 50, 10],
  warning: [20, 50, 20, 50, 20],
  error: [30, 50, 30, 50, 30],
};

/**
 * Create haptics module
 */
export function createHapticsModule(transport: MiniAppTransport): HapticsModule {
  /**
   * Check if vibration API is supported
   */
  const isVibrationSupported = (): boolean => {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  };

  /**
   * Trigger local vibration (Web Vibration API fallback)
   */
  const triggerLocalVibration = (pattern: number | number[]): void => {
    if (isVibrationSupported()) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Silently fail if vibration is not allowed
      }
    }
  };

  return {
    async impactOccurred(style: ImpactStyle = 'medium'): Promise<void> {
      try {
        // Send to host for native haptics
        await transport.sendMessage('haptics.impactOccurred', { style });
      } catch {
        // Fallback to local vibration
        const pattern = VIBRATION_PATTERNS[style] || VIBRATION_PATTERNS.medium;
        triggerLocalVibration(pattern);
      }
    },

    async notificationOccurred(type: NotificationType): Promise<void> {
      try {
        // Send to host for native haptics
        await transport.sendMessage('haptics.notificationOccurred', { type });
      } catch {
        // Fallback to local vibration
        const pattern = NOTIFICATION_PATTERNS[type] || NOTIFICATION_PATTERNS.success;
        triggerLocalVibration(pattern);
      }
    },

    async selectionChanged(): Promise<void> {
      try {
        // Send to host for native haptics
        await transport.sendMessage('haptics.selectionChanged');
      } catch {
        // Fallback to local vibration
        triggerLocalVibration(5);
      }
    },
  };
}

export type { ImpactStyle, NotificationType };
