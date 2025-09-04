// src/stores/user.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import { customBsc } from "@/utils/privy";
import type { WalletClient } from "viem";
import { createWalletClient, custom } from "viem";
import { useAccountStore } from "./web3";
import { EthWalletState } from "./web3";
import { useAccount } from "@/composables/useAccount";
import { sleep } from "@/utils/helper";

export const usePrivyStore = defineStore("privy", () => {
  const viemWalletClient = ref<WalletClient | null>(null);
  const ethersProvider = ref<any>(null);
  const accStore = useAccountStore();

  async function logout() {
    viemWalletClient.value = null;
    ethersProvider.value = null;
  }

  async function initWallet(provider: any) {
    try {
      let count = 1
      while(count < 5) {
        try {
          if (accStore.getAccountInfo?.walletType == 1) {
            viemWalletClient.value = createWalletClient({
              chain: customBsc,
              transport: custom(provider)
            })
            ethersProvider.value = provider;

            const accStore = useAccountStore();
            accStore.ethConnectAddress = (await viemWalletClient.value.getAddresses())[0];
            accStore.ethConnectState = EthWalletState.Connected;
            accStore.ethWalletType = 'privy-twitter';
            return;
          } else {
            accStore.ethWalletType = 'metamask';
          }
        } catch (error) {
          console.error('Error initializing wallet:', error);
        }
        count++;
        await sleep(1)
      }
    } catch (error) {
      useAccountStore().ethConnectState = EthWalletState.Disconnect;
      // logout
      useAccount().logout();
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  return {
    viemWalletClient,
    ethersProvider,
    initWallet,
    logout
  };
});