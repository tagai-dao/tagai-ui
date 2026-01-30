<template>
  <div class="social-test-container">
    <div class="test-header">
      <h1>🚀 Social Actions - Twitter & Steem 主网测试</h1>
      <p>当前用户: {{ currentUser }}</p>
      <p class="warning">⚠️ 警告：这是真实环境，所有操作都会发布到 Twitter 和 Steem 区块链！</p>
    </div>

    <div class="content-grid three-cols">
      <!-- 第 1 列：Twitter -->
      <div class="content-column">
        <div class="test-section">
          <h2>🐦 Twitter</h2>

          <div class="test-group">
            <h3>👤 用户信息</h3>
            <button @click="testTwitterGetUser" class="test-btn">
              获取 Twitter 用户信息
            </button>
            <div v-if="twitterUser" class="user-info">
              <p><strong>用户名:</strong> @{{ twitterUser.username }}</p>
              <p><strong>显示名:</strong> {{ twitterUser.displayName }}</p>
              <p><strong>Twitter ID:</strong> {{ twitterUser.twitterId }}</p>
            </div>
          </div>

          <div class="test-group">
            <h3>📝 发布推文</h3>
            <div class="input-group">
              <label>推文内容:</label>
              <textarea
                v-model="tweetText"
                placeholder="写点什么... (最多 280 字符)"
                maxlength="280"
                class="test-textarea compact"
                rows="2"
              ></textarea>
              <p class="input-hint">{{ tweetText.length }}/280 字符</p>
            </div>
            <div class="input-group">
              <label>Tag (Community):</label>
              <input
                v-model="tweetTag"
                placeholder="输入 tag (例如: BUIDL)"
                class="test-input"
              />
              <p class="input-hint">必填,使用真实存在的 community tag</p>
            </div>
            <button @click="testTwitterPost" class="test-btn primary">
              🚀 发布到 Twitter
            </button>
            <div v-if="lastTweetId" class="result-box success">
              <p><strong>✅ 推文已发布！</strong></p>
              <p>Tweet ID: <code>{{ lastTweetId }}</code></p>
              <p v-if="lastTweetUrl">
                <a :href="lastTweetUrl" target="_blank">查看推文 →</a>
              </p>
            </div>
          </div>

          <div class="test-group">
            <h3>💬 互动操作</h3>
            <p class="info-hint">⚠️ 注意：点赞仅在 TagAI 平台生效;转发会真实操作 Twitter</p>
            <div class="input-group">
              <label>目标 Tweet ID:</label>
              <input
                v-model="targetTweetId"
                placeholder="输入 Tweet ID 或使用最后发布的推文"
                class="test-input"
              />
              <button
                v-if="lastTweetId"
                @click="targetTweetId = lastTweetId"
                class="use-last-btn"
              >
                用最后推文
              </button>
            </div>
            <div class="input-group">
              <label>Community Tag (用于转发):</label>
              <input
                v-model="interactionTag"
                placeholder="留空或输入 tag"
                class="test-input"
              />
            </div>
            <div class="button-row">
              <button @click="testTwitterLike" class="test-btn">
                ❤️ 点赞
              </button>
              <button @click="testTwitterRetweet" class="test-btn">
                🔄 转发
              </button>
            </div>
            <div class="input-group">
              <label>回复内容:</label>
              <textarea
                v-model="replyText"
                placeholder="写一条回复..."
                maxlength="280"
                class="test-textarea compact"
                rows="1"
              ></textarea>
            </div>
            <button @click="testTwitterReply" class="test-btn">
              💬 回复推文
            </button>
          </div>

          <div class="test-group">
            <h3>🔗 分享</h3>
            <div class="input-group">
              <label>分享 URL:</label>
              <input
                v-model="shareUrl"
                placeholder="https://example.com"
                class="test-input"
              />
            </div>
            <div class="input-group">
              <label>分享文本:</label>
              <input
                v-model="shareText"
                placeholder="分享描述..."
                class="test-input"
              />
            </div>
            <button @click="testTwitterShare" class="test-btn">
              🔗 分享到 Twitter
            </button>
          </div>
        </div>
      </div>

      <!-- 第 2 列：Steem 发帖与投票 -->
      <div class="content-column">
        <div class="test-section">
          <h2>⛓️ Steem</h2>

          <div class="test-group">
            <h3>👤 Steem 账户</h3>
            <button @click="testSteemCheck" class="test-btn">
              检查 Steem 账户
            </button>
            <div v-if="steemAccount" class="user-info">
              <p><strong>Steem ID:</strong> {{ steemAccount.username }}</p>
              <p><strong>状态:</strong> {{ steemAccount.hasAccount ? '✅ 已创建' : '❌ 未创建' }}</p>
            </div>
          </div>

          <div class="test-group">
            <h3>📝 发布帖子</h3>
            <div class="input-group">
              <label>标题:</label>
              <input
                v-model="steemTitle"
                placeholder="输入标题..."
                class="test-input"
              />
            </div>
            <div class="input-group">
              <label>内容:</label>
              <textarea
                v-model="steemBody"
                placeholder="支持 Markdown..."
                class="test-textarea compact"
                rows="2"
              ></textarea>
            </div>
            <div class="input-group">
              <label>标签:</label>
              <input
                v-model="steemTags"
                placeholder="crypto,blockchain,web3"
                class="test-input"
              />
            </div>
            <button @click="testSteemPost" class="test-btn primary">
              🚀 发布到 Steem 区块链
            </button>
            <div v-if="lastSteemPost" class="result-box success">
              <p><strong>✅ 帖子已发布到 Steem！</strong></p>
              <p>Permlink: <code>{{ lastSteemPost.permlink }}</code></p>
              <p v-if="lastSteemPost.url">
                <a :href="lastSteemPost.url" target="_blank">查看帖子 →</a>
              </p>
            </div>
          </div>

          <div class="test-group">
            <h3>👍 投票/点赞</h3>
            <div class="input-group">
              <label>作者:</label>
              <input
                v-model="voteAuthor"
                placeholder="作者用户名"
                class="test-input"
              />
            </div>
            <div class="input-group">
              <label>Permlink:</label>
              <input
                v-model="votePermlink"
                placeholder="帖子 permlink"
                class="test-input"
              />
              <button
                v-if="lastSteemPost"
                @click="useLastSteemPost"
                class="use-last-btn"
              >
                用最后帖子
              </button>
            </div>
            <div class="input-group">
              <label>投票权重 (0-100):</label>
              <input
                v-model.number="voteWeight"
                type="number"
                min="0"
                max="100"
                class="test-input"
              />
              <p class="input-hint">当前: {{ voteWeight }}% (10000 = 100%)</p>
            </div>
            <button @click="testSteemVote" class="test-btn">
              👍 投票
            </button>
          </div>
        </div>
      </div>

      <!-- 第 3 列：Steem 评论/转发 + 日志 -->
      <div class="content-column">
        <div class="test-section">
          <h2>⛓️ Steem 更多</h2>

          <div class="test-group">
            <h3>💬 评论/回复</h3>
            <div class="input-group">
              <label>评论:</label>
              <textarea
                v-model="commentBody"
                placeholder="写一条评论..."
                class="test-textarea compact"
                rows="1"
              ></textarea>
            </div>
            <button @click="testSteemComment" class="test-btn">
              💬 发布评论
            </button>
          </div>

          <div class="test-group">
            <h3>🔄 转发</h3>
            <button @click="testSteemReblog" class="test-btn">
              🔄 转发到我的博客
            </button>
          </div>
        </div>

        <div class="test-section log-section">
          <h2>📋 日志</h2>
          <div class="log-container">
            <div
              v-for="(log, index) in logs"
              :key="index"
              :class="['log-entry', log.type]"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
          <button @click="clearLogs" class="clear-btn">清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { sdk } from '@/sdk/miniapp-sdk/src/index';

