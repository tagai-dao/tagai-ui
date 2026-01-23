/**
 * Authentication Module
 * Handles Privy + Twitter authentication
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { AuthModule } from '../types';
import type { Address } from 'viem';

export function createAuthModule(transport: MiniAppTransport): AuthModule {
  let currentToken: string | undefined;
  let tokenExpiresAt: number | undefined;
  let pendingTokenRequest: Promise<{ token: string; expiresAt: number }> | null = null;

  return {
    get token() {
      // Check if token is still valid (with 15s buffer)
      if (currentToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 15000) {
        return currentToken;
      }
      return undefined;
    },

    async getToken(options = {}) {
      const { forceRefresh = false } = options;

      // Return cached token if valid
      if (!forceRefresh && currentToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 15000) {
        return { token: currentToken, expiresAt: tokenExpiresAt };
      }

      // If already requesting, return pending promise
      if (pendingTokenRequest) {
        return pendingTokenRequest;
      }

      // Request new token
      pendingTokenRequest = (async () => {
        try {
          const result = await transport.sendMessage<{ token: string; expiresAt: number }>('auth.getToken', {
            forceRefresh,
          });

          currentToken = result.token;
          tokenExpiresAt = result.expiresAt;

          return result;
        } finally {
          pendingTokenRequest = null;
        }
      })();

      return pendingTokenRequest;
    },

    async signIn(options = {}) {
      const result = await transport.sendMessage<{
        ethAddress: Address;
        twitterId?: string;
        twitterUsername?: string;
        steemUsername?: string;
        displayName?: string;
        avatar?: string;
        message: string;
        signature: string;
      }>('auth.signIn', options);

      // Clear cached token as user might have changed
      currentToken = undefined;
      tokenExpiresAt = undefined;

      return result;
    },

    async fetch(url: string, options: RequestInit = {}) {
      const { token } = await this.getToken();

      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);

      return fetch(url, {
        ...options,
        headers,
      });
    },
  };
}
