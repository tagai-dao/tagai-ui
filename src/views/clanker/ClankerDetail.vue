<script setup lang="ts">
import { onMounted, ref, computed, onActivated } from "vue";
import { useModalStore, useStateStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { useRoute, useRouter } from "vue-router";
import { getClankerTickTweets, getCommunityDetail, getIpshareInfo } from "@/apis/api";
import { getTokensInfo } from "@/utils/clanker";
import { useInterval, usePageScroll, useTools } from "@/composables/useTools";
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import CreateBlinkModal from "@/components/common/CreateBlinkModal.vue";
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import { formatPrice } from "@/utils/helper";
import TweetItem from '@/components/tweets/TweetItem.vue';
import { useClankerStore } from "@/stores/clanker";
import type { Tweet } from "@/types";

enum CurationType {
  TWEET,
  SPACE,
  BLINK,
  TIP_CURATE,
}

const { pageScroll, pageScrollTo } = usePageScroll();
const pageScrollRef = ref();
const route = useRoute();
const checkingTweet = ref(false);
const showModal = ref(false);
const curationType = ref(CurationType.TWEET);
const accStore = useAccountStore();
const clankerStore = useClankerStore();
const tweets = ref<Tweet[]>([]);
const refreshing = ref(false);
const finished = ref(false);
const loading = ref(false);
const { setInter } = useInterval();
const { onCopy } = useTools();
const swapModalVisible = ref(false)

async function postTweet() {
  window.open(`https://x.com/compose/tweet?text=${encodeURIComponent(`#${clankerStore.currentSelectedClanker?.tick}`)}`, '_blank');
}

async function onRefresh() {
  try {
    const token = route.params.token;
    if (refreshing.value) {
      return;
    }
    refreshing.value = true;
    const res: any = await getClankerTickTweets(token as string);
    if (res && res.length > 0) {
      const token = res[0];
      clankerStore.currentSelectedClanker = (
        await getTokensInfo([
          {
            name: token.name,
            tick: token.tick,
            token: token.token,
            logo: token.logo,
            pool: token.pool,
          },
        ])
      )[0];

      tweets.value = res;
      if (res.length < 30) {
        finished.value = true;
      }
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  try {
    if (refreshing.value || finished.value || loading.value || tweets.value.length == 0) {
      return;
    }
    loading.value = true;
    const res: any = await getClankerTickTweets(clankerStore.currentSelectedClanker?.token as string, Math.floor((tweets.value.length - 1) / 30) + 1);
    if (res && res.length > 0) {
      tweets.value = tweets.value.concat(res);
    }
    if (res.length < 30) {
      finished.value = true;
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  pageScrollTo(pageScrollRef.value);
  onRefresh();
});
</script>

<template>
  <div
    class="h-full overflow-auto no-scroll-bar py-2 flex flex-col gap-3 px-3 relative"
    ref="pageScrollRef"
    @scroll="pageScroll(pageScrollRef)"
  >
    <div class="flex web:gap-3">
      <div class="flex-1 rounded-2xl overflow-hidden">
        <iframe
            v-if="clankerStore.currentSelectedClanker"
            style="width: 100%; height: 100%"
            :src="`https://dexscreener.com/base/${clankerStore.currentSelectedClanker?.token}?embed=1&info=0`"
            frameborder="0"
        ></iframe>
      </div>
      <div class="w-full web:w-[400px] border-[1px] border-white bg-grey-fa rounded-2xl pt-5 px-3.5">
        <div class="flex gap-3 overflow-hide">
          <div class="w-20 h-20 min-w-20 min-h-20 rounded-2xl bg-grey-light-active shadow-tag-logo overflow-hidden">
            <img
                class="w-full h-full rounded-2xl"
                :src="clankerStore.currentSelectedClanker?.logo"
                alt=""
            />
          </div>
          <div class="flex-1 overflow-hidden flex flex-col min-h-20 justify-between gap-y-1">
            <div class="flex flex-wrap justify-between gap-x-4 items-center">
              <span class="text-black text-h2">{{clankerStore.currentSelectedClanker?.name}}</span>
              <div class="text-base flex gap-1">
                <span class="font-semibold text-grey-64">{{$t('marketCap')}}</span>
                <span class="text-gradient bg-gradient-primary font-semibold">
                  {{ formatPrice(Math.floor(parseFloat(clankerStore.currentSelectedClanker?.marketCap as any) * useStateStore().ethPrice)) }}
                </span>
              </div>
            </div>
            <div>{{ clankerStore.currentSelectedClanker?.tick }}</div>
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-sm font-semibold">CA</span>
              <div class="bg-white text-grey-light-active text-sm h-4 rounded-[3px] flex-1 truncate">
                {{ clankerStore.currentSelectedClanker?.token }}
              </div>
              <button @click="onCopy(clankerStore.currentSelectedClanker?.token ?? '')"
                      :disabled="!clankerStore.currentSelectedClanker?.token">
                <img class="w-[10px] w-min-[8px]" src="~@/assets/icons/icon-copy.svg" alt="" />
              </button>
            </div>

          </div>
        </div>
        <div class="flex justify-center text-white space-x-4 mt-3">
          <button :disabled="checkingTweet"
                  @click="postTweet"
                  class="w-full bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
            {{ $t('post') }}
            <i-ep-loading v-show="checkingTweet" class="animate-spin" />
          </button>

          <button class="w-full web:hidden bg-gradient-primary text-h5 rounded-full h-11"
                  @click="swapModalVisible=true">{{$t('swap')}}</button>
        </div>
        <div class="hidden web:block h-[540px] min-h-[540px] rounded-2xl overflow-hidden mt-3">
          <iframe
              style="width: 100%; height: 100%; "
              v-if="clankerStore.currentSelectedClanker"
              :src="`https://app.uniswap.org/#/swap`"
          />
        </div>
        <el-dialog v-model="swapModalVisible"
                   modal-class="overlay-white"
                   class="max-w-[500px] rounded-[20px]"
                   width="90%"
                   :show-close="false" align-center>
          <div class="w-full flex justify-center">
            <div class="w-[400px] h-[540px] min-h-[540px] rounded-[20px]">
              <iframe
                  style="width: 100%; height: 100%; "
                  v-if="clankerStore.currentSelectedClanker"
                  :src="`https://app.uniswap.org/#/swap`"
              />
            </div>
          </div>
        </el-dialog>
      </div>
    </div>
    <div class="flex-1">
      <van-pull-refresh
        class="h-full min-h-full"
        v-model="refreshing"
        @refresh="onRefresh"
        :loading-text="$t('loading')"
        :lpulling-text="$t('pullToRefreshData')"
        :loosing-text="$t('releaseToRefresh')"
      >
        <van-list
          :loading="loading"
          :finished="finished"
          :immediate-check="false"
          :finished-text="$t('noMore')"
          :offset="50"
          @load="onLoad"
        >
          <div v-for="(tweet, index) of tweets" :key="tweet.tweetId" class="mb-2">
            <TweetItem class="bg-white rounded-2xl" :tweet="tweet" multiline> </TweetItem>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>
  </div>
  <el-dialog
    v-model="showModal"
    modal-class="overlay-white"
    class="max-w-[500px] rounded-[20px]"
    width="90%"
    :show-close="false"
    align-center
    destroy-on-close
  >
    <CreateBlinkModal
      @close="showModal = false"
      v-if="curationType == CurationType.BLINK"
    />
    <CreateTipCurateModal
      @close="showModal = false"
      v-if="curationType == CurationType.TIP_CURATE"
    />
    <CreateTweetModal
      @close="showModal = false"
      v-if="curationType == CurationType.TWEET"
    />
    <CreateSpaceModal
      @close="showModal = false"
      v-if="curationType == CurationType.SPACE"
    />
  </el-dialog>
</template>

<style scoped>
.gradient-text {
  background: linear-gradient(300deg, #ff0080, #ff8c00, #40e0d0, #7b68ee, #ff0080);
  background-size: 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient 8s linear infinite;
  font-weight: bold;
}

.glow-effect {
  position: relative;
}

.glow-effect::before {
  content: "AI create";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: inherit;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: blur(12px);
  opacity: 0.7;
  animation: gradient 8s linear infinite;
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
