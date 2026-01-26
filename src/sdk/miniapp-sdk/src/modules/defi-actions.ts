/**
 * DeFi Actions Module
 * Implements swapToken, sendToken, viewToken functionality
 */

import type {
  SwapTokenOptions,
  SwapTokenResult,
  SendTokenOptions,
  SendTokenResult,
  ViewTokenOptions,
} from '../types';
import { isAddress, getAddress } from 'viem';

// ==========================================
// CAIP-19 Utilities (inline to avoid external dependencies)
// ==========================================

interface ParsedAsset {
  chainId: number;
  namespace: 'erc20' | 'native';
  address?: `0x${string}`;
}

/**
 * Parse CAIP-19 asset identifier
 * Format: eip155:<chainId>/<namespace>(:<address>)?
 */
function parseCAIP19(assetId: string): ParsedAsset {
  const match = assetId.match(/^eip155:(\d+)\/(erc20|native)(?::(.+))?$/);

  if (!match) {
    throw new Error(`Invalid CAIP-19 format: ${assetId}. Expected format: eip155:<chainId>/<namespace>(:<address>)?`);
  }

  const [, chainIdStr, namespace, address] = match;
  const chainId = parseInt(chainIdStr, 10);

  if (namespace === 'erc20') {
    if (!address) {
      throw new Error(`ERC20 asset must include address: ${assetId}`);
    }
    if (!isAddress(address)) {
      throw new Error(`Invalid ERC20 address: ${address}`);
    }
    return {
      chainId,
      namespace: 'erc20',
      address: address as `0x${string}`,
    };
  } else {
    if (address) {
      throw new Error(`Native asset should not include address: ${assetId}`);
    }
    return {
      chainId,
      namespace: 'native',
    };
  }
}

/**
 * Validate CAIP-19 asset identifier format
 */
