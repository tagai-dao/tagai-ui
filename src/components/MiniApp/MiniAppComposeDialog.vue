<template>
  <div v-if="visible" class="compose-dialog-overlay" @click.self="handleClose">
    <div class="compose-dialog">
      <!-- Header -->
      <div class="compose-header">
        <button class="close-btn" @click="handleClose">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <h2 class="compose-title">{{ title || 'New Post' }}</h2>
        <button
          class="submit-btn"
          :class="{ disabled: !canSubmit }"
          :disabled="!canSubmit || submitting"
          @click="handleSubmit"
        >
          <span v-if="submitting" class="loading-spinner"></span>
          <span v-else>{{ submitButtonText || 'Post' }}</span>
        </button>
      </div>

      <!-- Content -->
      <div class="compose-content">
        <!-- User Info -->
        <div class="user-info">
          <img :src="userProfile" alt="Profile" class="user-avatar" />
          <div class="user-details">
            <div class="user-name">{{ userName }}</div>
            <div class="user-username">@{{ userUsername }}</div>
          </div>
        </div>

        <!-- Embedded Content (optional) -->
        <div v-if="embed" class="embedded-content">
          <div class="embed-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 100 10A5 5 0 008 3zM3 8a5 5 0 1110 0A5 5 0 013 8z"/>
            </svg>
            <span>{{ embed.url }}</span>
          </div>
          <div class="embed-preview">
            <iframe
              v-if="embed.type === 'miniapp'"
              :src="embed.url"
              sandbox="allow-scripts allow-same-origin"
              class="embed-iframe"
            ></iframe>
            <div v-else-if="embed.metadata" class="embed-card">
              <img
                v-if="embed.metadata.image"
                :src="embed.metadata.image"
                alt="Preview"
                class="embed-image"
              />
              <div class="embed-text">
                <div class="embed-title">{{ embed.metadata.title }}</div>
                <div class="embed-description">{{ embed.metadata.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Text Input -->
        <textarea
          ref="textareaRef"
          v-model="text"
          :placeholder="placeholder || 'What\'s happening?'"
          class="compose-textarea"
          :maxlength="maxLength"
          @input="handleInput"
        ></textarea>

        <!-- Character Count -->
        <div class="compose-footer">
          <div class="char-count" :class="{ warning: text.length > maxLength - 50 }">
            {{ text.length }} / {{ maxLength }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useAccountStore } from '@/stores/web3';

interface Embed {
  url: string;
  type?: 'miniapp' | 'url';
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

interface Props {
  visible: boolean;
  title?: string;
  text?: string;
  placeholder?: string;
  submitButtonText?: string;
  maxLength?: number;
  embed?: Embed;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  maxLength: 280,
});

const emit = defineEmits<{
  close: [];
  submit: [text: string];
}>();

const accountStore = useAccountStore();

// Refs
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const text = ref(props.text || '');
const submitting = ref(false);

// User info
const userName = computed(() => accountStore.getAccountInfo?.twitterName || 'User');
const userUsername = computed(() => accountStore.getAccountInfo?.twitterUsername || 'username');
const userProfile = computed(() => accountStore.getAccountInfo?.profile || '');

// Validation
const canSubmit = computed(() => {
  return text.value.trim().length > 0 && text.value.length <= props.maxLength;
});

// Watch visibility to focus textarea
watch(() => props.visible, async (newValue) => {
  if (newValue) {
    await nextTick();
    textareaRef.value?.focus();
  }
});

// Watch initial text prop
watch(() => props.text, (newValue) => {
  if (newValue !== undefined) {
    text.value = newValue;
  }
});

function handleInput() {
  // Auto-resize textarea
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
  }
}

function handleClose() {
  emit('close');
}

async function handleSubmit() {
  if (!canSubmit.value || submitting.value) {
    return;
  }

  submitting.value = true;

  try {
    emit('submit', text.value);
    // Don't reset or close here - let parent handle it
  } catch (error) {
    console.error('Submit error:', error);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.compose-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.compose-dialog {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.compose-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #111827;
}

.compose-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  flex: 1;
  text-align: center;
}

.submit-btn {
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn:hover:not(.disabled) {
  background: linear-gradient(213.44deg, #FF7A00 -14.77%, #FCA454 116.22%);
}

.submit-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.compose-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.user-info {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.user-details {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.user-name {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
}

.user-username {
  color: #6b7280;
  font-size: 14px;
}

.embedded-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
}

.embed-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 8px;
}

.embed-preview {
  border-radius: 8px;
  overflow: hidden;
}

.embed-iframe {
  width: 100%;
  height: 200px;
  border: none;
}

.embed-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.embed-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.embed-text {
  padding: 12px;
}

.embed-title {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
  margin-bottom: 4px;
}

.embed-description {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.4;
}

.compose-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 16px;
  line-height: 1.5;
  min-height: 100px;
  font-family: inherit;
  color: #111827;
}

.compose-textarea::placeholder {
  color: #9ca3af;
}

.compose-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.char-count {
  font-size: 12px;
  color: #6b7280;
}

.char-count.warning {
  color: #ef4444;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
