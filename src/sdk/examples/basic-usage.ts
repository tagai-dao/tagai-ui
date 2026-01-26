/**
 * TagAI Mini App SDK - Basic Usage Examples
 *
 * This file demonstrates how to use the TagAI Mini App SDK
 * in a Mini App context.
 */

import sdk from '../miniapp-sdk/src';

// ==========================================
// Initialization
// ==========================================

async function initMiniApp() {
  // Check if running in Mini App environment
  const isInMiniApp = await sdk.isInMiniApp();

  if (!isInMiniApp) {
    console.log('Not running in TagAI Mini App');
    return;
  }

  // Signal that the app is ready
  await sdk.actions.ready({
    splashDuration: 500, // Show splash for 500ms
  });

  // Get context (user info, location, etc.)
  const context = await sdk.context;
  console.log('User:', context.user);
  console.log('Location:', context.location);
}

// ==========================================
// Authentication
// ==========================================

async function authenticateUser() {
  // Get JWT token for API calls
  const { token, expiresAt } = await sdk.auth.getToken();
  console.log('Token expires at:', new Date(expiresAt));

  // Use authenticated fetch for API calls
  const response = await sdk.auth.fetch('/api/user/profile');
  const profile = await response.json();
  console.log('Profile:', profile);

  // Sign in with Ethereum (SIWE)
  const signInResult = await sdk.auth.signIn({
    nonce: 'custom-nonce-123', // Optional, auto-generated if not provided
  });
  console.log('Signed message:', signInResult.message);
  console.log('Signature:', signInResult.signature);
}

// ==========================================
// Wallet Operations
// ==========================================

async function walletOperations() {
  // Get wallet address
  const address = await sdk.wallet.getAddress();
  console.log('Wallet address:', address);

  // Get BNB balance
  const balance = await sdk.wallet.getBalance();
  console.log('Balance:', balance.formatted, balance.symbol);

  // Sign a message
  const signature = await sdk.wallet.signMessage('Hello, TagAI!');
  console.log('Signature:', signature);

  // Send a transaction
  const txHash = await sdk.wallet.sendTransaction({
    to: '0x...',
    value: BigInt('1000000000000000'), // 0.001 BNB
  });
  console.log('Transaction hash:', txHash);
}

// ==========================================
// DeFi Actions
// ==========================================

async function defiActions() {
  // View token details
  await sdk.actions.viewToken({
    token: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955', // USDT on BSC
  });

  // Swap tokens
  const swapResult = await sdk.actions.swapToken({
    sellToken: 'eip155:56/native', // BNB
    buyToken: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955', // USDT
    sellAmount: '100000000000000000', // 0.1 BNB
  });

  if (swapResult.success) {
    console.log('Swap transactions:', swapResult.swap.transactions);
  } else {
    console.log('Swap failed:', swapResult.reason);
  }

  // Send tokens
  const sendResult = await sdk.actions.sendToken({
    token: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
    amount: '1000000000000000000', // 1 USDT
    recipientAddress: '0x...',
  });

  if (sendResult.success) {
    console.log('Send transaction:', sendResult.send.transaction);
  }
}

// ==========================================
// Steem Social (TagAI-specific)
// ==========================================

async function steemActions() {
  // Create a post
  const postResult = await sdk.steem.post({
    title: 'My First Mini App Post',
    body: 'This is content created from a TagAI Mini App!',
    tags: ['tagai', 'miniapp'],
    crossPostTwitter: true, // Also post to Twitter
  });
  console.log('Post URL:', postResult.url);

  // Vote on a post
  await sdk.steem.vote('author', 'permlink', 10000); // 100% upvote

  // Comment on a post
  const commentResult = await sdk.steem.comment({
    parentAuthor: 'author',
    parentPermlink: 'permlink',
    body: 'Great post!',
  });
  console.log('Comment:', commentResult.permlink);

  // Reblog a post
  await sdk.steem.reblog('author', 'permlink');
}

// ==========================================
// Twitter Integration (TagAI-specific)
// ==========================================

async function twitterActions() {
  // Check if Twitter is connected
  const isConnected = await sdk.twitter.isConnected();
  console.log('Twitter connected:', isConnected);

  if (isConnected) {
    // Get user info
    const user = await sdk.twitter.getUser();
    console.log('Twitter user:', user);

    // Post a tweet
    const postResult = await sdk.twitter.post({
      text: 'Hello from TagAI Mini App! #TagAI #Web3',
    });
    console.log('Tweet URL:', postResult.url);
  }

  // Share via Twitter (works even without connection)
  await sdk.twitter.share({
    url: 'https://tagai.app',
    text: 'Check out TagAI!',
    hashtags: ['TagAI', 'Web3'],
  });
}

