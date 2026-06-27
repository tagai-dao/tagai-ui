<script lang="ts" setup>
import { useStateStore } from '@/stores/common';
import { useCurationStore } from '@/stores/curation';
import type { Tweet, EventPredictData, BattleData } from '@/types';
import BuyAndSellView from '@/views/buy-sell/BuyAndSellView.vue';
import PredictEventCard from '@/components/common/PredictEventCard.vue';
import PredictBattleCard from '@/components/common/PredictBattleCard.vue';
import { resolveCommerce, getEventMarket, getMarket } from '@/apis/api';
import { useAccountStore } from '@/stores/web3';
import { onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
    tweet: Tweet
}>()
const stateStore = useStateStore()
const accStore = useAccountStore()
const showTradeModal = ref(false)

// commerce 类型：1=代币销售(社交交易)，2=对战预测，3=事件预测
const commerceType = ref<number | null>(null)
const eventMarket = ref<EventPredictData | null>(null)
const battleMarket = ref<BattleData | null>(null)

/** 解析 commerce 类型：预测类(2/3)渲染对应预测卡，代币销售(1)走 Trade。 */
async function resolveCommerceType(commerceId?: string) {
    commerceType.value = null
    eventMarket.value = null
    battleMarket.value = null
    if (!commerceId) return
    try {
        const res: any = await resolveCommerce(commerceId)
        const r = res?.d ?? res
        commerceType.value = r?.commerceType ?? 1
        const fpmm = r?.fpmm
        if (commerceType.value === 3 && fpmm) {
            eventMarket.value = await getEventMarket(fpmm, accStore.getAccountInfo?.twitterId) as any
        } else if (commerceType.value === 2 && fpmm) {
            battleMarket.value = await getMarket(fpmm, accStore.getAccountInfo?.twitterId) as any
        }
    } catch (e) {
        // 解析失败时退回代币销售(Trade)展示
        commerceType.value = 1
    }
}

watch(() => props.tweet?.commerceId, (id) => resolveCommerceType(id || undefined), { immediate: true })
const tradeDialogContentRef = ref<HTMLElement | null>(null)
let removeOutsideListeners: (() => void) | null = null

function gotoTrade() {
    useCurationStore().currentSelectedTweet = props.tweet;
    stateStore.sellsman = props.tweet.ethAddr || '';
    showTradeModal.value = true
}

function isInTradeDialog(event: Event) {
    const target = event.target as HTMLElement | null
    return !!target && (
        tradeDialogContentRef.value?.contains(target) ||
        !!target.closest('.blink-trade-dialog')
    )
}

function stopOutsideEvent(event: Event) {
    if (!showTradeModal.value) return
    if (isInTradeDialog(event)) return

    event.preventDefault()
    event.stopPropagation()
    if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation()
    }
}

function closeFromOutside(event: Event) {
    stopOutsideEvent(event)
    if (!showTradeModal.value || isInTradeDialog(event)) return

    showTradeModal.value = false
}

watch(showTradeModal, (visible) => {
    removeOutsideListeners?.()
    removeOutsideListeners = null

    if (!visible) return

    document.addEventListener('click', closeFromOutside, true)
    removeOutsideListeners = () => {
        document.removeEventListener('click', closeFromOutside, true)
    }
})

onUnmounted(() => {
    removeOutsideListeners?.()
})
</script>

<template>
    <!-- 事件预测分享：渲染事件预测卡 -->
    <div v-if="tweet.commerceId && commerceType === 3 && eventMarket" class="my-3" @click.stop>
        <PredictEventCard :market="eventMarket" :showCommunity="false" />
    </div>
    <!-- 对战预测分享：渲染对战预测卡 -->
    <div v-else-if="tweet.commerceId && commerceType === 2 && battleMarket" class="my-3" @click.stop>
        <PredictBattleCard :battle="battleMarket" :tweets="{}" :showCommunity="false" />
    </div>
    <!-- 代币销售分享：Trade 按钮（保持原行为）。预测类解析完成前不显示按钮，避免错误闪现 Trade -->
    <template v-else-if="tweet.commerceId && commerceType === 1">
        <button class="h-12 w-full bg-gradient-primary rounded-full text-h5 text-white my-3"
            @click.stop="gotoTrade">
            Trade ${{ tweet.tick }}
        </button>
        <el-dialog v-model="showTradeModal"
                   :close-on-click-modal="false"
                   :close-on-press-escape="showTradeModal"
                   class="blink-trade-dialog max-w-[500px] rounded-[20px]"
                   width="90%" :show-close="false" align-center destroy-on-close
                   @click.stop
                   @pointerdown.stop>
            <div ref="tradeDialogContentRef" @click.stop @pointerdown.stop>
                <BuyAndSellView :tick="tweet.tick" :sellsman="tweet.ethAddr || ''"/>
            </div>
        </el-dialog>
    </template>
</template>
