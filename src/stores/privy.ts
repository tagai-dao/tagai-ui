// src/stores/user.ts
import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import { customBsc } from "@/utils/privy";
import type { WalletClient } from "viem";
import { createWalletClient, custom } from "viem";
import { useAccountStore } from "./web3";
import { EthWalletState } from "./web3";
import { useAccount } from "@/composables/useAccount";
import { sleep } from "@/utils/helper";
import { isAddress } from "viem";

export const usePrivyStore = defineStore("privy", () => {
  const viemWalletClient = ref<WalletClient | null>(null);
  const ethersProvider = ref<any>(null);
  const accStore = useAccountStore();

  async function logout() {
    viemWalletClient.value = null;
    ethersProvider.value = null;
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
      accStore.ethWalletType = 'privy-twitter';
    } catch (error) {
      useAccountStore().ethConnectState = EthWalletState.Disconnect;
      // logout
      useAccount().logout();
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  type PrivyStore = {
    viemWalletClient: Ref<WalletClient | null>;
    ethersProvider: Ref<any>;
    initWallet: () => Promise<void>;
    logout: () => Promise<void>;
  };

  return {
    viemWalletClient,
    ethersProvider,
    initWallet,
    logout
  } as PrivyStore;
});