// ==========================================
// State
// ==========================================
const logs = ref<Array<{ time: string; message: string; type: string }>>([]);

// Twitter State
const twitterUser = ref<any>(null);
const tweetText = ref('');
const tweetTag = ref('BUIDL'); // Tag/Community for the tweet - 默认使用 BUIDL
const lastTweetId = ref('');
const lastTweetUrl = ref('');
const targetTweetId = ref('');
const interactionTag = ref(''); // Tag for like/retweet operations
const replyText = ref('');
const shareUrl = ref('https://tiptag.app');
const shareText = ref('Check out TagAI - Web3 Social Platform! 🚀');

// Steem State
const steemAccount = ref<any>(null);
const steemTitle = ref('');
const steemBody = ref('');
const steemTags = ref('tagai,web3,blockchain');
const lastSteemPost = ref<any>(null);
const voteAuthor = ref('');
const votePermlink = ref('');
const voteWeight = ref(100);
const commentBody = ref('');

const currentUser = computed(() => {
  if (twitterUser.value) {
    return `@${twitterUser.value.username}${steemAccount.value?.username ? ` (Steem: ${steemAccount.value.username})` : ''}`;
  }
  return '未登录';
});

// ==========================================
// Helpers
// ==========================================
function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 50) {
    logs.value = logs.value.slice(0, 50);
  }
  console.log(`[${time}] ${message}`);
}

