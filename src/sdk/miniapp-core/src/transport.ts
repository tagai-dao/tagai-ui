/**
 * TagAI Mini App Transport Layer
 * 通信层：处理 iframe 与宿主应用之间的 postMessage 通信
 */

import type { MiniAppMessage, MiniAppResponse } from './types';

export class MiniAppTransport {
  private pendingRequests = new Map<string, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private messageIdCounter = 0;
  private targetOrigin: string = '*'; // 生产环境应该设置具体的域名

  constructor() {
    this.setupMessageListener();
  }

  /**
   * 设置目标源（安全性考虑）
   */
  setTargetOrigin(origin: string) {
    this.targetOrigin = origin;
  }

  /**
   * 发送消息到宿主应用
   */
  async sendMessage<T = any>(method: string, params?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateMessageId();
      const message: MiniAppMessage = {
        id,
        method,
        params,
      };

      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000); // 30 秒超时

      // 保存待处理的请求
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });

      // 发送消息
      this.postMessageToParent(message);
    });
  }

  /**
   * 发送消息到父窗口
   */
  private postMessageToParent(message: MiniAppMessage) {
    if (typeof window === 'undefined') {
      throw new Error('Window is not defined (SSR environment)');
    }

    // 检测环境：iframe 或 React Native WebView
    if (window.parent && window.parent !== window) {
      // iframe 环境
      window.parent.postMessage(
        { type: 'tagai:miniapp', message },
        this.targetOrigin
      );
    } else if ((window as any).ReactNativeWebView) {
      // React Native WebView 环境
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'tagai:miniapp', message })
      );
    } else {
      throw new Error('Not in a Mini App environment');
    }
  }

  /**
   * 设置消息监听
   */
  private setupMessageListener() {
    if (typeof window === 'undefined') return;

    // iframe 环境
    window.addEventListener('message', this.handleMessage);

    // React Native WebView 环境
    if (typeof document !== 'undefined') {
      document.addEventListener('TagAIMiniAppEvent', (event: any) => {
        if (event instanceof MessageEvent) {
          this.handleMessage(event);
        }
      });
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage = (event: MessageEvent) => {
    // 验证消息来源（生产环境应该更严格）
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
      return;
    }

    let data = event.data;

    // 处理 React Native WebView 的字符串消息
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }

    // 验证消息格式
    if (!data || data.type !== 'tagai:miniapp:response') {
      return;
    }

    const response: MiniAppResponse = data.response;
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      return;
    }

    // 清除超时
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    // 处理响应
    if (response.error) {
      pending.reject(
        new Error(response.error.message || 'Unknown error')
      );
    } else {
      pending.resolve(response.result);
    }
  };

  /**
   * 生成唯一的消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * 清理资源
   */
  destroy() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('message', this.handleMessage);

    // 清除所有待处理的请求
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport destroyed'));
    }
    this.pendingRequests.clear();
  }
}

// 单例实例
export const transport = new MiniAppTransport();
