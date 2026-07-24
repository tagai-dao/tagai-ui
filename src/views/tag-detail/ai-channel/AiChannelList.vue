<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AiChannel } from '@/types/aiChannel'
import { parseTimestamp } from '@/utils/helper'

const props = defineProps<{
  channels: AiChannel[]
  selectedChannelId?: number | null
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  quoteMode?: boolean
}>()

const emit = defineEmits<{
  select: [channel: AiChannel]
  refresh: []
  loadMore: []
}>()

const search = ref('')
const isSearching = computed(() => search.value.trim().length > 0)
const filteredChannels = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return props.channels
  return props.channels.filter((channel) =>
    [
      channel.summary,
      channel.rootAuthor?.name,
      channel.rootAuthor?.username,
      channel.agent?.username,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)),
  )
})
</script>

<template>
  <aside class="h-full min-h-0 flex flex-col bg-surface border border-grey-light-hover rounded-2xl overflow-hidden">
    <div class="px-4 pt-4 pb-3 border-b border-grey-light-hover">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-h2 font-bold text-content">{{ $t('aiChannelView.channels') }}</h2>
          <p v-if="quoteMode" class="text-sm text-orange-normal mt-1">
            {{ $t('aiChannelView.quoteSelectHint') }}
          </p>
        </div>
        <button
          class="w-8 h-8 rounded-full hover:bg-grey-f0 flex items-center justify-center"
          :aria-label="$t('aiChannelView.refreshChannels')"
          @click="emit('refresh')"
        >
          <i-ep-refresh class="w-4 h-4" />
        </button>
      </div>
      <div class="mt-3 h-10 rounded-xl bg-grey-f0 flex items-center gap-2 px-3">
        <i-ep-search class="w-4 h-4 text-grey-8d" />
        <input
          v-model="search"
          class="min-w-0 flex-1 bg-transparent outline-none text-base"
          type="search"
          :placeholder="$t('aiChannelView.searchPlaceholder')"
        >
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto no-scroll-bar p-2">
      <div v-if="loading && channels.length === 0" class="h-full flex items-center justify-center">
        <i-ep-loading class="w-6 h-6 animate-spin text-orange-normal" />
      </div>

      <button
        v-for="channel in filteredChannels"
        :key="channel.id"
        class="w-full text-left px-3 py-3 rounded-xl transition-colors mb-1"
        :class="channel.id === selectedChannelId
          ? 'bg-grey-normal text-white'
          : 'hover:bg-grey-f0 text-content'"
        @click="emit('select', channel)"
      >
        <div class="flex items-start gap-2">
          <span class="font-bold text-lg leading-6">#</span>
          <div class="min-w-0 flex-1">
            <div class="font-semibold leading-5 line-clamp-2">
              {{ channel.summary || $t('aiChannelView.untitled') }}
            </div>
            <div
              class="mt-1 text-sm flex items-center justify-between gap-2"
              :class="channel.id === selectedChannelId ? 'text-white/70' : 'text-grey-8d'"
            >
              <span class="truncate">
                @{{ channel.rootAuthor?.username || channel.rootAuthor?.name || 'unknown' }}
              </span>
              <span class="whitespace-nowrap">
                {{ parseTimestamp(channel.lastActivityAt) }}
              </span>
            </div>
            <div
              class="text-xs mt-1"
              :class="channel.id === selectedChannelId ? 'text-white/60' : 'text-grey-bd'"
            >
              {{ $t('aiChannelView.messageCount', { count: channel.messageCount }) }}
            </div>
          </div>
        </div>
      </button>

      <button
        v-if="hasMore && !isSearching"
        class="w-full py-2.5 rounded-xl text-sm font-semibold text-orange-normal hover:bg-grey-f0 disabled:opacity-50 flex items-center justify-center gap-2"
        :disabled="loadingMore"
        @click="emit('loadMore')"
      >
        <i-ep-loading v-if="loadingMore" class="w-4 h-4 animate-spin" />
        {{ $t('aiChannelView.loadMore') }}
      </button>

      <div
        v-if="!loading && filteredChannels.length === 0"
        class="h-full min-h-48 flex flex-col items-center justify-center text-center px-5 text-grey-8d"
      >
        <img src="~@/assets/images/empty-data.svg" class="w-28 mb-3" alt="">
        <p class="font-medium text-content">
          {{ isSearching ? $t('aiChannelView.noMatchingChannels') : $t('aiChannelView.noChannels') }}
        </p>
        <p v-if="!isSearching" class="text-sm mt-1">
          {{ $t('aiChannelView.noChannelsDesc') }}
        </p>
      </div>
    </div>
  </aside>
</template>
