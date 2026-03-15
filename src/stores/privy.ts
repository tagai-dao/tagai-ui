// src/stores/user.ts
import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import { customBsc, getChainById } from "@/utils/privy";
import type { WalletClient, Chain } from "viem";
import { createWalletClient, custom } from "viem";
import { useAccountStore } from "./web3";
import { EthWalletState } from "./web3";
import { useAccount } from "@/composables/useAccount";
import { sleep } from "@/utils/helper";
import { isAddress } from "viem";

export const usePrivyStore = defineStore("privy", () => {
  const viemWalletClient = ref<WalletClient | null>(null);
  const ethersProvider = ref<any>(null);
  const currentChain = ref<Chain>(customBsc);
  const accStore = useAccountStore();

  async function logout() {
    viemWalletClient.value = null;
    ethersProvider.value = null;
    currentChain.value = customBsc;
  }

  // Switch to a different chain
  async function switchChain(chainId: number): Promise<void> {
    try {
      const chain = getChainById(chainId);

      // Request chain switch through provider
      if (ethersProvider.value) {
        await ethersProvider.value.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      }

      // Update wallet client with new chain
      if (ethersProvider.value) {
        viemWalletClient.value = createWalletClient({
          chain,
          transport: custom(ethersProvider.value)
        });
        currentChain.value = chain;
      }
    } catch (error: any) {
      console.error('Error switching chain:', error);
      throw error;
    }
  }

  // Get current chain ID
  function getChainId(): number {
    return currentChain.value.id;
  }

  async function initWallet() {
    try {
      if (!ethersProvider.value) {
        throw new Error('Ethers provider is not initialized');
      }
      viemWalletClient.value = createWalletClient({
        chain: customBsc,
        transport: custom(ethersProvider.value)
      })

      const accStore = useAccountStore();
      accStore.ethConnectAddress = (await viemWalletClient.value.getAddresses())[0];
      console.log('privy address inited', accStore.ethConnectAddress)
      accStore.ethConnectState = EthWalletState.Connected;
      accStore.ethWalletType = 'privy';
    } catch (error) {
      // logout
      useAccountStore().clear();
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  type PrivyStore = {
    viemWalletClient: Ref<WalletClient | null>;
    ethersProvider: Ref<any>;
    currentChain: Ref<Chain>;
    initWallet: () => Promise<void>;
    logout: () => Promise<void>;
    switchChain: (chainId: number) => Promise<void>;
    getChainId: () => number;
  };

  return {
    viemWalletClient,
    ethersProvider,
    currentChain,
    initWallet,
    logout,
    switchChain,
    getChainId
  } as PrivyStore;
});