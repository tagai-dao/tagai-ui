// src/stores/user.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ConnectedWallet, OAuthResult, OAuthProviderType } from "@/types/privy-types";
import { privy } from "@/utils/privy";
import { BrowserProvider, JsonRpcSigner, type Signer } from "ethers";
import { PrivyConfig } from "@/config";
import {getUserEmbeddedEthereumWallet, getEntropyDetailsFromUser} from '@privy-io/js-sdk-core';


export const useUserStore = defineStore("user", () => {
  const user = ref<OAuthResult["user"] | null>(null);
  const wallet = ref<ConnectedWallet | null>(null);
  const ethersProvider = ref<BrowserProvider | null>(null);
  const signer = ref<JsonRpcSigner | null>(null);

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

  async function loginWithTwitter() {

    console.log(123, PrivyConfig);
    const oauth = await privy.auth.oauth.generateURL("twitter" as OAuthProviderType,
      PrivyConfig.loginRedirectUri
    );
    window.location.href = oauth.url;
  }

  async function handleCallback() {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("privy_oauth_code")!;
      const state = url.searchParams.get("privy_oauth_state")!;
      const provider = url.searchParams.get("privy_oauth_provider")!;
      console.log('OAuth callback params:', { code, state, provider });
      
      const result = await privy.auth.oauth.loginWithCode(code, state, provider as OAuthProviderType);
      console.log('OAuth login result:', result);
      
      const userData = await privy.user.get();
      console.log('User data:', userData);
      
      user.value = result.user as OAuthResult["user"];
    } catch (error) {
      console.error('Error in handleCallback:', error);
      throw error;
    }
  }

  async function initWallet() {
    try {
      console.log('Starting wallet initialization...');
      debugPrivyConfig();
      
      // Check if user is authenticated
      const currentUser = await privy.user.get();
      console.log('Current user:', currentUser);
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      console.log('User authenticated, creating embedded wallet...');
      
      // Check if embedded wallet is available
      if (!privy.embeddedWallet) {
        throw new Error('Embedded wallet not available');
      }
      
      // Check if iframe is loaded by trying to get the URL
      try {
        const iframeUrl = privy.embeddedWallet.getURL();
        console.log('Iframe URL available:', iframeUrl);
      } catch (error) {
        console.error('Iframe not ready:', error);
        throw new Error('Privy iframe not initialized. Please ensure iframe is loaded before creating wallet.');
      }
      
      // Create embedded wallet
      const response = await privy.embeddedWallet.create({});
      console.log('Created embedded wallet:', response);
      
      const wallet = getUserEmbeddedEthereumWallet(response.user);
      const { entropyId, entropyIdVerifier } = getEntropyDetailsFromUser(response.user) as any;
      
      console.log('Wallet details:', { wallet, entropyId, entropyIdVerifier });
      
      const provider = await privy.embeddedWallet.getEthereumProvider({  
          wallet: wallet as any,
          entropyId,
          entropyIdVerifier 
      });
      
      const bp = new BrowserProvider(provider);
      ethersProvider.value = bp;
      signer.value = await bp.getSigner();
      console.log('Wallet initialized successfully:', signer.value, bp);
    } catch (error) {
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  return { user, wallet, ethersProvider, signer, loginWithTwitter, handleCallback, initWallet, debugPrivyConfig };
});