function isValidCAIP19(assetId: string): boolean {
  try {
    parseCAIP19(assetId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Transport interface for sending messages to Host
 */
interface MiniAppTransport {
  sendMessage<T = any>(method: string, params?: any): Promise<T>;
}

/**
 * Create DeFi Actions module
 */
export function createDeFiActionsModule(transport: MiniAppTransport) {
  return {
    /**
     * View token details
     * Navigates to token detail page
     *
     * @param options - ViewToken options
     * @throws Error if token is invalid
     */
    async viewToken(options: ViewTokenOptions): Promise<void> {
      // Validate required parameter
      if (!options.token) {
        throw new Error('token is required for viewToken');
      }

      // Validate CAIP-19 format
      if (!isValidCAIP19(options.token)) {
        throw new Error(`Invalid CAIP-19 format: ${options.token}`);
      }

      // Parse to validate further
      const parsed = parseCAIP19(options.token);

      // Send to Host
      await transport.sendMessage('actions.viewToken', {
        token: options.token,
        // Include parsed data for Host convenience
        _parsed: {
          chainId: parsed.chainId,
          namespace: parsed.namespace,
          address: parsed.address,
        },
      });
    },

    /**
     * Send tokens to address
     * Opens send confirmation dialog and executes transfer
     *
     * @param options - SendToken options
     * @returns Result with transaction hash or error
     */
    async sendToken(options: SendTokenOptions): Promise<SendTokenResult> {
      try {
        // Validate parameters
        validateSendTokenOptions(options);

        // Parse token if provided
        const parsedToken = options.token ? parseCAIP19(options.token) : undefined;

        // Send to Host
        const result = await transport.sendMessage<SendTokenResult>(
          'actions.sendToken',
          {
            token: options.token,
            amount: options.amount,
            recipientAddress: options.recipientAddress,
            recipientTwitterId: options.recipientTwitterId,
            _parsed: parsedToken
              ? {
                  chainId: parsedToken.chainId,
                  namespace: parsedToken.namespace,
                  address: parsedToken.address,
                }
              : undefined,
          }
        );

        return result;
      } catch (error: any) {
        return {
          success: false,
          reason: 'send_failed',
          error: {
            error: error.name || 'SendTokenError',
            message: error.message || 'Failed to send token',
          },
        };
      }
    },

    /**
     * Swap tokens using DEX
     * Opens swap dialog with pre-filled parameters (user can modify)
     * May execute multiple transactions (approval + swap)
     *
     * @param options - SwapToken options
     * @returns Result with transaction hashes or error
     */
    async swapToken(options: SwapTokenOptions): Promise<SwapTokenResult> {
      try {
        // Validate parameters
        validateSwapTokenOptions(options);

        // Parse tokens if provided
        const parsedSellToken = options.sellToken
          ? parseCAIP19(options.sellToken)
          : undefined;
        const parsedBuyToken = options.buyToken ? parseCAIP19(options.buyToken) : undefined;

        // Send to Host
        const result = await transport.sendMessage<SwapTokenResult>(
          'actions.swapToken',
          {
            sellToken: options.sellToken,
            buyToken: options.buyToken,
            sellAmount: options.sellAmount,
            _parsedSellToken: parsedSellToken
              ? {
                  chainId: parsedSellToken.chainId,
                  namespace: parsedSellToken.namespace,
                  address: parsedSellToken.address,
                }
              : undefined,
            _parsedBuyToken: parsedBuyToken
              ? {
                  chainId: parsedBuyToken.chainId,
                  namespace: parsedBuyToken.namespace,
                  address: parsedBuyToken.address,
                }
              : undefined,
          }
        );

        return result;
      } catch (error: any) {
        return {
          success: false,
          reason: 'swap_failed',
          error: {
            error: error.name || 'SwapTokenError',
            message: error.message || 'Failed to swap token',
          },
        };
      }
    },
  };
}

// ==========================================
// Validation Functions
// ==========================================

/**
 * Validate SendToken options
 */
function validateSendTokenOptions(options: SendTokenOptions): void {
  // Validate token format if provided
  if (options.token && !isValidCAIP19(options.token)) {
    throw new Error(`Invalid CAIP-19 format for token: ${options.token}`);
  }

  // Validate amount format if provided
  if (options.amount) {
    if (!/^\d+$/.test(options.amount)) {
      throw new Error('amount must be numeric string (e.g., "1000000")');
    }
    if (BigInt(options.amount) <= 0n) {
      throw new Error('amount must be greater than 0');
    }
  }

  // Validate recipient address if provided
  if (options.recipientAddress) {
    try {
      // Use getAddress to validate and normalize the address (accepts mixed case)
      getAddress(options.recipientAddress);
    } catch {
      throw new Error(`Invalid Ethereum address: ${options.recipientAddress}`);
    }
  }

  // Must have either recipientAddress or recipientTwitterId
  if (!options.recipientAddress && !options.recipientTwitterId) {
    throw new Error('Either recipientAddress or recipientTwitterId is required');
  }
}

/**
 * Validate SwapToken options
 */
function validateSwapTokenOptions(options: SwapTokenOptions): void {
  // Validate sellToken format if provided
  if (options.sellToken && !isValidCAIP19(options.sellToken)) {
    throw new Error(`Invalid CAIP-19 format for sellToken: ${options.sellToken}`);
  }

  // Validate buyToken format if provided
  if (options.buyToken && !isValidCAIP19(options.buyToken)) {
    throw new Error(`Invalid CAIP-19 format for buyToken: ${options.buyToken}`);
  }

  // Validate sellAmount format if provided
  if (options.sellAmount) {
    if (!/^\d+$/.test(options.sellAmount)) {
      throw new Error('sellAmount must be numeric string (e.g., "1000000")');
    }
    if (BigInt(options.sellAmount) <= 0n) {
      throw new Error('sellAmount must be greater than 0');
    }
  }

  // Validate tokens are different
  if (
    options.sellToken &&
    options.buyToken &&
    options.sellToken === options.buyToken
  ) {
    throw new Error('sellToken and buyToken must be different');
  }

  // Parse and validate chain IDs match
  if (options.sellToken && options.buyToken) {
    const sellParsed = parseCAIP19(options.sellToken);
    const buyParsed = parseCAIP19(options.buyToken);

    if (sellParsed.chainId !== buyParsed.chainId) {
      throw new Error(
        `Cross-chain swaps not supported. sellToken chain: ${sellParsed.chainId}, buyToken chain: ${buyParsed.chainId}`
      );
    }
  }
}
