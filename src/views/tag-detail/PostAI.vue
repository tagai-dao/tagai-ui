<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowSize } from '@vant/use'
import {
  createAiChannelReply,
  getAiChannelMessages,
  getAiChannels,
  getTweetById,
} from '@/apis/api'
import { useCommunityStore } from '@/stores/community'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType, type Tweet } from '@/types'
import type {
  AiChannel,
  AiChannelDetail,
  AiChannelQuoteDraft,
} from '@/types/aiChannel'
import { handleErrorTip } from '@/utils/notify'
import AiChannelList from './ai-channel/AiChannelList.vue'
import AiChannelDetailPanel from './ai-channel/AiChannelDetail.vue'

const props = withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const route = useRoute()
const router = useRouter()
const { width } = useWindowSize()
const comStore = useCommunityStore()
const accStore = useAccountStore()
const modalStore = useModalStore()

const channels = ref<AiChannel[]>([])
const selectedChannelId = ref<number | null>(null)
const detail = ref<AiChannelDetail | null>(null)
const loadingChannels = ref(false)
const loadingDetail = ref(false)
const sending = ref(false)
const loadError = ref('')
const quoteDraft = ref<AiChannelQuoteDraft | null>(null)
const detailRef = ref<InstanceType<typeof AiChannelDetailPanel> | null>(null)

const tick = computed(() => comStore.currentSelectedCommunity?.tick || String(route.params.id || ''))
const isDesktop = computed(() => width.value > 800)
const selectedChannel = computed(() =>
  channels.value.find((channel) => channel.id === selectedChannelId.value) || null,
)
const showChannelList = computed(() =>
  props.compact || isDesktop.value || !selectedChannelId.value,
)
const showChannelDetail = computed(() =>
  !props.compact && (isDesktop.value || Boolean(selectedChannelId.value)),
)

const replaceQuery = (changes: Record<string, string | undefined>) => {
  router.replace({
    query: {
      ...route.query,
      ...changes,
    },
  })
}

const loadQuoteDraft = async () => {
  const quoteTweetId = typeof route.query.quoteTweetId === 'string'
    ? route.query.quoteTweetId
    : ''
  if (!quoteTweetId) {
    quoteDraft.value = null
    return
  }
  try {
    quoteDraft.value = await getTweetById(
      quoteTweetId,
      accStore.getAccountInfo?.twitterId,
    ) as Tweet
  } catch (error) {
    quoteDraft.value = null
    handleErrorTip(error)
  }
}

const loadChannels = async () => {
  if (!tick.value || loadingChannels.value) return
  loadingChannels.value = true
  loadError.value = ''
  try {
    channels.value = await getAiChannels(tick.value)
    const queryChannel = Number(route.query.channel)
    const requested = Number.isSafeInteger(queryChannel)
      ? channels.value.find((channel) => channel.id === queryChannel)
      : null
    if (requested) {
      if (requested.id !== selectedChannelId.value || !detail.value) {
        await selectChannel(requested, false)
      }
    } else if (isDesktop.value && !props.compact && channels.value.length > 0) {
      await selectChannel(channels.value[0], false)
    } else if (
      selectedChannelId.value
      && !channels.value.some((channel) => channel.id === selectedChannelId.value)
    ) {
      selectedChannelId.value = null
      detail.value = null
    }
  } catch (error: any) {
    loadError.value = error?.data?.error || error?.message || 'Unable to load AI channels'
  } finally {
    loadingChannels.value = false
  }
}

const loadDetail = async () => {
  if (!selectedChannelId.value || loadingDetail.value) return
  loadingDetail.value = true
  try {
    detail.value = await getAiChannelMessages(selectedChannelId.value)
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loadingDetail.value = false
  }
}

async function selectChannel(channel: AiChannel, updateUrl = true) {
  if (props.compact) {
    await router.push({
      path: `/tag-detail/${channel.tick}`,
      query: { tab: 'ai', channel: String(channel.id) },
    })
    return
  }
  selectedChannelId.value = channel.id
  detail.value = null
  if (updateUrl) {
    replaceQuery({ tab: 'ai', channel: String(channel.id) })
  }
  await loadDetail()
}

const backToChannels = () => {
  selectedChannelId.value = null
  detail.value = null
  replaceQuery({ channel: undefined })
}

const clearQuote = () => {
  quoteDraft.value = null
  replaceQuery({ quoteTweetId: undefined })
}

const idempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const sendReply = async (content: string) => {
  const account = accStore.getAccountInfo
  if (!account?.twitterId) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
  }
  if (!account.steemId) {
    modalStore.setModalVisible(true, GlobalModalType.Register)
    return
  }
  const latestMessageId = detail.value?.channel.lastMessageId
    || detail.value?.messages.at(-1)?.id
  if (!selectedChannelId.value || !latestMessageId || sending.value) return

  sending.value = true
  try {
    await createAiChannelReply(selectedChannelId.value, {
      twitterId: account.twitterId,
      content,
      expectedLatestMessageId: latestMessageId,
      quotedTweetId: quoteDraft.value?.tweetId,
      idempotencyKey: idempotencyKey(),
    })
    detailRef.value?.clearComposer()
    clearQuote()
    await loadDetail()
    await loadChannels()
  } catch (error: any) {
    if (error?.status === 409 && error?.data?.error === 'CHANNEL_UPDATED') {
      await loadDetail()
    }
    handleErrorTip(error)
  } finally {
    sending.value = false
  }
}

watch(
  tick,
  async (current, previous) => {
    if (!current || current === previous) return
    channels.value = []
    selectedChannelId.value = null
    detail.value = null
    await Promise.all([loadChannels(), loadQuoteDraft()])
  },
)

watch(
  () => route.query.channel,
  async (value) => {
    const channelId = Number(value)
    if (!Number.isSafeInteger(channelId) || channelId === selectedChannelId.value) return
    const channel = channels.value.find((item) => item.id === channelId)
    if (channel) await selectChannel(channel, false)
  },
)

watch(() => route.query.quoteTweetId, loadQuoteDraft)

onMounted(async () => {
  await Promise.all([loadChannels(), loadQuoteDraft()])
})
</script>

<template>
  <div class="h-full min-h-[420px] web:min-h-0 flex flex-col">
    <div
      v-if="loadError"
      class="mb-2 px-4 py-3 rounded-xl border border-red/20 bg-red/5 text-red text-sm flex items-center justify-between gap-3"
    >
      <span>{{ loadError }}</span>
      <button class="font-semibold" @click="loadChannels">Retry</button>
    </div>

    <div
      class="flex-1 min-h-0"
      :class="props.compact
        ? ''
        : 'web:grid web:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] web:gap-2'"
    >
      <AiChannelList
        v-if="showChannelList"
        :channels="channels"
        :selected-channel-id="selectedChannelId"
        :loading="loadingChannels"
        :quote-mode="Boolean(quoteDraft)"
        @select="selectChannel"
        @refresh="loadChannels"
      />

      <AiChannelDetailPanel
        v-if="showChannelDetail && selectedChannel"
        ref="detailRef"
        :channel="selectedChannel"
        :detail="detail"
        :loading="loadingDetail"
        :sending="sending"
        :quote-draft="quoteDraft"
        @back="backToChannels"
        @refresh="loadDetail"
        @send="sendReply"
        @clear-quote="clearQuote"
      />

      <div
        v-else-if="showChannelDetail && !selectedChannel"
        class="hidden web:flex h-full min-h-96 rounded-2xl border border-grey-light-hover bg-surface items-center justify-center text-grey-8d"
      >
        Select a channel to view the conversation
      </div>
    </div>
  </div>
</template>
