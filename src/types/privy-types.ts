// src/utils/privy-types.ts
import type Privy from "@privy-io/js-sdk-core";


/** 自定义 Privy connected wallet 类型 */
export interface ConnectedWallet {
    id: string;
    address: `0x${string}`;
    chain_id?: string;
    wallet_client_type?: string;
    // 你也可以补充下面常见方法类型
    getEthereumProvider(): Promise<{
      request(args: { method: string; params?: any[] }): Promise<any>;
    }>;
    switchChain?(chainId: number): Promise<void>;
  }

export interface OAuthResult {
  user: {
    id: string;
    email?: string;
    metadata?: Record<string, any>;
    wallets?: ConnectedWallet[];
    // 你可以根据 Privy 返回字段自行补充
  };
}

export type OAuthProviderType = "twitter";

export interface PrivyEmbeddedWallet {
  id: string;
  chain_id: string;
  wallet_client_type: string;
  getEthereumProvider(): Promise<{
    request(payload: { method: string; params?: any[] }): Promise<any>;
  }>;
  switchChain(chainId: number): Promise<void>;
  // 可根据 SDK 补充 sendTransaction, signMessage 等结构
  type: "wallet";
  address: `0x${string}`;
  verified_at: number;
  first_verified_at: number | null;
  latest_verified_at: number | null;
  chain_type: "ethereum";
  wallet_client: "unknown";
  connector_type?: string | undefined;
}