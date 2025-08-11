// src/stores/user.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ConnectedWallet, OAuthResult, OAuthProviderType } from "@/types/privy-types";
import { privy } from "@/utils/privy";
import { PrivyConfig } from "@/config";
import {getUserEmbeddedEthereumWallet, getEntropyDetailsFromUser} from '@privy-io/js-sdk-core';
import { EthWalletState, useAccountStore } from "./web3";
import { useRoute, useRouter } from "vue-router";
import { createWalletClient, custom, type WalletClient } from "viem";
import { customBsc } from "@/utils/privy";
import { privyLogin } from "@/apis/api";
import type { Account } from "@/types";
import emitter from "@/utils/emitter";
import { notify } from "@/utils/notify";
import { useAccount } from "@/composables/useAccount";

export const useUserStore = defineStore("user", () => {
  const user = ref<OAuthResult["user"] | null>(null);
  const viemWalletClient = ref<WalletClient | null>(null);
  const route = useRoute();
  const ethersProvider = ref<any>(null);
  // iframe相关状态
  const iframeInitialized = ref(false);
  const iframeRef = ref<HTMLIFrameElement | null>(null);
  const messageListener = ref<((e: any) => void) | null>(null);
  const initPromise = ref<Promise<void> | null>(null);
  const router = useRouter();

  // Debug function to check Privy configuration
  function debugPrivyConfig() {
    console.log('Privy Config:', {
      appId: PrivyConfig.appId,
      clientId: PrivyConfig.clientId,
      redirectUri: PrivyConfig.redirectUri,
      loginRedirectUri: PrivyConfig.loginRedirectUri,
      logoutRedirectUri: PrivyConfig.logoutRedirectUri
    });
  }

  // 初始化 Privy iframe - 全局单例模式
  async function initPrivyIframe() {
    // 如果已经初始化过，直接返回
    if (iframeInitialized.value) {
      console.log('Privy iframe already initialized');
      return;
    }

    // 如果正在初始化，等待完成
    if (initPromise.value) {
      console.log('Privy iframe initialization in progress, waiting...');
      await initPromise.value;
      return;
    }

    // 开始初始化
    initPromise.value = _initPrivyIframe();
    await initPromise.value;
  }

  // 实际的初始化逻辑
  async function _initPrivyIframe() {
    try {
      const url = privy.embeddedWallet.getURL();
      console.log('Privy embedded wallet URL:', url);

      const iframe = document.createElement('iframe');
      iframe.src = url;
      
      // 等待 iframe 加载完成后再设置消息传递器
      iframe.onload = () => {
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              privy.setMessagePoster(iframe.contentWindow as any);
              
              // 创建消息监听器
              const listener = (e: any) => {
                try {
                  privy.embeddedWallet.onMessage(e.data);
                } catch (error) {
                  console.warn('Error handling privy message:', error);
                }
              };
              
              window.addEventListener('message', listener);
              console.log('Privy iframe message listener set up successfully');
              
              // 更新状态
              iframeInitialized.value = true;
              iframeRef.value = iframe;
              messageListener.value = listener;
            }
          } catch (error) {
            console.error('Error setting up privy message poster:', error);
          }
        }, 100);
      };
      
      document.body.appendChild(iframe);
    } catch (error) {
      console.error('Error initializing privy embedded wallet:', error);
      initPromise.value = null;
      throw error;
    }
  }

  // 等待 iframe 初始化完成
  async function waitForIframeInitialization(timeout = 5000) {
    const startTime = Date.now();
    
    while (!iframeInitialized.value && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!iframeInitialized.value) {
      throw new Error('Privy iframe initialization timeout');
    }
    
    return true;
  }

  async function loginWithTwitter() {
    const oauth = await privy.auth.oauth.generateURL("twitter" as OAuthProviderType,
      PrivyConfig.loginRedirectUri
    );
    localStorage.setItem('current-route', route.fullPath)
    window.location.href = oauth.url;
  }

  async function logout() {
    try {
      await privy.auth.logout();
    } catch (error) {
      
    }
    user.value = null;
    viemWalletClient.value = null;
    initPromise.value = null;
  }

  async function handleCallback() {
    try {
      const url = new URL(window.location.href);
      console.log({url})
      const code = url.searchParams.get("privy_oauth_code")!;
      const state = url.searchParams.get("privy_oauth_state")!;
      const provider = url.searchParams.get("privy_oauth_provider")!;
      console.log('OAuth callback params:', { code, state, provider });
      
      const result = await privy.auth.oauth.loginWithCode(code, state, provider as OAuthProviderType);
      console.log('OAuth login result:', result);
      
      const userData = await privy.user.get();
      console.log('User data:', userData);
      
      user.value = result.user as OAuthResult["user"];

      // login twitter to tagai
      const oauthTokens = result.oauth_tokens;
      if (oauthTokens) {
        const { access_token, access_token_expires_in_seconds, refresh_token } = oauthTokens;
        if (!access_token || !refresh_token) {
          // login fail
          loginFail();
          return;
        }

        // login to tagai
        const userInfo = await privyLogin(access_token!, refresh_token!) as Account | null;
        console.log('Privy login result:', userInfo);
        if (!userInfo) {
          // login fail
          loginFail();
          return;
        }

        useAccountStore().setAccount(
          {
            ...userInfo,
            authLike: true,
            authPost: true
          } as Account)
        emitter.emit('login', true);
      } else {
        // login fail
        loginFail();
      }
      
    } catch (error) {
      loginFail();
      console.error('Error in handleCallback:', error);
      throw error;
    }
  }

  function loginFail() {
    notify({
      title: 'Login failed',
      message: 'Please try again',
      type: 'error'
    });
    router.replace(localStorage.getItem('current-route') || '/');
  }

  async function initWallet() {
    try {
      useAccountStore().ethConnectState = EthWalletState.Connecting;
      console.log('Starting wallet initialization...');
      
      // 1. 检查用户是否已认证
      const currentUser = await privy.user.get();
      console.log('Current user:', currentUser);
      
      // 2. 如果没有连接则退出
      if (!currentUser || !currentUser.user.id) {
        console.log('User not authenticated, exiting wallet initialization');
        return;
      }
      
      console.log('User authenticated, checking embedded wallet...');
      
      // 3. 检查embedded wallet是否可用
      if (!privy.embeddedWallet) {
        throw new Error('Embedded wallet not available');
      }
      
      // 4. 检查iframe是否已加载
      try {
        const iframeUrl = privy.embeddedWallet.getURL();
        console.log('Iframe URL available:', iframeUrl);
      } catch (error) {
        console.error('Iframe not ready:', error);
        throw new Error('Privy iframe not initialized. Please ensure iframe is loaded before creating wallet.');
      }
      
      // 5. 检查embedded钱包是否已创建
      let embeddedAccount = currentUser.user.linked_accounts.find((item: any) => item.type === 'wallet' && item.connector_type === 'embedded');
      
      if (!embeddedAccount) {
        // 6. 如果没有创建，则创建一个新的embedded钱包
        console.log('No embedded wallet found, creating new one...');
        const updatedUser = await privy.embeddedWallet.create({});
        embeddedAccount = updatedUser.user.linked_accounts.find((item: any) => item.type === 'wallet' && item.connector_type === 'embedded');
        console.log('Created embedded wallet:', embeddedAccount);
        currentUser.user = updatedUser.user;
      } else {
        console.log('Embedded wallet already exists:', embeddedAccount);
      }

      // 7. 构建provider
      const wallet = getUserEmbeddedEthereumWallet(currentUser.user);
      const { entropyId, entropyIdVerifier } = getEntropyDetailsFromUser(currentUser.user) as any;
      
      console.log('Wallet details:', { wallet, entropyId, entropyIdVerifier });
      
      const provider = await privy.embeddedWallet.getEthereumProvider({  
          wallet: wallet as any,
          entropyId,
          entropyIdVerifier
      });

      viemWalletClient.value = createWalletClient({
        chain: customBsc,
        transport: custom(provider)
      })

      ethersProvider.value = provider;

      const accStore = useAccountStore();
      accStore.ethConnectAddress = (await viemWalletClient.value.getAddresses())[0];
      accStore.ethConnectState = EthWalletState.Connected;
      accStore.ethWalletType = 'privy-twitter';

      // const tx = await viemWalletClient.value.writeContract({
      //   account: useAccountStore().ethConnectAddress as `0x${string}`,
      //   address: '0x6C818c610F3D9db65f5e0c0838f3F68600b80C85' as `0x${string}`,
      //   abi: abis['ERC20'],
      //   functionName: 'approve',
      //   args: [useAccountStore().ethConnectAddress as `0x${string}`, 235235235n],
      //   chain: bsc
      // })
      // console.log('tx', tx);
    } catch (error) {
      useAccountStore().ethConnectState = EthWalletState.Disconnect;
      // logout
      useAccount().logout();
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  return { 
    user, 
    viemWalletClient,
    iframeInitialized, 
    iframeRef,
    messageListener,
    ethersProvider,
    loginWithTwitter, 
    logout, 
    handleCallback, 
    initWallet, 
    initPrivyIframe,
    waitForIframeInitialization,
    debugPrivyConfig 
  };
});