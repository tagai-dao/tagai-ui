<script lang="ts" setup>
import { useStateStore } from '@/stores/common';
import { useCurationStore } from '@/stores/curation';
import type { Tweet } from '@/types';
import BuyAndSellView from '@/views/buy-sell/BuyAndSellView.vue';
import { onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
    tweet: Tweet
}>()
const stateStore = useStateStore()
const showTradeModal = ref(false)
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
    <template v-if="tweet.commerceId">
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
