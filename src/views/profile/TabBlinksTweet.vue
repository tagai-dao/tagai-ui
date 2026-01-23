<script setup lang="ts">
import CommerceBtn from "@/components/tweets/CommerceBtn.vue";
import { onMounted, ref, computed, watch } from "vue";
import TweetItem from "@/components/tweets/TweetItem.vue";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import { getUserBlinks, getCapturedFee } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import { getTokenInfoOfTweets } from '@/utils/pump'
import { formatPrice, formatAmount } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { useCurationStore } from "@/stores/curation";
import { useRouter } from "vue-router";
import { isAddress } from "viem";
import type { Tweet } from "@/types";

const accStore = useAccountStore()
const stateStore = useStateStore()
const curationStore = useCurationStore()
const router = useRouter()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const blinksList = ref<Tweet[]>([])
const scroller = document.querySelector('#profile-tab-scroller')
const capturedFee = ref(0)

const valueCaptured = computed(() => {
  return formatAmount(capturedFee.value);
})

async function loadCapturedFee(ethAddr: string) {
  try {
    const fee = await getCapturedFee(ethAddr);
    const feeValue = typeof fee === 'number' ? fee : (typeof fee === 'object' && fee !== null ? 0 : Number(fee) || 0);
    capturedFee.value = feeValue;
  } catch (error) {
    console.error('Load captured fee error:', error);
  }
}

const onLoad = async () => {
  if (finished.value || refreshing.value || blinksList.value.length == 0) return
  try {
    loading.value = true;
    const list: any = await getUserBlinks(accStore.getAccountInfo.twitterId, Math.floor((blinksList.value.length - 1) / 30) + 1)
    if (list && list.length > 0) {
      blinksList.value = blinksList.value.concat(await getTokenInfoOfTweets(list))
    }
    if (list.length === 0) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
};

const onRefresh = async () => {
  if (loading.value) {
    return;
  }
  try {
    refreshing.value = true
    finished.value = false
    const list: any = await getUserBlinks(accStore.getAccountInfo.twitterId)
    if (list && list.length > 0) {
      blinksList.value = await getTokenInfoOfTweets(list)
      if (list.length < 30) finished.value = true
    } else {
      blinksList.value = []
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

// 监听账户信息变化，加载 Value Captured 数据
watch(() => accStore.getAccountInfo?.ethAddr, (newAddr) => {
  if (newAddr && isAddress(newAddr)) {
    loadCapturedFee(newAddr);
  }
}, { immediate: true })

onMounted(() => {
  onRefresh()
  if (accStore.getAccountInfo?.ethAddr && isAddress(accStore.getAccountInfo.ethAddr)) {
    loadCapturedFee(accStore.getAccountInfo.ethAddr);
  }
})

</script>

<template>
  <div class="min-h-full h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="min-h-full h-full overflow-auto"
      :loading-text="$t('loading')" :lpulling-text="$t('pullToRefreshData')" :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading" :finished="finished" :immediate-check="false" :finished-text="$t('noMore')"
        :scroller="scroller" :offset="50" @load="onLoad">
        <!-- Value Captured -->
        <div class="px-3 mb-3">
          <div class="border-1 border-orange-normal rounded-xl px-4 py-3 bg-gray-50">
            <div class="text-sm text-grey-8d mb-1 flex items-center gap-2">
              <span>{{ $t('profileView.valueCaptured') || 'Value Captured' }}</span>
              <el-tooltip popper-class="c-arrow-popper">
                <template #content>
                  <div class="text-white p-2 max-w-200px text-xs">{{ $t('profileView.valueCapturedDesc') || 'Total value captured from IPShare trading fees.' }}</div>
                </template>
                <button>
                  <img class="w-4 h-4" src="~@/assets/icons/icon-tip.svg" alt="">
                </button>
              </el-tooltip>
            </div>
            <div class="text-center">
              <span class="text-orange-normal text-2xl font-bold">{{ valueCaptured }} BNB</span>
            </div>
          </div>
        </div>
        <div class="px-3">
          <div v-for="tweet of blinksList" :key="tweet.tweetId">
            <div v-if="tweet.tick" class="flex items-center gap-2 py-3">
              <div class="w-4 h-4 bg-green-normal rounded-full"></div>
              <router-link :to="`/tag-detail/${tweet.tick}`" class="text-base flex-1">
                #{{ tweet.tick }} • {{ $t('marketCap') }} {{ formatPrice((tweet.marketCap ?? 0) * stateStore.ethPrice) }}
              </router-link>
            </div>
            <div class="bg-white rounded-2xl mb-3">
              <SpaceItem v-if="tweet.spaceId" :tweet="tweet"
                @click.stop="curationStore.currentSelectedTweet = tweet; router.push(`/space-detail/${tweet.tweetId}`)">
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="tweet" />
                </template>
              </SpaceItem>
              <TweetItem v-else :tweet="tweet"
                @click.stop="curationStore.currentSelectedTweet = tweet; router.push(`/post-detail/${tweet.tweetId}`)">
                <template #tweet-trade v-if="tweet.commerceId">
                  <CommerceBtn :tweet="tweet"></CommerceBtn>
                </template>
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="tweet" />
                </template>
              </TweetItem>
            </div>
          </div>
        </div>
        <div v-if="!loading && !refreshing && blinksList.length === 0" class="flex justify-center py-6 w-full">
          <img src="~@/assets/images/empty-data.svg" alt="">
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped></style>