// ==========================================
// Actions
// ==========================================

async function appActions() {
  // Open a URL
  await sdk.actions.openUrl('https://example.com');

  // View a user profile
  await sdk.actions.viewProfile('username');

  // View a post
  await sdk.actions.viewPost('author', 'permlink');

  // Open compose dialog
  const composeResult = await sdk.actions.compose({
    text: 'Pre-filled text',
    tags: ['tag1', 'tag2'],
  });
  console.log('Posted:', composeResult.posted);

  // Share content
  await sdk.actions.share({
    url: 'https://tagai.app/post/123',
    text: 'Check this out!',
  });

  // Add Mini App to user's list
  const { added } = await sdk.actions.addMiniApp();
  console.log('Mini App added:', added);

  // Open another Mini App
  await sdk.actions.openMiniApp({
    domain: 'other-app.tagai.app',
    url: '/specific-page',
  });

  // Close the Mini App
  await sdk.actions.close();
}

// ==========================================
// UI Controls
// ==========================================

async function uiControls() {
  // Set primary button
  await sdk.actions.setPrimaryButton({
    text: 'Submit',
    enabled: true,
    loading: false,
  });

  // Listen for button click
  sdk.on('primaryButtonClicked', () => {
    console.log('Primary button clicked!');
  });

  // Update button state
  await sdk.actions.setPrimaryButton({
    text: 'Processing...',
    loading: true,
  });
}

// ==========================================
// Haptics
// ==========================================

async function hapticsExample() {
  // Impact feedback
  await sdk.haptics.impactOccurred('medium');

  // Notification feedback
  await sdk.haptics.notificationOccurred('success');

  // Selection changed
  await sdk.haptics.selectionChanged();
}

// ==========================================
// Back Navigation
// ==========================================

async function backNavigationExample() {
  // Enable back with custom handler
  await sdk.back.enable(async () => {
    console.log('Custom back handler');
    // Navigate to previous page in your app
    // router.back();
  });

  // Listen for back navigation
  sdk.on('backNavigationTriggered', () => {
    console.log('Back navigation triggered');
  });

  // Programmatically go back
  await sdk.back.goBack();

  // Disable back navigation
  await sdk.back.disable();
}

// ==========================================
// Notifications
// ==========================================

async function notificationsExample() {
  // Check if enabled
  const isEnabled = await sdk.notifications.isEnabled();
  console.log('Notifications enabled:', isEnabled);

  // Request permission and subscribe
  try {
    const token = await sdk.notifications.subscribe();
    console.log('Notification token:', token);
  } catch (error) {
    console.log('Failed to subscribe:', error);
  }

  // Listen for notification events
  sdk.on('notificationsEnabled', (event) => {
    console.log('Notifications enabled:', event.notificationDetails);
  });

  sdk.on('notificationsDisabled', () => {
    console.log('Notifications disabled');
  });
}

// ==========================================
// Platform Capabilities
// ==========================================

async function platformCapabilities() {
  // Get all capabilities
  const capabilities = await sdk.platform.getCapabilities();
  console.log('Capabilities:', capabilities);

  // Check specific capability
  const hasSwap = await sdk.platform.hasCapability('actions.swapToken');
  console.log('Has swap:', hasSwap);

  // Get supported chains
  const chains = await sdk.platform.getChains();
  console.log('Chains:', chains);

  // Get SDK version
  const version = sdk.platform.getVersion();
  console.log('SDK version:', version);

  // Check development mode
  const isDev = sdk.platform.isDevelopment();
  console.log('Development mode:', isDev);

  // Listen for app state changes
  const unsubscribe = sdk.platform.onAppStateChange((state) => {
    console.log('App state:', state);
  });

  // Cleanup
  unsubscribe();
}

// ==========================================
// Event Handling
// ==========================================

function eventHandling() {
  // Mini App lifecycle events
  sdk.on('miniAppAdded', (event) => {
    console.log('Mini App added!', event.notificationDetails);
  });

  sdk.on('miniAppAddRejected', (event) => {
    console.log('Mini App add rejected:', event.reason);
  });

  sdk.on('miniAppRemoved', () => {
    console.log('Mini App removed');
  });

  // Cleanup
  sdk.removeAllListeners();
}

// Export for use in components
export {
  initMiniApp,
  authenticateUser,
  walletOperations,
  defiActions,
  steemActions,
  twitterActions,
  appActions,
  uiControls,
  hapticsExample,
  backNavigationExample,
  notificationsExample,
  platformCapabilities,
  eventHandling,
};
