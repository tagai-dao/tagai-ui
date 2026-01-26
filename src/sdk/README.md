# TagAI Mini Apps SDK

TagAI Mini Apps SDK 是一个用于构建 TagAI 小程序的框架，参考了 Farcaster Mini Apps 的设计，并针对 TagAI 的特点进行了定制。

## 与 Farcaster Mini Apps 的差异

### 1. 账户系统

| 特性 | TagAI | Farcaster |
|------|-------|-----------|
| 身份标识 | Twitter ID | Farcaster ID (FID) |
| 认证方式 | Twitter OAuth + Privy | Sign In With Farcaster (SIWF) |
| 钱包来源 | Privy 生成的嵌入式钱包 | 链上钱包 + 权限管理系统 |

### 2. 交易与转账

| 特性 | TagAI | Farcaster |
|------|-------|-----------|
| 默认链 | BSC (Binance Smart Chain) | Ethereum + Base |
| 钱包类型 | Privy 嵌入式钱包 | 内置钱包或外部插件钱包 |
| 多链支持 | BSC 为主，可扩展 | ETH + Solana |

### 3. 内容发布

| 特性 | TagAI | Farcaster |
|------|-------|-----------|
| 主要平台 | Twitter + Steem 区块链 | Farcaster Hub |
| 交叉发布 | 默认同步到 Twitter | 仅 Farcaster |
| 内容存储 | Steem 去中心化存储 | Farcaster Hub |

## SDK 结构

```
tagai-ui/src/sdk/
├── miniapp-core/          # 核心层
│   └── src/
│       ├── context.ts     # 上下文管理
│       ├── transport.ts   # 通信层 (postMessage)
│       ├── types.ts       # 基础类型
│       └── schemas/       # 数据验证
│
├── miniapp-sdk/           # SDK 主包
│   └── src/
│       ├── index.ts       # 主入口
│       ├── types.ts       # 完整类型定义
│       ├── modules/
│       │   ├── auth.ts          # 认证模块
│       │   ├── wallet.ts        # 钱包模块
│       │   ├── steem.ts         # Steem 社交模块
│       │   ├── twitter.ts       # Twitter 集成模块
│       │   ├── actions.ts       # 应用行为模块
│       │   ├── defi-actions.ts  # DeFi 交易模块
│       │   ├── notifications.ts # 通知模块
│       │   ├── haptics.ts       # 触觉反馈模块
│       │   ├── platform.ts      # 平台能力模块
│       │   └── back.ts          # 返回导航模块
│       └── utils/
│           └── event-emitter.ts
│
├── miniapp-host/          # 宿主端实现
│   └── src/
│       ├── host.ts        # 消息处理器
│       ├── types.ts       # Handler 类型
│       └── index.ts
│
└── examples/              # 使用示例
    └── basic-usage.ts
```

## 快速开始

### 安装

```bash
# SDK 包含在 TagAI 项目中
import sdk from '@tagai/miniapp-sdk';
```

### 基本使用

```typescript
import sdk from '@tagai/miniapp-sdk';

async function init() {
  // 检查是否在 Mini App 环境中
  const isInMiniApp = await sdk.isInMiniApp();

  if (isInMiniApp) {
    // 标记应用就绪
    await sdk.actions.ready();

    // 获取用户上下文
    const context = await sdk.context;
    console.log('User:', context.user.twitterUsername);
  }
}
```

## 模块 API

### 认证模块 (auth)

```typescript
// 获取 JWT Token
const { token, expiresAt } = await sdk.auth.getToken();

// 使用认证的 fetch
const response = await sdk.auth.fetch('/api/user');

// 登录签名
const result = await sdk.auth.signIn({ nonce: 'optional-nonce' });
```

### 钱包模块 (wallet)

```typescript
// 获取地址
const address = await sdk.wallet.getAddress();

// 获取余额
const balance = await sdk.wallet.getBalance();
console.log(balance.formatted, balance.symbol); // "1.5 BNB"

// 发送交易
const txHash = await sdk.wallet.sendTransaction({
  to: '0x...',
  value: BigInt('1000000000000000000'),
});

// 签名消息
const signature = await sdk.wallet.signMessage('Hello');
```

### Steem 模块 (steem) - TagAI 独有

```typescript
// 发布帖子
const post = await sdk.steem.post({
  title: 'My Post',
  body: 'Content here...',
  tags: ['tagai', 'crypto'],
  crossPostTwitter: true, // 同时发 Twitter
});

// 投票
await sdk.steem.vote('author', 'permlink', 10000); // 100%

// 评论
await sdk.steem.comment({
  parentAuthor: 'author',
  parentPermlink: 'permlink',
  body: 'Great post!',
});

// 转发
await sdk.steem.reblog('author', 'permlink');
```

### Twitter 模块 (twitter) - TagAI 独有