function clearLogs() {
  logs.value = [];
}

function useLastSteemPost() {
  if (lastSteemPost.value) {
    voteAuthor.value = lastSteemPost.value.author;
    votePermlink.value = lastSteemPost.value.permlink;
  }
}

// 从 Twitter URL 中提取 Tweet ID
function extractTweetId(input: string): string {
  if (!input) return '';

  // 如果已经是纯数字 ID,直接返回
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }

  // 从 URL 中提取 ID
  // 支持格式:
  // - https://twitter.com/username/status/1234567890
  // - https://x.com/username/status/1234567890
  // - twitter.com/username/status/1234567890
  const match = input.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (match && match[1]) {
    return match[1];
  }

  // 如果无法提取,返回原始输入
  return input.trim();
}

// ==========================================
// Twitter Tests
// ==========================================
async function testTwitterGetUser() {
  log('获取 Twitter 用户信息...');
  try {
    const user = await sdk.twitter.getUser();
    twitterUser.value = user;
    log(`✅ 用户信息: @${user.username}`, 'success');
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testTwitterPost() {
  if (!tweetText.value) {
    log('❌ 请输入推文内容', 'error');
    return;
  }

  if (!tweetTag.value) {
    log('❌ 请输入 Tag (Community)', 'error');
    return;
  }

  log(`发布推文到 Twitter (Tag: ${tweetTag.value})...`);
  try {
    const result = await sdk.twitter.post({
      text: tweetText.value,
      community: tweetTag.value // 传递 community tag
    });
    lastTweetId.value = result.tweetId;
    lastTweetUrl.value = result.url;
    log(`✅ 推文发布成功！Tweet ID: ${result.tweetId}`, 'success');
    log(`   Tag: ${tweetTag.value}`, 'info');
    log(`   URL: ${result.url}`, 'info');

    // 清空推文内容,但保留 tag
    tweetText.value = '';
  } catch (error: any) {
    log(`❌ 发布失败: ${error.message}`, 'error');
  }
}

async function testTwitterLike() {
  const rawInput = targetTweetId.value || lastTweetId.value;
  if (!rawInput) {
    log('❌ 请先发布推文或输入 Tweet ID', 'error');
    return;
  }

  // 从 URL 中提取纯数字 ID
  const tweetId = extractTweetId(rawInput);
  if (!tweetId) {
    log('❌ 无法提取有效的 Tweet ID', 'error');
    return;
  }

  const tag = interactionTag.value || '';
  log(`点赞推文: ${tweetId} (Tag: ${tag || '无'})...`);
  try {
    await sdk.twitter.like(tweetId, tag);
    log('✅ 点赞成功 (仅 TagAI 平台)', 'success');
  } catch (error: any) {
    log(`❌ 点赞失败: ${error.message}`, 'error');
  }
}

async function testTwitterRetweet() {
  const rawInput = targetTweetId.value || lastTweetId.value;
  if (!rawInput) {
    log('❌ 请先发布推文或输入 Tweet ID', 'error');
    return;
  }

  // 从 URL 中提取纯数字 ID
  const tweetId = extractTweetId(rawInput);
  if (!tweetId) {
    log('❌ 无法提取有效的 Tweet ID', 'error');
    return;
  }

  const tag = interactionTag.value || tweetTag.value;
  log(`转发推文到 Twitter: ${tweetId} (Tag: ${tag})...`);
  try {
    await sdk.twitter.retweet(tweetId, tag);
    log('✅ 转发成功 (已发布到 Twitter)', 'success');
  } catch (error: any) {
    log(`❌ 转发失败: ${error.message}`, 'error');
  }
}

async function testTwitterReply() {
  const rawInput = targetTweetId.value || lastTweetId.value;
  if (!rawInput) {
    log('❌ 请先发布推文或输入 Tweet ID', 'error');
    return;
  }
  if (!replyText.value) {
    log('❌ 请输入回复内容', 'error');
    return;
  }

  // 从 URL 中提取纯数字 ID
  const tweetId = extractTweetId(rawInput);
  if (!tweetId) {
    log('❌ 无法提取有效的 Tweet ID', 'error');
    return;
  }

  log(`回复推文: ${tweetId}...`);
  try {
    const result = await sdk.twitter.reply(tweetId, replyText.value);
    log(`✅ 回复成功！URL: ${result.url}`, 'success');
    replyText.value = '';
  } catch (error: any) {
    log(`❌ 回复失败: ${error.message}`, 'error');
  }
}

async function testTwitterShare() {
  if (!shareUrl.value) {
    log('❌ 请输入分享 URL', 'error');
    return;
  }

  log('打开 Twitter 分享...');
  try {
    await sdk.twitter.share({
      url: shareUrl.value,
      text: shareText.value
    });
    log('✅ 分享窗口已打开', 'success');
  } catch (error: any) {
    log(`❌ 分享失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Steem Tests
// ==========================================
async function testSteemCheck() {
  log('获取 Steem 账户信息...');
  try {
    // Steem SDK 没有 checkAccount 方法，我们从用户信息中获取
    const context = await sdk.context;
    if (context.user) {
      // 从用户 context 中获取 Steem 信息
      steemAccount.value = {
        username: context.user.steemId || 'Not set',
        hasAccount: !!context.user.steemId
      };
      log(`✅ Steem 账户: ${steemAccount.value.username}`, 'success');
    } else {
      log('⚠️ 无法获取用户信息', 'error');
    }
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testSteemPost() {
  if (!steemTitle.value || !steemBody.value) {
    log('❌ 请输入标题和内容', 'error');
    return;
  }

  log('发布帖子到 Steem 区块链...');
  try {
    const tags = steemTags.value.split(',').map(t => t.trim()).filter(t => t);
    const result = await sdk.steem.post({
      title: steemTitle.value,
      body: steemBody.value,
      tags
    });
    lastSteemPost.value = result;
    log(`✅ 帖子已发布到 Steem！`, 'success');
    log(`   Permlink: ${result.permlink}`, 'info');
    log(`   URL: ${result.url}`, 'info');

    // 自动填充到投票区域
    voteAuthor.value = result.author;
    votePermlink.value = result.permlink;

    // 清空输入
    steemTitle.value = '';
    steemBody.value = '';
  } catch (error: any) {
    log(`❌ 发布失败: ${error.message}`, 'error');
  }
}

async function testSteemVote() {
  if (!voteAuthor.value || !votePermlink.value) {
    log('❌ 请输入作者和 permlink', 'error');
    return;
  }

  log(`投票: @${voteAuthor.value}/${votePermlink.value} (${voteWeight.value}%)...`);
  try {
    // SDK vote 方法签名: vote(author, permlink, weight)
    // weight: 0-10000 (100% = 10000)
    const weight = Math.floor(voteWeight.value * 100);
    await sdk.steem.vote(voteAuthor.value, votePermlink.value, weight);
    log('✅ 投票成功', 'success');
  } catch (error: any) {
    log(`❌ 投票失败: ${error.message}`, 'error');
  }
}

async function testSteemComment() {
  if (!voteAuthor.value || !votePermlink.value) {
    log('❌ 请先选择要评论的帖子', 'error');
    return;
  }
  if (!commentBody.value) {
    log('❌ 请输入评论内容', 'error');
    return;
  }

  log(`评论: @${voteAuthor.value}/${votePermlink.value}...`);
  try {
    // SDK comment 方法需要一个 options 对象
    const result = await sdk.steem.comment({
      parentAuthor: voteAuthor.value,
      parentPermlink: votePermlink.value,
      body: commentBody.value
    });
    log(`✅ 评论成功！`, 'success');
    if (result.permlink) {
      log(`   Permlink: ${result.permlink}`, 'info');
    }
    if (result.url) {
      log(`   URL: ${result.url}`, 'info');
    }
    commentBody.value = '';
  } catch (error: any) {
    log(`❌ 评论失败: ${error.message}`, 'error');
  }
}

async function testSteemReblog() {
  if (!voteAuthor.value || !votePermlink.value) {
    log('❌ 请先选择要转发的帖子', 'error');
    return;
  }

  log(`转发: @${voteAuthor.value}/${votePermlink.value}...`);
  try {
    // SDK reblog 方法签名: reblog(author, permlink)
    await sdk.steem.reblog(voteAuthor.value, votePermlink.value);
    log('✅ 转发成功', 'success');
  } catch (error: any) {
    log(`❌ 转发失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Lifecycle
// ==========================================
onMounted(async () => {
  console.log('[MainnetSocialTest] Component mounted');
  try {
    log('SDK 已加载', 'success');
    console.log('[MainnetSocialTest] SDK:', sdk);

    // 自动获取用户信息
    console.log('[MainnetSocialTest] Getting Twitter user...');
    await testTwitterGetUser();

    // 通知 Host: Mini App 已准备就绪,可以隐藏 splash screen
    await sdk.actions.ready({ splashDuration: 300 });

    console.log('[MainnetSocialTest] Initialization complete');
  } catch (error: any) {
    log(`初始化失败: ${error.message}`, 'error');
    console.error('[MainnetSocialTest] Initialization error:', error);
  }
});
</script>

<style scoped>
.social-test-container {
  padding: 10px 12px;
  max-width: 100%;
  margin: 0 auto;
  background: #f9fafb;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 12px;
}

.test-header {
  text-align: center;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.test-header h1 {
  font-size: 16px;
  margin: 0 0 4px 0;
  color: #1f2937;
}

.test-header p {
  margin: 2px 0;
  color: #6b7280;
  font-size: 11px;
}

.warning {
  color: #f59e0b !important;
  font-weight: 600;
  background: #fef3c7;
  padding: 4px 10px;
  border-radius: 4px;
  display: inline-block;
  font-size: 10px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.content-grid.three-cols {
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.content-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.test-section {
  background: white;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.test-section h2 {
  font-size: 14px;
  margin: 0 0 8px 0;
  color: #1f2937;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 6px;
}

.test-group {
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.test-group:last-child {
  margin-bottom: 0;
}

.test-group h3 {
  font-size: 12px;
  margin: 0 0 6px 0;
  color: #374151;
}

.input-group {
  margin-bottom: 8px;
}

.input-group label {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 500;
  color: #374151;
}

.test-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  transition: border-color 0.2s;
}

.test-input:focus {
  outline: none;
  border-color: #1d9bf0;
  box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.1);
}

.test-textarea {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
  resize: vertical;
  min-height: 1.6em;
  transition: border-color 0.2s;
}

.test-textarea.compact {
  min-height: 0;
  resize: none;
}

.test-textarea.compact[rows="1"] {
  height: 1.6rem;
  line-height: 1.2;
}

.test-textarea.compact[rows="2"] {
  height: 2.8rem;
}

.test-textarea:focus {
  outline: none;
  border-color: #1d9bf0;
  box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.1);
}

.input-hint {
  margin: 1px 0 0 0;
  font-size: 10px;
  color: #6b7280;
}

.info-hint {
  margin: 0 0 6px 0;
  padding: 4px 8px;
  font-size: 10px;
  color: #d97706;
  background: #fef3c7;
  border-left: 2px solid #f59e0b;
  border-radius: 3px;
}

.test-btn {
  padding: 5px 10px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: #374151;
  margin-right: 4px;
  margin-bottom: 4px;
}

.test-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.test-btn.primary {
  background: #1d9bf0;
  color: white;
  border-color: #1d9bf0;
}

.test-btn.primary:hover {
  background: #1a8cd8;
}

.button-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.use-last-btn {
  margin-top: 2px;
  padding: 3px 8px;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  color: #1d4ed8;
  transition: all 0.2s;
}

.use-last-btn:hover {
  background: #dbeafe;
}

.user-info {
  margin-top: 6px;
  padding: 6px 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.user-info p {
  margin: 2px 0;
  font-size: 10px;
  color: #374151;
}

.user-info strong {
  color: #1f2937;
}

.result-box {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 10px;
}

.result-box.success {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
}

.result-box p {
  margin: 2px 0;
}

.result-box code {
  background: rgba(0, 0, 0, 0.1);
  padding: 1px 4px;
  border-radius: 2px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 10px;
}

.result-box a {
  color: #1d9bf0;
  text-decoration: none;
  font-weight: 500;
}

.result-box a:hover {
  text-decoration: underline;
}

.log-section {
  margin-top: 0;
}

.log-section h2 {
  font-size: 14px;
  margin: 0 0 6px 0;
}

.log-container {
  max-height: 120px;
  overflow-y: auto;
  background: #1f2937;
  border-radius: 4px;
  padding: 6px 8px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 10px;
}

.log-entry {
  margin-bottom: 1px;
  padding: 2px 4px;
  border-radius: 2px;
}

.log-entry.info {
  color: #93c5fd;
}

.log-entry.success {
  color: #86efac;
}

.log-entry.error {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
}

.log-time {
  color: #9ca3af;
  margin-right: 4px;
}

.clear-btn {
  margin-top: 6px;
  padding: 4px 10px;
  background: #374151;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.clear-btn:hover {
  background: #4b5563;
}

@media (max-width: 1200px) {
  .content-grid.three-cols {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .content-grid,
  .content-grid.three-cols {
    grid-template-columns: 1fr;
  }
}
</style>
