/**
 * Authentication Module
 * Enhanced authentication with automatic nonce handling
 * Based on Farcaster Quick Auth with TagAI-specific adaptations
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { AuthModule, SignInOptions, SignInResult } from '../types';
import type { Address } from 'viem';

/**
 * Generate a random nonce for SIWE
 */
function generateNonce(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create authentication module
 */
export function createAuthModule(transport: MiniAppTransport): AuthModule {
  // Token cache
  let currentToken: string | undefined;
  let tokenExpiresAt: number | undefined;
  let pendingTokenRequest: Promise<{ token: string; expiresAt: number }> | null = null;

  // Nonce for SIWE
  let currentNonce: string | undefined;

  return {
    /**
     * Get current token (if valid)
     */
    get token() {
      // Check if token is still valid (with 15s buffer for network latency)
      if (currentToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 15000) {
        return currentToken;
      }
      return undefined;
    },

    /**
     * Get or generate JWT token
     * Implements automatic caching and concurrent request handling
     */
    async getToken(options = {}) {
      const { forceRefresh = false } = options;

      // Return cached token if valid and not forcing refresh
      if (!forceRefresh && currentToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 15000) {
        return { token: currentToken, expiresAt: tokenExpiresAt };
      }

      // If already requesting, return pending promise (dedupe concurrent requests)
      if (pendingTokenRequest) {
        return pendingTokenRequest;
      }

      // Request new token
      pendingTokenRequest = (async () => {
        try {
          const result = await transport.sendMessage<{ token: string; expiresAt: number }>(
            'auth.getToken',
            { forceRefresh }
          );

          currentToken = result.token;
          tokenExpiresAt = result.expiresAt;

          return result;
        } finally {
          pendingTokenRequest = null;
        }
      })();

      return pendingTokenRequest;
    },

    /**
     * Sign in user
     * Triggers Privy + Twitter authentication flow
     * Supports automatic nonce generation for SIWE
     */
    async signIn(options: SignInOptions = {}): Promise<SignInResult> {
      // Generate nonce if not provided
      const nonce = options.nonce || generateNonce();
      currentNonce = nonce;

      const result = await transport.sendMessage<SignInResult>('auth.signIn', {
        nonce,
        acceptAuthAddress: options.acceptAuthAddress ?? true,
      });

      // Clear cached token as user state changed
      currentToken = undefined;
      tokenExpiresAt = undefined;

      return result;
    },

    /**
     * Authenticated fetch with automatic token handling
     * Similar to Farcaster's quickAuth.fetch
     */
    async fetch(url: string, options: RequestInit = {}): Promise<Response> {
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

/**
 * SIWE (Sign In With Ethereum) message builder for TagAI
 * Adapted from EIP-4361 with Twitter identity extension
 */
export function buildSIWEMessage(params: {
  domain: string;
  address: Address;
  statement?: string;
  uri: string;
  nonce: string;
  issuedAt?: string;
  expirationTime?: string;
  chainId?: number;
  twitterId?: string;
  twitterUsername?: string;
}): string {
  const {
    domain,
    address,
    statement = 'Sign in to TagAI',
    uri,
    nonce,
    issuedAt = new Date().toISOString(),
    expirationTime,
    chainId = 56, // BSC Mainnet
    twitterId,
    twitterUsername,
  } = params;

  let message = `${domain} wants you to sign in with your Ethereum account:\n`;
  message += `${address}\n\n`;

  if (statement) {
    message += `${statement}\n\n`;
  }

  message += `URI: ${uri}\n`;
  message += `Version: 1\n`;
  message += `Chain ID: ${chainId}\n`;
  message += `Nonce: ${nonce}\n`;
  message += `Issued At: ${issuedAt}`;

  if (expirationTime) {
    message += `\nExpiration Time: ${expirationTime}`;
  }

  // TagAI-specific: Include Twitter identity
  if (twitterId) {
    message += `\nTwitter ID: ${twitterId}`;
  }

  if (twitterUsername) {
    message += `\nTwitter Username: @${twitterUsername}`;
  }

  return message;
}

/**
 * Parse SIWE message to extract components
 */
export function parseSIWEMessage(message: string): {
  domain?: string;
  address?: string;
  statement?: string;
  uri?: string;
  version?: string;
  chainId?: number;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
  twitterId?: string;
  twitterUsername?: string;
} {
  const result: Record<string, any> = {};

  // Extract domain (first line)
  const domainMatch = message.match(/^(.+) wants you to sign in/);
  if (domainMatch) {
    result.domain = domainMatch[1];
  }

  // Extract address (second line)
  const addressMatch = message.match(/Ethereum account:\n(0x[a-fA-F0-9]{40})/);
  if (addressMatch) {
    result.address = addressMatch[1];
  }

  // Extract other fields
  const fieldPatterns: Record<string, RegExp> = {
    uri: /URI: (.+)/,
    version: /Version: (\d+)/,
    chainId: /Chain ID: (\d+)/,
    nonce: /Nonce: ([a-zA-Z0-9]+)/,
    issuedAt: /Issued At: (.+)/,
    expirationTime: /Expiration Time: (.+)/,
    twitterId: /Twitter ID: (\d+)/,
    twitterUsername: /Twitter Username: @(.+)/,
  };

  for (const [field, pattern] of Object.entries(fieldPatterns)) {
    const match = message.match(pattern);
    if (match) {
      result[field] = field === 'chainId' ? parseInt(match[1], 10) : match[1];
    }
  }

  // Extract statement (everything between address and URI)
  const statementMatch = message.match(/0x[a-fA-F0-9]{40}\n\n(.+?)\n\nURI:/s);
  if (statementMatch) {
    result.statement = statementMatch[1];
  }

  return result;
}

export { generateNonce };
