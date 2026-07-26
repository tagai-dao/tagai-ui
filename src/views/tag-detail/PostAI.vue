<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowSize } from '@vant/use'
import {
  createAiChannelReply,
  getAiChannelMessages,
  getAiChannels,
  getTweetById,
  newCurate,
  setAiChannelReaction,
} from '@/apis/api'
import { useCommunityStore } from '@/stores/community'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType, type Tweet } from '@/types'
import type {
  AiChannel,
  AiChannelDetail,
  AiChannelQuoteDraft,
  AiChannelReactionType,
} from '@/types/aiChannel'
import { handleErrorTip, notify } from '@/utils/notify'
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
const nextCursor = ref<string | null>(null)
const selectedChannelId = ref<number | null>(null)
const directChannel = ref<AiChannel | null>(null)
const detail = ref<AiChannelDetail | null>(null)
const loadingChannels = ref(false)
const loadingMore = ref(false)
const loadingDetail = ref(false)
const sending = ref(false)
const curating = ref(false)
const loadError = ref<string | null>(null)
const quoteDraft = ref<AiChannelQuoteDraft | null>(null)
const replyIdempotencyKey = ref<string | null>(null)
const pendingReactions = new Set<string>()
const detailRef = ref<InstanceType<typeof AiChannelDetailPanel> | null>(null)
// 详情请求序号：新请求发出即作废旧响应，避免快速切换频道时串数据
let detailSeq = 0

