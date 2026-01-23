/**
 * Wallet Module
 * Handles Privy wallet interactions on BSC
 */

import type { MiniAppTransport } from '../../../miniapp-core/src/transport';
import type { WalletModule } from '../types';
import type { WalletClient, Hash, Address } from 'viem';
import { createWalletClient, custom, formatEther } from 'viem';
import { bsc } from 'viem/chains';

export function createWalletModule(transport: MiniAppTransport): WalletModule {
  let cachedProvider: WalletClient | null = null;

  // Create a proxy provider that sends requests through transport
  function createProxyProvider(): WalletClient {
    const proxyTransport = custom({
      async request({ method, params }) {
        return await transport.sendMessage('wallet.request', {
          method,
          params,
        });
      },
    });

    return createWalletClient({
      chain: bsc,
      transport: proxyTransport,
    });
  }

  return {
    async getProvider(): Promise<WalletClient> {
      if (cachedProvider) {
        return cachedProvider;
      }

      cachedProvider = createProxyProvider();
      return cachedProvider;
    },

    async sendTransaction(options) {
      const hash = await transport.sendMessage<Hash>('wallet.sendTransaction', options);
      return hash;
    },

    async signMessage(message: string): Promise<string> {
      return await transport.sendMessage<string>('wallet.signMessage', { message });
    },

    async getBalance() {
      const result = await transport.sendMessage<{ value: bigint; symbol: string }>(
        'wallet.getBalance'
      );

      return {
        value: BigInt(result.value), // Ensure it's a bigint
        formatted: formatEther(BigInt(result.value)),
        symbol: result.symbol || 'BNB',
      };
    },

    async getAddress(): Promise<Address> {
      return await transport.sendMessage<Address>('wallet.getAddress');
    },
  };
}
