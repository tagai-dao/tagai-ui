/**
 * Quick Auth Module
 * 提供便捷的认证方法，自动处理 Token 缓存和刷新
 *
 * 参考 Farcaster Quick Auth 实现
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';

export interface TokenResponse {
  token: string;
  expiresAt: number;
}

export interface QuickAuthModule {
  /**
   * 获取认证 Token
   * 自动缓存并在 15 秒刷新窗口内自动刷新
   *
   * @param forceRefresh - 强制刷新 Token（跳过缓存）
   * @returns Token 信息
   */
  getToken(forceRefresh?: boolean): Promise<TokenResponse>;

  /**
   * 便捷的 fetch 方法，自动注入 Bearer Token
   *
   * @param url - 请求 URL
   * @param options - Fetch 选项
   * @returns Fetch Response
   */
  fetch(url: string, options?: RequestInit): Promise<Response>;

  /**
   * 清除缓存的 Token
   */
  clearCache(): void;
}

/**
 * 创建 Quick Auth 模块
 */
export function createQuickAuthModule(transport: MiniAppTransport): QuickAuthModule {
  // Token 缓存
  let cachedToken: string | undefined;
  let tokenExpiresAt: number | undefined;
  let pendingTokenRequest: Promise<TokenResponse> | undefined;

  // 刷新窗口：在 Token 过期前 15 秒开始刷新
  const REFRESH_WINDOW_MS = 15000;

  /**
   * 检查缓存的 Token 是否仍然有效
   */
  function isCachedTokenValid(): boolean {
    if (!cachedToken || !tokenExpiresAt) {
      return false;
    }

    // 检查是否在刷新窗口内
    const now = Date.now();
    const timeUntilExpiry = tokenExpiresAt - now;

    return timeUntilExpiry > REFRESH_WINDOW_MS;
  }

  /**
   * 从服务器获取新的 Token
   */
  async function fetchNewToken(): Promise<TokenResponse> {
    try {
      const result = await transport.sendMessage<TokenResponse>('auth.getToken', {
        forceRefresh: true,
      });

      // 更新缓存
      cachedToken = result.token;
      tokenExpiresAt = result.expiresAt;

      return result;
    } catch (error) {
      console.error('[QuickAuth] Failed to fetch new token:', error);
      throw error;
    } finally {
      // 清除待处理请求
      pendingTokenRequest = undefined;
    }
  }

  /**
   * 获取 Token（带缓存和去重逻辑）
   */
  async function getToken(forceRefresh = false): Promise<TokenResponse> {
    // 如果强制刷新，直接获取新 Token
    if (forceRefresh) {
      cachedToken = undefined;
      tokenExpiresAt = undefined;
      pendingTokenRequest = undefined;
    }

    // 检查缓存
    if (!forceRefresh && isCachedTokenValid()) {
      return {
        token: cachedToken!,
        expiresAt: tokenExpiresAt!,
      };
    }

    // 如果已有待处理的请求，等待它完成（防止重复请求）
    if (pendingTokenRequest) {
      return pendingTokenRequest;
    }

    // 发起新请求
    pendingTokenRequest = fetchNewToken();
    return pendingTokenRequest;
  }

  /**
   * 便捷的 fetch 方法
   */
  async function quickFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // 获取 Token
    const { token } = await getToken();

    // 准备 Headers
    const headers = new Headers(options.headers);

    // 注入 Authorization header
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // 发起请求
    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * 清除缓存
   */
  function clearCache(): void {
    cachedToken = undefined;
    tokenExpiresAt = undefined;
    pendingTokenRequest = undefined;
  }

  return {
    getToken,
    fetch: quickFetch,
    clearCache,
  };
}