```typescript
// 检查连接状态
const isConnected = await sdk.twitter.isConnected();

// 发推文
const result = await sdk.twitter.post({
  text: 'Hello from TagAI! #Web3',
});

// 分享
await sdk.twitter.share({
  url: 'https://tagai.app',
  text: 'Check this out!',
  hashtags: ['TagAI'],
});
```

### DeFi 动作 (actions.swapToken/sendToken/viewToken)

```typescript
// 代币交换
const result = await sdk.actions.swapToken({
  sellToken: 'eip155:56/native', // BNB
  buyToken: 'eip155:56/erc20:0x...', // USDT
  sellAmount: '1000000000000000000', // 1 BNB
});

// 转账
await sdk.actions.sendToken({
  token: 'eip155:56/erc20:0x...',
  amount: '1000000',
  recipientAddress: '0x...',
  // 或使用 Twitter ID
  recipientTwitterId: '123456789',
});

// 查看代币详情
await sdk.actions.viewToken({
  token: 'eip155:56/erc20:0x...',
});
```

### 触觉反馈 (haptics)

```typescript
// 冲击反馈
await sdk.haptics.impactOccurred('medium'); // light/medium/heavy/soft/rigid

// 通知反馈
await sdk.haptics.notificationOccurred('success'); // success/warning/error

// 选择变化
await sdk.haptics.selectionChanged();
```

### 平台能力 (platform)

```typescript
// 获取支持的能力
const capabilities = await sdk.platform.getCapabilities();

// 检查特定能力
const hasSwap = await sdk.platform.hasCapability('actions.swapToken');

// 获取支持的链
const chains = await sdk.platform.getChains();

// 获取 SDK 版本
const version = sdk.platform.getVersion();
```

### 返回导航 (back)

```typescript
// 启用自定义返回处理
await sdk.back.enable(() => {
  // 自定义返回逻辑
  router.back();
});

// 监听返回事件
sdk.on('backNavigationTriggered', () => {
  console.log('Back triggered');
});

// 禁用
await sdk.back.disable();
```

### 通知 (notifications)

```typescript
// 订阅通知
const token = await sdk.notifications.subscribe();

// 检查状态
const isEnabled = await sdk.notifications.isEnabled();

// 监听事件
sdk.on('notificationsEnabled', (event) => {
  console.log('Token:', event.notificationDetails);
});
```

## 事件系统

```typescript
// 订阅事件
sdk.on('primaryButtonClicked', () => {});
sdk.on('miniAppAdded', (event) => {});
sdk.on('miniAppRemoved', () => {});
sdk.on('notificationsEnabled', (event) => {});
sdk.on('notificationsDisabled', () => {});
sdk.on('backNavigationTriggered', () => {});
sdk.on('appStateChanged', (state) => {});

// 取消订阅
sdk.off('primaryButtonClicked', handler);

// 清除所有
sdk.removeAllListeners();
```

## 服务端认证

```typescript
import { verifyJwt, requireAuth } from '@tagai/miniapp-auth';

// 验证 JWT
const result = await verifyJwt(token, process.env.JWT_SECRET);
if (result.valid) {
  console.log('User:', result.payload.twitterId);
}

// Express 中间件
app.get('/api/user', requireAuth(process.env.JWT_SECRET), (req, res) => {
  res.json({ user: req.miniappUser });
});
```

## 宿主端集成

```typescript
import { createMiniAppHost } from '@tagai/miniapp-host';

// 创建 Host
const host = createMiniAppHost({
  iframe: document.getElementById('miniapp-frame'),
  context: {
    client: { clientTwitterId: 'tagai', added: false },
    user: { twitterId: '123', twitterUsername: 'user' },
    location: { type: 'launcher' },
  },
  domain: 'app.example.com',
  url: 'https://app.example.com',
  onClose: () => console.log('Mini App closed'),
});

// 启动监听
host.start();

// 注册自定义处理器
host.registerHandler('steem.post', async (params, context) => {
  // 处理 Steem 发帖
  return { author: '...', permlink: '...', url: '...' };
});

// 发送事件
host.emitPrimaryButtonClick();
host.emitMiniAppAdded({ url: '...', token: '...' });

// 清理
host.stop();
```

## 与 Farcaster 的兼容性

TagAI Mini Apps SDK 在设计上保持了与 Farcaster Mini Apps 的兼容性：

- 相似的 SDK API 结构
- 相同的 CAIP-19 资产标识格式
- 兼容的事件系统
- 类似的 postMessage 通信协议

主要差异在于：
1. 使用 Twitter ID 而非 FID
2. 使用 Privy 钱包而非原生链上钱包
3. 额外的 Steem 和 Twitter 集成模块

## 参考资料

- [Farcaster Mini Apps Documentation](https://miniapps.farcaster.xyz/docs/getting-started)
- [TagAI API Documentation](https://docs.tagai.app)
- [CAIP-19 Asset ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-19.md)
