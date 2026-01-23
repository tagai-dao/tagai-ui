/**
 * TagAI Mini App Core Types
 * 核心类型定义
 */

import type { WalletClient, Hash, Address } from 'viem';

// ==========================================
// Context Types (上下文类型)
// ==========================================

export interface MiniAppContext {
  /** 用户信息 */
  user: {
    /** 以太坊地址（Privy 钱包）*/
    ethAddress: Address;
    /** Twitter ID */
    twitterId?: string;
    /** Twitter 用户名 */
    twitterUsername?: string;
    /** Steem 用户名 */
    steemUsername?: string;
    /** 显示名称 */
    displayName?: string;
    /** 头像 URL */
    avatar?: string;
    /** 个人简介 */
    bio?: string;
  };

  /** 应用信息 */
  app: {
    /** 应用是否已添加到用户列表 */
    added: boolean;
    /** 通知权限 */
    notificationEnabled: boolean;
  };

  /** 位置信息（从哪里打开的 mini app）*/
  location?: {
    type: 'post' | 'profile' | 'home' | 'notification';
    /** 帖子信息（如果从帖子打开）*/
    post?: {
      author: string;
      permlink: string;
    };
    /** 用户信息（如果从个人主页打开）*/
    profile?: {
      username: string;
    };
  };
}

// ==========================================
// Auth Types (认证类型)
// ==========================================

export namespace Auth {
  export interface GetTokenOptions {
    /** 强制刷新 token */
    forceRefresh?: boolean;
  }

  export interface TokenResult {
    /** JWT token */
    token: string;
    /** 过期时间（Unix 时间戳）*/
    expiresAt: number;
  }

  export interface SignInOptions {
    /** 随机数（可选）*/
    nonce?: string;
  }

  export interface SignInResult {
    ethAddress: Address;
    twitterId?: string;
    twitterUsername?: string;
    steemUsername?: string;
    displayName?: string;
    avatar?: string;
    /** SIWE 消息 */
    message: string;
    /** 签名 */
    signature: string;
  }
}

// ==========================================
// Steem Social Types (Steem 社交类型)
// ==========================================

export namespace Steem {
  export interface PostOptions {
    /** 标题 */
    title: string;
    /** 正文（Markdown）*/
    body: string;
    /** 标签 */
    tags?: string[];
    /** JSON 元数据 */
    jsonMetadata?: Record<string, any>;
    /** 受益人设置 */
    beneficiaries?: Array<{
      account: string;
      weight: number;
    }>;
  }

  export interface PostResult {
    /** Steem 用户名 */
    author: string;
    /** Permlink（唯一标识）*/
    permlink: string;
    /** 完整 URL */
    url: string;
  }

  export interface CommentOptions {
    /** 父帖子作者 */
    parentAuthor: string;
    /** 父帖子 permlink */
    parentPermlink: string;
    /** 评论正文 */
    body: string;
    /** JSON 元数据 */
    jsonMetadata?: Record<string, any>;
  }

  export interface CommentResult {
    author: string;
    permlink: string;
    url: string;
  }

  export interface VoteOptions {
    /** 作者 */
    author: string;
    /** Permlink */
    permlink: string;
    /** 权重（-10000 到 10000）*/
    weight: number;
  }
}

// ==========================================
// Wallet Types (钱包类型)
// ==========================================

export namespace Wallet {
  export interface SendTransactionOptions {
    to: Address;
    value?: bigint;
    data?: `0x${string}`;
    gas?: bigint;
  }

  export interface SignMessageOptions {
    message: string;
  }

  export interface BalanceResult {
    /** BNB 余额 */
    value: bigint;
    /** 格式化后的余额 */
    formatted: string;
    /** 符号 */
    symbol: string;
  }
}

// ==========================================
// Actions Types (应用行为类型)
// ==========================================

export namespace Actions {
  export interface ReadyOptions {
    /** 启动屏持续时间（毫秒）*/
    splashDuration?: number;
  }

  export interface ComposeOptions {
    /** 预填文本 */
    text?: string;
    /** 图片 URL 列表 */
    images?: string[];
    /** 标签 */
    tags?: string[];
  }

  export interface ComposeResult {
    /** 是否成功发布 */
    posted: boolean;
    /** Permlink（如果发布成功）*/
    permlink?: string;
    /** 作者 */
    author?: string;
  }

