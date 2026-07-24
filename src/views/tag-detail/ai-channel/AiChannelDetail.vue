<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type {
  AiChannel,
  AiChannelDetail,
  AiChannelMessage,
  AiChannelQuoteDraft,
} from '@/types/aiChannel'
import { safeExternalUrl } from '@/utils/helper'
import AiChannelMessageCard from './AiChannelMessage.vue'

const props = defineProps<{
  channel: AiChannel
  detail?: AiChannelDetail | null
  loading?: boolean
  sending?: boolean
  quoteDraft?: AiChannelQuoteDraft | null
}>()

const emit = defineEmits<{
  back: []
  refresh: []
  send: [content: string]
  clearQuote: []
}>()

const content = ref('')
const timelineRef = ref<HTMLElement | null>(null)
const messages = computed(() => props.detail?.messages || [])
const messageById = computed(() => new Map(messages.value.map((message) => [message.id, message])))
const rootMessage = computed(() => messages.value.find((message) => message.type === 'root'))
const rootUrl = computed(() => safeExternalUrl(rootMessage.value?.xUrl))
const canSend = computed(() =>
  content.value.trim().length > 0
  && content.value.length <= 2000
  && !props.sending,
)

const parentAuthor = (message: AiChannelMessage) => {
  if (!message.parentId) return ''
  return messageById.value.get(message.parentId)?.author.username || ''
}

const submit = () => {
  if (!canSend.value) return
  emit('send', content.value.trim())
}

const clearComposer = () => {
  content.value = ''
}

defineExpose({ clearComposer })

watch(
  () => messages.value.length,
  async (length, previous) => {
    if (!length || length === previous) return
    await nextTick()
    timelineRef.value?.scrollTo({
      top: timelineRef.value.scrollHeight,
      behavior: previous ? 'smooth' : 'auto',
    })
  },
)
</script>

<template>
  <section class="h-full min-h-0 flex flex-col bg-surface border border-grey-light-hover rounded-2xl overflow-hidden">
    <header class="min-h-16 px-4 py-3 border-b border-grey-light-hover flex items-center gap-3">
      <button
        class="web:hidden w-8 h-8 rounded-full hover:bg-grey-f0 flex items-center justify-center"
        :aria-label="$t('aiChannelView.backToChannels')"
        @click="emit('back')"
      >
        <i-ep-arrow-left class="w-5 h-5" />
      </button>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-h2 font-bold">#</span>
          <h2 class="font-bold text-h2 truncate">{{ channel.summary }}</h2>
        </div>
        <p class="text-sm text-grey-8d truncate">
          {{ $t('aiChannelView.messageCount', { count: channel.messageCount }) }} · @{{ channel.agent?.username || 'TagAgent' }}
        </p>
      </div>
      <a
        v-if="rootUrl"
        :href="rootUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="h-9 px-3 rounded-full border border-grey-light-hover flex items-center gap-2 text-sm font-semibold"
      >
        <img src="~@/assets/icons/icon-x.svg" class="w-3.5 h-3.5" alt="">
        {{ $t('aiChannelView.openInX') }}
      </a>
      <button
        class="w-9 h-9 rounded-full hover:bg-grey-f0 flex items-center justify-center"
        :aria-label="$t('aiChannelView.refreshMessages')"
        @click="emit('refresh')"
      >
        <i-ep-refresh class="w-4 h-4" />
      </button>
    </header>

    <div ref="timelineRef" class="flex-1 min-h-0 overflow-y-auto no-scroll-bar px-3 web:px-4 py-4">
      <div v-if="loading && messages.length === 0" class="h-full flex items-center justify-center">
        <i-ep-loading class="w-7 h-7 animate-spin text-orange-normal" />
      </div>
      <div v-else class="flex flex-col gap-3">
        <AiChannelMessageCard
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :is-root="message.type === 'root'"
          :parent-author="parentAuthor(message)"
        />
      </div>
    </div>

    <footer class="border-t border-grey-light-hover p-3 web:p-4 bg-surface">
      <div
        v-if="quoteDraft"
        class="mb-2 rounded-xl border border-orange-normal/30 bg-orange-light p-3 flex items-start gap-3"
      >
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold text-orange-normal">{{ $t('aiChannelView.quotedFromX') }}</div>
          <div class="text-sm font-semibold mt-1">
            @{{ quoteDraft.twitterUsername || quoteDraft.twitterName || 'unknown' }}
          </div>
          <p class="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{{ quoteDraft.content }}</p>
        </div>
        <button
          class="w-7 h-7 rounded-full hover:bg-white/70 flex items-center justify-center"
          :aria-label="$t('aiChannelView.removeQuoted')"
          @click="emit('clearQuote')"
        >
          <i-ep-close class="w-4 h-4" />
        </button>
      </div>

      <div class="rounded-2xl border border-grey-light-hover focus-within:border-orange-normal bg-white px-3 py-2">
        <textarea
          v-model="content"
          rows="2"
          maxlength="2000"
          class="w-full max-h-36 resize-none outline-none text-base bg-transparent"
          :placeholder="$t('aiChannelView.messagePlaceholder', { channel: channel.summary })"
          @keydown.meta.enter.prevent="submit"
          @keydown.ctrl.enter.prevent="submit"
        />
        <div class="flex items-center justify-between gap-3">
          <div class="text-xs text-grey-8d flex items-center gap-2">
            <span>{{ $t('aiChannelView.publishingToSteem') }}</span>
            <span>·</span>
            <span>{{ content.length }}/2000</span>
          </div>
          <button
            class="w-9 h-9 rounded-full bg-orange-normal text-white flex items-center justify-center disabled:opacity-30"
            :disabled="!canSend"
            :aria-label="$t('aiChannelView.sendReply')"
            @click="submit"
          >
            <i-ep-loading v-if="sending" class="w-4 h-4 animate-spin" />
            <i-ep-top v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  </section>
</template>
