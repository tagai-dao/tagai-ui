<script setup lang="ts">
import { computed } from 'vue'
import type { AiChannelMessage } from '@/types/aiChannel'
import { parseTimestamp, safeExternalUrl } from '@/utils/helper'

const props = defineProps<{
  message: AiChannelMessage
  isRoot?: boolean
  parentAuthor?: string
}>()

const messageUrl = computed(() => safeExternalUrl(props.message.xUrl))
const quotedUrl = computed(() => safeExternalUrl(props.message.quotedTweet?.xUrl))
</script>

<template>
  <article
    class="rounded-2xl border px-4 py-3"
    :class="isRoot
      ? 'bg-orange-light border-orange-normal/20'
      : 'bg-surface border-grey-light-hover'"
  >
    <div v-if="isRoot" class="text-xs font-bold uppercase tracking-wide text-orange-normal mb-2">
      {{ $t('aiChannelView.rootTopic') }}
    </div>
    <div v-if="parentAuthor && !isRoot" class="text-xs text-grey-8d mb-2">
      {{ $t('aiChannelView.replyingTo', { user: parentAuthor }) }}
    </div>

    <div class="flex items-start gap-3">
      <img
        v-if="message.author.profile"
        :src="message.author.profile"
        class="w-9 h-9 rounded-full object-cover bg-grey-f0"
        referrerpolicy="no-referrer"
        alt=""
      >
      <img
        v-else
        src="~@/assets/icons/icon-default-avatar.svg"
        class="w-9 h-9 rounded-full bg-grey-f0"
        alt=""
      >
      <div class="min-w-0 flex-1">
        <div class="flex items-center flex-wrap gap-x-2 gap-y-1">
          <span class="font-semibold">{{ message.author.name || message.author.username || 'Unknown' }}</span>
          <span class="text-sm text-grey-8d">@{{ message.author.username || 'unknown' }}</span>
          <span
            v-if="message.type === 'agent_reply'"
            class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold"
          >
            Agent
          </span>
          <span
            v-if="message.source === 'steem'"
            class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold"
          >
            Steem
          </span>
          <span class="text-xs text-grey-bd">{{ parseTimestamp(message.createdAt) }}</span>
          <a
            v-if="messageUrl"
            :href="messageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-auto"
            :title="$t('aiChannelView.openInX')"
          >
            <img src="~@/assets/icons/icon-x.svg" class="w-3.5 h-3.5" alt="X">
          </a>
        </div>

        <p class="mt-2 whitespace-pre-wrap break-words text-base leading-6">
          {{ message.content }}
        </p>

        <a
          v-if="message.quotedTweet"
          :href="quotedUrl"
          :target="quotedUrl ? '_blank' : undefined"
          rel="noopener noreferrer"
          class="block mt-3 rounded-xl border border-grey-light-hover bg-grey-f0 p-3"
        >
          <div class="flex items-center gap-2 text-sm">
            <span class="font-semibold">
              {{ message.quotedTweet.author.name || message.quotedTweet.author.username }}
            </span>
            <span class="text-grey-8d">@{{ message.quotedTweet.author.username }}</span>
            <span class="ml-auto text-xs text-grey-8d">{{ $t('aiChannelView.quotedFromX') }}</span>
          </div>
          <p class="mt-1 text-sm line-clamp-4 whitespace-pre-wrap">
            {{ message.quotedTweet.content }}
          </p>
        </a>

        <div
          v-if="message.source === 'steem' && message.publishState === 0"
          class="mt-2 text-xs text-grey-8d flex items-center gap-1"
        >
          <i-ep-loading class="w-3 h-3 animate-spin" />
          {{ $t('aiChannelView.publishingToSteem') }}
        </div>
        <div
          v-else-if="message.source === 'steem' && message.publishState === 2"
          class="mt-2 text-xs text-red"
        >
          {{ $t('aiChannelView.steemPublishFailed') }}
        </div>
      </div>
    </div>
  </article>
</template>