  export interface ShareOptions {
    /** 分享的 URL */
    url: string;
    /** 分享文本 */
    text?: string;
  }

  export interface ViewProfileOptions {
    /** 用户名（Twitter 或 Steem）*/
    username: string;
  }

  export interface ViewPostOptions {
    /** 作者 */
    author: string;
    /** Permlink */
    permlink: string;
  }

  export interface SetPrimaryButtonOptions {
    /** 按钮文本 */
    text: string;
    /** 是否启用 */
    enabled?: boolean;
    /** 是否显示加载状态 */
    loading?: boolean;
  }
}

// ==========================================
// Manifest Types (Manifest 类型)
// ==========================================

export interface MiniAppManifest {
  /** 版本 */
  version: '1';

  /** 应用名称 */
  name: string;

  /** 图标 URL */
  iconUrl: string;

  /** 首页 URL */
  homeUrl: string;

  /** 启动图 URL */
  splashImageUrl?: string;

  /** 启动图背景色 */
  splashBackgroundColor?: string;

  /** 副标题 */
  subtitle?: string;

  /** 描述 */
  description?: string;

  /** 截图 URL 列表 */
  screenshots?: string[];

  /** 分类 */
  category?: 'games' | 'defi' | 'social' | 'tools' | 'nft' | 'other';

  /** 标签 */
  tags?: string[];

  /** Hero 图片 URL */
  heroImageUrl?: string;

  /** Webhook URL（用于通知）*/
  webhookUrl?: string;

  /** 所需能力 */
  requiredCapabilities?: string[];

  /** 所需链 */
  requiredChains?: string[];
}

export interface MiniAppManifestFull {
  /** 账户关联（所有权验证）*/
  accountAssociation?: {
    header: string;
    payload: string;
    signature: string;
  };

  /** Mini App 配置 */
  miniapp: MiniAppManifest;
}

// ==========================================
// Embed Types (嵌入卡片类型)
// ==========================================

export interface MiniAppEmbed {
  /** 版本 */
  version: '1';

  /** 图片 URL */
  imageUrl: string;

  /** 按钮配置 */
  button: {
    /** 按钮文本 */
    title: string;

    /** 按钮行为 */
    action: {
      /** 类型 */
      type: 'launch_miniapp';

      /** 启动 URL */
      url?: string;

      /** 应用名称 */
      name?: string;

      /** 启动图 URL */
      splashImageUrl?: string;

      /** 启动图背景色 */
      splashBackgroundColor?: string;
    };
  };
}

// ==========================================
// Event Types (事件类型)
// ==========================================

export type MiniAppEventMap = {
  /** 主按钮点击 */
  primaryButtonClicked: () => void;

  /** Mini App 被添加 */
  miniAppAdded: () => void;

  /** Mini App 被移除 */
  miniAppRemoved: () => void;

  /** 通知权限开启 */
  notificationsEnabled: () => void;

  /** 通知权限关闭 */
  notificationsDisabled: () => void;

  /** 返回按钮触发 */
  backNavigationTriggered: () => void;
};

// ==========================================
// Message Types (通信消息类型)
// ==========================================

export interface MiniAppMessage {
  /** 消息 ID */
  id: string;

  /** 方法名 */
  method: string;

  /** 参数 */
  params?: any;
}

export interface MiniAppResponse {
  /** 消息 ID */
  id: string;

  /** 结果 */
  result?: any;

  /** 错误 */
  error?: {
    code: string;
    message: string;
  };
}

// ==========================================
// Errors (错误类型)
// ==========================================

export class MiniAppError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'MiniAppError';
  }
}

export class NotInMiniAppError extends MiniAppError {
  constructor() {
    super('NOT_IN_MINIAPP', 'Not running in a TagAI Mini App environment');
  }
}

export class UserRejectedError extends MiniAppError {
  constructor() {
    super('USER_REJECTED', 'User rejected the request');
  }
}

export class AuthenticationRequiredError extends MiniAppError {
  constructor() {
    super('AUTH_REQUIRED', 'Authentication required');
  }
}

export class InvalidManifestError extends MiniAppError {
  constructor(message: string) {
    super('INVALID_MANIFEST', message);
  }
}