const tick = computed(() => comStore.currentSelectedCommunity?.tick || String(route.params.id || ''))
const isDesktop = computed(() => width.value > 800)
const selectedChannel = computed(() =>
  channels.value.find((channel) => channel.id === selectedChannelId.value)
  || (directChannel.value?.id === selectedChannelId.value ? directChannel.value : null),
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

// 深链接指向未加载页中的频道时，用详情接口的数据构造面板头部所需的频道信息
const channelFromDetail = (channelDetail: AiChannelDetail): AiChannel => ({
  ...channelDetail.channel,
  summaryStatus: 0,
  rootAuthor: { name: '', username: '', profile: '' },
  agent: channelDetail.channel.agent || {
    name: 'TagAgent',
    username: 'tagagen78',
    xUsername: 'TagAgentX',
    profile: '',
  },
})

const loadDetail = async () => {
  const channelId = selectedChannelId.value
  if (!channelId) return
  const seq = ++detailSeq
  loadingDetail.value = true
  try {
    const result = await getAiChannelMessages(
      channelId,
      tick.value,
      accStore.getAccountInfo?.twitterId,
    )
    if (seq !== detailSeq || selectedChannelId.value !== channelId) return
    detail.value = result
  } catch (error) {
    if (seq === detailSeq) handleErrorTip(error)
  } finally {
    if (seq === detailSeq) loadingDetail.value = false
  }
}

const selectChannelById = async (channelId: number) => {
  if (selectedChannelId.value === channelId && detail.value) return
  const seq = ++detailSeq
  loadingDetail.value = true
  try {
    const result = await getAiChannelMessages(
      channelId,
      tick.value,
      accStore.getAccountInfo?.twitterId,
    )
    if (seq !== detailSeq) return
    directChannel.value = channelFromDetail(result)
    selectedChannelId.value = channelId
    detail.value = result
  } catch (error) {
    if (seq === detailSeq) handleErrorTip(error)
  } finally {
    if (seq === detailSeq) loadingDetail.value = false
  }
}

const applyChannelSelection = async () => {
  if (props.compact) return
  const queryChannel = Number(route.query.channel)
  const hasQueryChannel = Number.isSafeInteger(queryChannel) && queryChannel > 0
  const requested = hasQueryChannel
    ? channels.value.find((channel) => channel.id === queryChannel)
    : null
  if (requested) {
    if (requested.id !== selectedChannelId.value || !detail.value) {
      await selectChannel(requested, false)
    }
  } else if (hasQueryChannel) {
    await selectChannelById(queryChannel)
  } else if (isDesktop.value && channels.value.length > 0) {
    await selectChannel(channels.value[0], false)
  } else if (
    selectedChannelId.value
    && !channels.value.some((channel) => channel.id === selectedChannelId.value)
    && directChannel.value?.id !== selectedChannelId.value
  ) {
    selectedChannelId.value = null
    detail.value = null
  }
}

const loadChannels = async () => {
  if (!tick.value || loadingChannels.value) return
  loadingChannels.value = true
  loadError.value = null
  try {
    const page = await getAiChannels(tick.value)
    channels.value = page.items
    nextCursor.value = page.nextCursor
    await applyChannelSelection()
  } catch (error: any) {
    loadError.value = error?.data?.error || error?.message || ''
  } finally {
    loadingChannels.value = false
  }
}

const loadMoreChannels = async () => {
  if (!tick.value || !nextCursor.value || loadingMore.value || loadingChannels.value) return
  loadingMore.value = true
  try {
    const page = await getAiChannels(tick.value, nextCursor.value)
    const known = new Set(channels.value.map((channel) => channel.id))
    channels.value = channels.value.concat(
      page.items.filter((channel) => !known.has(channel.id)),
    )
    nextCursor.value = page.nextCursor
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loadingMore.value = false
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
  directChannel.value = null
  selectedChannelId.value = channel.id
  detail.value = null
  replyIdempotencyKey.value = null
  if (updateUrl) {
    replaceQuery({ tab: 'ai', channel: String(channel.id) })
  }
  await loadDetail()
}

const backToChannels = () => {
  selectedChannelId.value = null
  directChannel.value = null
  detail.value = null
  replyIdempotencyKey.value = null
  replaceQuery({ channel: undefined })
}

const clearQuote = () => {
  quoteDraft.value = null
  replaceQuery({ quoteTweetId: undefined })
}

const newIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const agentEligibilityWarning = (reason?: string | null) => {
  if (reason === 'daily_free_reply_cap') {
    return 'Your reply was published to Steem, but your 24-hour TagAgent reply allowance has been used, so it will not appear in this Channel.'
  }
  if (reason?.startsWith('eligibility_check_')) {
    return 'Your reply was published to Steem, but TagAgent eligibility could not be verified, so it will not appear in this Channel.'
  }
  return 'Your reply was published to Steem, but your TagAgent credit does not meet the reply requirement, so it will not appear in this Channel.'
}

const sendReply = async (content: string, parentMessageId?: string) => {
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

  // 同一草稿的重试必须复用同一幂等键，否则服务端已写入时会产生重复回复
  if (!replyIdempotencyKey.value) replyIdempotencyKey.value = newIdempotencyKey()
  sending.value = true
  try {
    const result = await createAiChannelReply(selectedChannelId.value, {
      twitterId: account.twitterId,
      content,
      expectedLatestMessageId: latestMessageId,
      parentMessageId,
      quotedTweetId: quoteDraft.value?.tweetId,
      idempotencyKey: replyIdempotencyKey.value,
      curate: true,
    })
    if (!result.channelVisible) {
      notify({
        type: 'warning',
        message: agentEligibilityWarning(result.agentEligibilityReason),
        duration: 7000,
      })
    }
    replyIdempotencyKey.value = null
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

const reactToMessage = async (
  messageId: string,
  reaction: AiChannelReactionType,
  active: boolean,
) => {
  const account = accStore.getAccountInfo
  if (!account?.twitterId) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
  }
  if (!selectedChannelId.value) return

  const pendingKey = `${messageId}:${reaction}`
  if (pendingReactions.has(pendingKey)) return
  pendingReactions.add(pendingKey)
  const message = detail.value?.messages.find((item) => item.id === messageId)
  const reactions = message
    ? (message.reactions ||= [])
    : []
  const previous = reactions.map((item) => ({ ...item }))
  if (message) {
    const current = reactions.find((item) => item.type === reaction)
    if (current) {
      current.reactedByMe = active
      current.count = Math.max(0, current.count + (active ? 1 : -1))
    } else if (active) {
      reactions.push({ type: reaction, count: 1, reactedByMe: true })
    }
  }

  try {
    await setAiChannelReaction(selectedChannelId.value, {
      twitterId: account.twitterId,
      messageId,
      reaction,
      active,
    })
  } catch (error) {
    if (message) message.reactions = previous
    handleErrorTip(error)
  } finally {
    pendingReactions.delete(pendingKey)
  }
}

const curateRoot = async (vp: number) => {
  const account = accStore.getAccountInfo
  if (!account?.twitterId) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
  }
  if (!account.steemId) {
    modalStore.setModalVisible(true, GlobalModalType.Register)
    return
  }
  const rootTweetId = detail.value?.channel.rootTweetId
    || selectedChannel.value?.rootTweetId
  if (!rootTweetId || curating.value) return
  curating.value = true
  try {
    await newCurate(account.twitterId, rootTweetId, tick.value, vp)
    notify({ type: 'success', message: 'Curated successfully' })
  } catch (error) {
    handleErrorTip(error)
  } finally {
    curating.value = false
  }
}

watch(
  tick,
  async (current, previous) => {
    if (!current || current === previous) return
    channels.value = []
    nextCursor.value = null
    selectedChannelId.value = null
    directChannel.value = null
    detail.value = null
    replyIdempotencyKey.value = null
    await Promise.all([loadChannels(), loadQuoteDraft()])
  },
)

watch(
  () => route.query.channel,
  async (value) => {
    if (props.compact) return
    const channelId = Number(value)
    if (!Number.isSafeInteger(channelId) || channelId <= 0 || channelId === selectedChannelId.value) return
    const channel = channels.value.find((item) => item.id === channelId)
    if (channel) await selectChannel(channel, false)
    else await selectChannelById(channelId)
  },
)

watch(() => route.query.quoteTweetId, loadQuoteDraft)

onMounted(async () => {
  await Promise.all([loadChannels(), loadQuoteDraft()])
})
</script>

<template>
  <div
    class="h-full flex flex-col overflow-hidden"
    :class="props.compact ? 'min-h-[420px]' : 'min-h-0'"
  >
    <div
      v-if="loadError !== null"
      class="mb-2 px-4 py-3 rounded-xl border border-red/20 bg-red/5 text-red text-sm flex items-center justify-between gap-3"
    >
      <span>{{ loadError || $t('aiChannelView.loadFailed') }}</span>
      <button class="font-semibold" @click="loadChannels">{{ $t('aiChannelView.retry') }}</button>
    </div>

    <div
      class="flex-1 min-h-0 overflow-hidden"
      :class="props.compact
        ? ''
        : 'web:grid web:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] web:gap-2'"
    >
      <AiChannelList
        v-if="showChannelList"
        :channels="channels"
        :selected-channel-id="selectedChannelId"
        :loading="loadingChannels"
        :loading-more="loadingMore"
        :has-more="Boolean(nextCursor)"
        :quote-mode="Boolean(quoteDraft)"
        @select="selectChannel"
        @refresh="loadChannels"
        @load-more="loadMoreChannels"
      />

      <AiChannelDetailPanel
        v-if="showChannelDetail && selectedChannel"
        ref="detailRef"
        :channel="selectedChannel"
        :detail="detail"
        :loading="loadingDetail"
        :sending="sending"
        :curating="curating"
        :quote-draft="quoteDraft"
        @back="backToChannels"
        @refresh="loadDetail"
        @send="sendReply"
        @react="reactToMessage"
        @curate="curateRoot"
        @clear-quote="clearQuote"
      />

      <div
        v-else-if="showChannelDetail && !selectedChannel"
        class="hidden web:flex h-full min-h-96 rounded-2xl border border-grey-light-hover bg-surface items-center justify-center text-grey-8d"
      >
        {{ $t('aiChannelView.selectChannelHint') }}
      </div>
    </div>
  </div>
</template>
