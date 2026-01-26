/**
 * Notifications Module
 * Enhanced notification permission and subscription management
 * Based on Farcaster mini apps notification system
 */

import type { MiniAppNotificationDetails } from '../../../miniapp-core/src/context';

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
}

/**
 * Notification subscription status
 */
export interface NotificationSubscriptionStatus {
  subscribed: boolean;
  token?: string;
  enabled: boolean;
}

/**
 * Transport interface for sending messages to Host
 */
interface NotificationTransport {
  (method: string, params?: any): Promise<any>;
}

export class NotificationsModule {
  private sendRequest: NotificationTransport;
  private cachedToken: string | undefined;
  private cachedEnabled: boolean = false;

  constructor(sendRequest: NotificationTransport) {
    this.sendRequest = sendRequest;
  }

  /**
   * Request notification permission
   * Requests both browser permission and registers with TagAI notification service
   */
  async requestPermission(): Promise<NotificationPermissionResult> {
    // Check browser notification API support
    if (typeof window !== 'undefined' && !('Notification' in window)) {
      return { granted: false };
    }

    try {
      // Request browser permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return { granted: false };
        }
      }

      // Request permission from host and get token
      const result = await this.sendRequest('notifications.requestPermission');

      if (result.granted && result.token) {
        this.cachedToken = result.token;
        this.cachedEnabled = true;
      }

      return result;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return { granted: false };
    }
  }

  /**
   * Subscribe to notifications
   * Registers the mini app to receive push notifications
   */
  async subscribe(): Promise<string> {
    // First request permission if not already granted
    const permResult = await this.requestPermission();

    if (!permResult.granted || !permResult.token) {
      throw new Error('Notification permission denied or no token received');
    }

    // Register subscription with host
    await this.sendRequest('notifications.subscribe', {
      token: permResult.token,
    });

    this.cachedToken = permResult.token;
    this.cachedEnabled = true;

    return permResult.token;
  }

  /**
   * Unsubscribe from notifications
   * Removes the mini app from receiving push notifications
   */
  async unsubscribe(): Promise<void> {
    await this.sendRequest('notifications.unsubscribe');
    this.cachedToken = undefined;
    this.cachedEnabled = false;
  }

  /**
   * Check if notifications are enabled
   */
  async isEnabled(): Promise<boolean> {
    // Check browser permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        return false;
      }
    }

    // Check with host
    try {
      const result = await this.sendRequest('notifications.isEnabled');
      this.cachedEnabled = result.enabled;
      return result.enabled;
    } catch {
      return this.cachedEnabled;
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<NotificationSubscriptionStatus> {
    try {
      const result = await this.sendRequest('notifications.getStatus');
      this.cachedToken = result.token;
      this.cachedEnabled = result.enabled;
      return result;
    } catch {
      return {
        subscribed: !!this.cachedToken,
        token: this.cachedToken,
        enabled: this.cachedEnabled,
      };
    }
  }

  /**
   * Get cached notification token
   */
  get token(): string | undefined {
    return this.cachedToken;
  }

  /**
   * Show a local notification (for testing or immediate feedback)
   */
  async showLocalNotification(
    title: string,
    body: string,
    options?: {
      icon?: string;
      badge?: string;
      tag?: string;
      data?: any;
      onClick?: () => void;
    }
  ): Promise<Notification | null> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notifications not supported in this environment');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    const notification = new Notification(title, {
      body,
      icon: options?.icon || '/icon.png',
      badge: options?.badge || '/badge.png',
      tag: options?.tag,
      data: options?.data,
    });

    if (options?.onClick) {
      notification.onclick = options.onClick;
    }

    return notification;
  }
}

/**
 * Notification event types for webhook handling
 */
export type NotificationWebhookEvent =
  | {
      event: 'miniapp_added';
      twitterId: string;
      notificationDetails: MiniAppNotificationDetails;
    }
  | {
      event: 'miniapp_removed';
      twitterId: string;
    }
  | {
      event: 'notifications_enabled';
      twitterId: string;
      notificationDetails: MiniAppNotificationDetails;
    }
  | {
      event: 'notifications_disabled';
      twitterId: string;
    };

/**
 * Notification send request
 */
export interface SendNotificationRequest {
  /** Unique notification ID for idempotency */
  notificationId: string;
  /** Notification title (max 32 chars) */
  title: string;
  /** Notification body (max 128 chars) */
  body: string;
  /** Target URL when notification is clicked (must be same domain) */
  targetUrl: string;
  /** Twitter IDs to send to */
  twitterIds: string[];
}

/**
 * Notification send response
 */
export interface SendNotificationResponse {
  /** Number of notifications successfully sent */
  sent: number;
  /** Failed delivery details */
  failed?: Array<{
    twitterId: string;
    reason: string;
  }>;
}

export { NotificationSubscriptionStatus as SubscriptionStatus };
