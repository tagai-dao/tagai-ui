// Notification schemas for TagAI Mini Apps

export interface MiniAppNotificationDetails {
  /**
   * Webhook URL for receiving notifications
   */
  url: string;

  /**
   * Notification token
   */
  token?: string;
}
