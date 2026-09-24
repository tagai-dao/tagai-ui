<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChainStore } from '@/stores/chain'
import { GlobalModalType } from '@/types'
import { useStateStore, useModalStore } from '@/stores/common'
import { getTradeCardReward, type TradeCardReward } from '@/utils/tradeCurationCards'
import { formatTokenAmount, formatUsd } from '@/utils/format'
const props = defineProps<{ tweetId?: string; token?: string; tick?: string; price?: number }>()
const { t } = useI18n(), chain = useChainStore(), state = useStateStore()
const reward = ref<TradeCardReward | null>(null), failed = ref(false)
let generation = 0
const valid = computed(() => chain.activeChainId === 56 && props.token && props.tweetId)
const price = computed(() => Number(props.price) * state.ethPrice)
const usd = (amount: string) => Number.isFinite(price.value) && price.value > 0 ? formatUsd(Number(amount) * price.value) : '—'
function openRewards() {
  if (!valid.value) return
  useModalStore().setModalVisible(true, GlobalModalType.TradeCurationRewards, {
    token: props.token, tweetId: props.tweetId, tick: props.tick, price: props.price,
  })
}
async function refresh(reset = false) {
  const current = ++generation
  if (reset) { reward.value = null; failed.value = false }
  if (!valid.value) return
  try {
    const result = await getTradeCardReward({ token: props.token!, tweetId: props.tweetId! })
    if (generation === current) { reward.value = result; failed.value = false }
  } catch { if (generation === current) { reward.value = null; failed.value = true } }
}
watch(() => [props.token, props.tweetId, chain.activeChainId], () => refresh(true), { immediate: true })
const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 30000)
onUnmounted(() => { generation++; clearInterval(timer) })
</script>
<template>
  <button v-if="valid && (reward || failed)" type="button"
          class="max-w-[150px] shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-semibold text-white tabular-nums sm:max-w-none"
          :class="reward?.state === 'settled' || failed ? 'bg-grey-light-active' : 'bg-gradient-primary'"
          :aria-label="t('tradeCuration.title')" @click.stop="openRewards">
    {{ reward ? formatTokenAmount(reward.amount) : '—' }}<template v-if="reward"> ≈ {{ usd(reward.amount) }}</template>
  </button>
</template>
