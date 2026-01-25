/**
 * Notifications Module
 * 通知权限和订阅管理
 */

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
}

export class NotificationsModule {
  private sendRequest: (method: string, params?: any) => Promise<any>;

  constructor(sendRequest: (method: string, params?: any) => Promise<any>) {
    this.sendRequest = sendRequest;
  }

  /**
   * Request notification permission
   * 请求通知权限
   */
  async requestPermission(): Promise<NotificationPermissionResult> {
    // 检查浏览器通知 API 支持
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    // 请求权限
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      return { granted: false };
    }

    // 生成通知 Token（在实际实现中，这应该与 Push 服务集成）
    const token = await this.generateNotificationToken();

    return {
      granted: true,
      token
    };
  }

  /**
   * Subscribe to notifications
   * 订阅通知
   */
  async subscribe(): Promise<string> {
    const result = await this.requestPermission();

    if (!result.granted || !result.token) {
      throw new Error('Notification permission denied');
    }

    // 通知宿主环境保存 token
    await this.sendRequest('notifications.subscribe', {
      token: result.token
    });

    return result.token;
  }

  /**
   * Unsubscribe from notifications
   * 取消订阅通知
   */
  async unsubscribe(): Promise<void> {
    await this.sendRequest('notifications.unsubscribe');
  }

  /**
   * Check if notifications are enabled
   * 检查通知是否已启用
   */
  async isEnabled(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    return Notification.permission === 'granted';
  }

  /**
   * Generate notification token
   * 生成通知 Token
   *
   * 注意：这是一个简化实现
   * 实际生产环境应该使用 Firebase Cloud Messaging, Web Push 等服务
   */
  private async generateNotificationToken(): Promise<string> {
    // 简化实现：生成一个随机 token
    // 在实际应用中，应该注册 Service Worker 并获取 Push 订阅
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Show a local notification (for testing)
   * 显示本地通知（用于测试）
   */
  async showTestNotification(title: string, body: string): Promise<void> {
    const isEnabled = await this.isEnabled();

    if (!isEnabled) {
      throw new Error('Notifications are not enabled');
    }

    new Notification(title, {
      body,
      icon: '/icon.png', // 应用图标
      badge: '/badge.png', // 徽章图标
    });
  }
}
