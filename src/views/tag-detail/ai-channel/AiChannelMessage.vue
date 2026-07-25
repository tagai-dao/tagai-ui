<script setup lang="ts">
import { computed } from 'vue'
import type {
  AiChannelMessage,
  AiChannelReactionType,
} from '@/types/aiChannel'
import { parseTimestamp, safeExternalUrl } from '@/utils/helper'

const props = defineProps<{
  message: AiChannelMessage
  isRoot?: boolean
  parentAuthor?: string
}>()

const emit = defineEmits<{
  reply: [message: AiChannelMessage]
  react: [reaction: AiChannelReactionType, active: boolean]
}>()

const reactionOptions: Array<{
  type: AiChannelReactionType
  emoji: string
  label: string
}> = [
  { type: 'like', emoji: '👍🏻', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Laugh' },
]

const messageUrl = computed(() => safeExternalUrl(props.message.xUrl))
const quotedUrl = computed(() => safeExternalUrl(props.message.quotedTweet?.xUrl))
const visibleReactions = computed(() =>
  reactionOptions
    .map((option) => ({
      ...option,
      ...(props.message.reactions || []).find((item) => item.type === option.type),
    }))
    .filter((item) => Number(item.count || 0) > 0),
)

const toggleReaction = (reaction: AiChannelReactionType) => {
  const current = (props.message.reactions || [])
    .find((item) => item.type === reaction)
  emit('react', reaction, !current?.reactedByMe)
}
</script>

<template>
  <article
    class="group relative rounded-2xl border px-4 py-3"
    :class="isRoot
      ? 'bg-orange-light border-orange-normal/20'
      : 'bg-surface border-grey-light-hover'"
  >
    <div
      class="absolute z-10 right-3 -top-3 flex items-center gap-0.5 rounded-full border border-grey-light-hover bg-white px-1 py-0.5 shadow-md opacity-100 web:opacity-0 web:pointer-events-none web:group-hover:opacity-100 web:group-hover:pointer-events-auto web:group-focus-within:opacity-100 web:group-focus-within:pointer-events-auto transition-opacity"
    >
      <button
        v-for="option in reactionOptions"
        :key="option.type"
        type="button"
        class="h-8 min-w-8 px-1 rounded-full hover:bg-grey-f0 flex items-center justify-center text-base"
        :aria-label="option.label"
        :title="option.label"
        @click.stop="toggleReaction(option.type)"
      >
        {{ option.emoji }}
      </button>
      <span class="w-px h-5 bg-grey-light-hover mx-0.5" />
      <button
        type="button"
        class="h-8 px-2 rounded-full hover:bg-grey-f0 flex items-center gap-1 text-sm font-semibold"
        :aria-label="$t('aiChannelView.reply')"
        :title="$t('aiChannelView.reply')"
        @click.stop="emit('reply', message)"
      >
        <i-ep-chat-line-round class="w-4 h-4" />
        <span>{{ $t('aiChannelView.reply') }}</span>
      </button>
    </div>

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

        <div v-if="visibleReactions.length" class="mt-3 flex flex-wrap gap-1.5">
          <button
            v-for="reaction in visibleReactions"
            :key="reaction.type"
            type="button"
            class="h-7 rounded-full border px-2 flex items-center gap-1 text-sm transition-colors"
            :class="reaction.reactedByMe
              ? 'border-orange-normal bg-orange-light text-orange-normal'
              : 'border-grey-light-hover bg-white hover:bg-grey-f0'"
            :aria-label="reaction.label"
            @click.stop="toggleReaction(reaction.type)"
          >
            <span>{{ reaction.emoji }}</span>
            <span>{{ reaction.count }}</span>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
