// src/stores/user.ts
import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import { customBsc, getChainById } from "@/utils/privy";
import type { WalletClient, Chain } from "viem";
import { createWalletClient, custom } from "viem";
import { useAccountStore } from "./web3";
import { EthWalletState } from "./web3";
import { useChainStore } from "./chain";
import { getChainDeployment } from "@/config/chains";

export const usePrivyStore = defineStore("privy", () => {
  const viemWalletClient = ref<WalletClient | null>(null);
  const ethersProvider = ref<any>(null);
  const currentChain = ref<Chain>(customBsc);
  const walletBinding = ref(false);

  async function logout() {
    viemWalletClient.value = null;
    ethersProvider.value = null;
    walletBinding.value = false;
    currentChain.value = getChainById(useChainStore().activeChainId);
  }

  // Switch to a different chain（同步产品 activeChain）
  async function switchChain(chainId: number): Promise<void> {
    try {
      const chain = getChainById(chainId);

      if (ethersProvider.value) {
        try {
          await ethersProvider.value.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          // 4902: 链未添加 → wallet_addEthereumChain
          if (switchError?.code === 4902 || switchError?.code === -32603) {
            const deployment = getChainDeployment(chainId)
            await ethersProvider.value.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${chainId.toString(16)}`,
                chainName: deployment.name,
                rpcUrls: [deployment.rpc],
                nativeCurrency: {
                  name: deployment.nativeCurrency.name,
                  symbol: deployment.nativeCurrency.symbol,
                  decimals: deployment.nativeCurrency.decimals,
                },
                blockExplorerUrls: [deployment.browser],
              }],
            })
          } else {
            throw switchError
          }
        }
      }

      if (ethersProvider.value) {
        viemWalletClient.value = createWalletClient({
          chain,
          transport: custom(ethersProvider.value)
        });
        currentChain.value = chain;
      }

      // 产品链由 ChainSwitcher 负责持久化 + reload；此处只同步钱包侧 chainId
      useAccountStore().chainId = chainId
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
      // 跟随产品当前链（默认 BSC，可切到 Robinhood）
      const chain = getChainById(useChainStore().activeChainId)
      viemWalletClient.value = createWalletClient({
        chain,
        transport: custom(ethersProvider.value)
      })
      currentChain.value = chain

      const accStore = useAccountStore();
      accStore.ethConnectAddress = (await viemWalletClient.value.getAddresses())[0];
      console.log('privy address inited', accStore.ethConnectAddress)
      accStore.ethConnectState = EthWalletState.Connected;
      accStore.ethWalletType = 'privy';
      accStore.chainId = chain.id
    } catch (error) {
      // Wallet readiness is independent from the application login session.
      // A temporarily unavailable provider must never sign the user out.
      const accStore = useAccountStore();
      accStore.ethConnectState = EthWalletState.Disconnect;
      accStore.ethConnectAddress = '';
      accStore.ethWalletType = 'none';
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  type PrivyStore = {
    viemWalletClient: Ref<WalletClient | null>;
    ethersProvider: Ref<any>;
    currentChain: Ref<Chain>;
    walletBinding: Ref<boolean>;
    initWallet: () => Promise<void>;
    logout: () => Promise<void>;
    switchChain: (chainId: number) => Promise<void>;
    getChainId: () => number;
  };

  return {
    viemWalletClient,
    ethersProvider,
    currentChain,
    walletBinding,
    initWallet,
    logout,
    switchChain,
    getChainId
  } as PrivyStore;
});
