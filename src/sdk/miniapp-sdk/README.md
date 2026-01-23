# TagAI Mini Apps SDK

Official SDK for building Mini Apps on the TagAI platform.

## Installation

### NPM
```bash
npm install @tagai/miniapp-sdk
```

### CDN
```html
<script src="https://unpkg.com/@tagai/miniapp-sdk@latest"></script>
```

## Quick Start

```javascript
import TagAI from '@tagai/miniapp-sdk';

// Initialize SDK
const sdk = TagAI.init();

// Get user context
const context = await sdk.context.getContext();
console.log('User:', context.user);

// Create a post
const result = await sdk.steem.post({
  title: 'Hello World',
  body: 'My first post from Mini App!',
  tags: ['tagai', 'miniapp']
});
console.log('Post URL:', result.url);

// Notify app is ready
await sdk.actions.ready();
```

## API Reference

### Context API

```javascript
// Get user and platform context
const context = await sdk.context.getContext();
```

Returns:
```typescript
{
  client: {
    platformType: 'web',
    clientTwitterId: string,
    added: boolean,
  },
  user: {
    twitterId: string,
    twitterUsername: string,
    twitterName: string,
    profile: string,
    ethAddr: string,
  },
  location: {
    type: 'launcher' | 'feed' | 'profile',
  }
}
```

### Auth API

```javascript
// Get JWT token
const { token, expiresAt } = await sdk.auth.getToken();

// Sign in with wallet
const result = await sdk.auth.signIn({ nonce: Date.now() });
```

### Steem API

```javascript
// Create post
const post = await sdk.steem.post({
  title: 'Post Title',
  body: 'Post content in Markdown',
  tags: ['tag1', 'tag2'],
  jsonMetadata: { custom: 'data' },
  beneficiaries: []
});

// Vote on post
await sdk.steem.vote('author', 'permlink', 10000); // 100%

// Comment on post
const comment = await sdk.steem.comment({
  parentAuthor: 'author',
  parentPermlink: 'permlink',
  body: 'Comment text'
});

// Reblog post
await sdk.steem.reblog('author', 'permlink');
```

### Wallet API

```javascript
// Get wallet address
const address = await sdk.wallet.getAddress();

// Get balance
const balance = await sdk.wallet.getBalance();
// { value: "1000000000000000000", symbol: "BNB" }

// Send transaction
const hash = await sdk.wallet.sendTransaction({
  to: '0x...',
  value: '1000000000000000000'
});

// Sign message
const signature = await sdk.wallet.signMessage('Hello World');

// EIP-1193 request
const result = await sdk.wallet.request({
  method: 'eth_blockNumber',
  params: []
});
```

### Actions API

```javascript
// Notify app is ready (hide splash screen)
await sdk.actions.ready({ splashDuration: 500 });

// Close app
await sdk.actions.close();

// Open URL
await sdk.actions.openUrl('https://example.com');

// Open compose dialog
const result = await sdk.actions.compose({
  title: 'New Post',
  text: 'Initial text...',
  placeholder: 'What\'s happening?',
  submitButtonText: 'Post',
  embed: {
    url: 'https://example.com',
    type: 'miniapp',
    metadata: {
      title: 'Title',
      description: 'Description',
      image: 'https://example.com/image.png'
    }
  }
});
// { posted: true, postUrl, author, permlink }

// Share content
await sdk.actions.share({
  url: 'https://example.com',
  text: 'Check this out!'
});

// Set primary button
await sdk.actions.setPrimaryButton({
  text: 'Click Me',
  enabled: true,
  loading: false
});

// Listen to primary button click
sdk.actions.onPrimaryButtonClick(() => {
  console.log('Button clicked!');
});

// Add mini app to user's collection
await sdk.actions.addMiniApp();
```

## Examples

### Simple Post Creator

```javascript
import TagAI from '@tagai/miniapp-sdk';

const sdk = TagAI.init();

async function createPost() {
  const result = await sdk.actions.compose({
    title: 'Create Post',
    text: '',
    placeholder: 'Write your post...'
  });

  if (result.posted) {
    alert(`Post created: ${result.postUrl}`);
  }
}

// Set up button
await sdk.actions.setPrimaryButton({
  text: 'Create Post',
  enabled: true
});

sdk.actions.onPrimaryButtonClick(createPost);

// App is ready
await sdk.actions.ready();
```

### Wallet Integration

```javascript
import TagAI from '@tagai/miniapp-sdk';

const sdk = TagAI.init();

async function showWalletInfo() {
  const address = await sdk.wallet.getAddress();
  const balance = await sdk.wallet.getBalance();

  console.log(`Address: ${address}`);
  console.log(`Balance: ${balance.value} ${balance.symbol}`);
}

async function sendToken() {
  try {
    const hash = await sdk.wallet.sendTransaction({
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      value: '1000000000000000000' // 1 BNB
    });
    console.log('Transaction hash:', hash);
  } catch (error) {
    console.error('Transaction failed:', error);
  }
}

await sdk.actions.ready();
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
import TagAI, { MiniAppContext, SteemPostResult } from '@tagai/miniapp-sdk';

const sdk = TagAI.init();

const context: MiniAppContext = await sdk.context.getContext();
const post: SteemPostResult = await sdk.steem.post({
  title: 'Hello',
  body: 'World',
  tags: []
});
```

## Development

### Build SDK

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Build and watch for changes
npm run dev
```

### Output Files

- `dist/index.js` - CommonJS
- `dist/index.esm.js` - ES Module
- `dist/index.umd.js` - UMD (for browsers)
- `dist/index.umd.min.js` - Minified UMD
- `dist/types/` - TypeScript definitions

## Security

- All API calls are authenticated with JWT tokens
- Tokens are automatically managed and refreshed
- iframe sandbox isolation for security
- HTTPS required in production

## License

MIT

## Support

- Documentation: https://docs.tagai.com/miniapps
- GitHub: https://github.com/tagai/miniapp-sdk
- Discord: https://discord.gg/tagai
