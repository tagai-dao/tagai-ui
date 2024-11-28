<script setup lang="ts">
import { onMounted, ref, computed, onActivated } from "vue";
import { useModalStore, useStateStore } from "@/stores/common";
import { useCommunityStore } from "@/stores/community";
import { GlobalModalType } from "@/types";
import TagContent from "@/views/tag-detail/TagContent.vue";
import TagCredit from "@/views/tag-detail/TagCredit.vue";
import TagToken from "@/views/tag-detail/TagToken.vue";
import { useRoute, useRouter } from "vue-router";
import { getClankerTickTweets, getCommunityDetail, getIpshareInfo } from "@/apis/api";
import { getTokensInfo } from "@/utils/clanker";
import { useInterval, usePageScroll, useTools } from "@/composables/useTools";
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import CreateBlinkModal from "@/components/common/CreateBlinkModal.vue";
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import { useCurationStore } from "@/stores/curation";
import { formatPrice } from "@/utils/helper";
import { TotalSupply, SocialSupply, BondingCurveSupply, ListSupply } from "@/config";
import { ethers } from "ethers";
import IconLinks from "@/components/home/IconLinks.vue";
import BuyAndSellView from "../buy-sell/BuyAndSellView.vue";
import RecordList from "../buy-sell/RecordList.vue";
import { OperateType, useTweet } from "@/composables/useTweet";
import { useClankerStore } from "@/stores/clanker";
import type { Tweet } from "@/types";

const tabOptions = [
  // {label: 'Group', key: 'group'},
  { label: "Square", key: "content" },
  { label: "Trades", key: "trade" },
  { label: "Credit", key: "credit" },
  { label: "Token", key: "token" },
];
enum CurationType {
  TWEET,
  SPACE,
  BLINK,
  TIP_CURATE,
}

const { pageScroll, pageScrollTo } = usePageScroll();
const pageScrollRef = ref();
const activeTab = ref("content");
const modalStore = useModalStore();
const tweetTypeRef = ref();
const route = useRoute();
const router = useRouter();
const tokenInfo = ref();
const checkingAccount = ref(false);
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
const { preCheckCuration } = useTweet();

const onTweetType = async (type: CurationType) => {
  // check ipshare
  try {
    checkingAccount.value = true;
    if (!accStore.getAccountInfo?.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login);
      return;
    }
    curationType.value = type;
    tweetTypeRef.value.hide();
    showModal.value = true;
  } catch (e) {
    handleErrorTip(e);
  } finally {
    checkingAccount.value = false;
  }
};

const progressData = ref([
  {
    trackWidth: 15,
    value: 0,
    percent: "10%",
    background: "#FF3D54",
    desc: "Social Distributed",
  },
  {
    trackWidth: 70,
    value: 0,
    percent: "10%",
    background: "#FE913F",
    desc: "Bonding Curve",
  },
  { trackWidth: 15, value: 0, percent: "10%", background: "#FFCC00", desc: "Listed" },
]);

async function checkTipCurate() {
  try {
    checkingTweet.value = true;
    const account = accStore.getAccountInfo;
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login);
      return;
    }

    if (!(await preCheckCuration(OperateType.TIP_CURATE, undefined, 10))) {
      return;
    }
    onTweetType(CurationType.TIP_CURATE);
  } catch (e) {
    handleErrorTip(e);
  } finally {
    checkingTweet.value = false;
  }
}

async function checkTweet() {
  try {
    checkingTweet.value = true;
    const account = accStore.getAccountInfo;
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login);
      return;
    }

    if (ethers.isAddress(accStore.getAccountInfo.ethAddr)) {
      if (!accStore.ipshare?.ethAddr) {
        const ipshare: any = await getIpshareInfo(accStore.getAccountInfo.ethAddr);
        console.log("ipshare:", ipshare);
        accStore.ipshare = ipshare;
      }
    } else {
      modalStore.setModalVisible(true, GlobalModalType.BondEth);
      return;
    }
    console.log("ipshare2:", accStore.ipshare);
    if (!ethers.isAddress(accStore.ipshare?.ethAddr)) {
      modalStore.setModalVisible(true, GlobalModalType.CreateIPShare);
      return;
    }
    onTweetType(CurationType.BLINK);
  } catch (e) {
    handleErrorTip(e);
  } finally {
    checkingTweet.value = false;
  }
}

async function onRefresh() {}

async function onLoad() {}

onMounted(async () => {
  pageScrollTo(pageScrollRef.value);
  const token = route.params.token;
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
  }
});
</script>

<template>
  <div
    class="h-full overflow-auto no-scroll-bar py-2 flex flex-col gap-3 px-3 relative"
    ref="pageScrollRef"
    @scroll="pageScroll(pageScrollRef)"
  >
    <div class="flex">
      <iframe
        v-if="clankerStore.currentSelectedClanker"
        class="min-h-[600px]"
        :src="`https://dexscreener.com/base/${clankerStore.currentSelectedClanker?.token}?embed=1&info=0`"
        frameborder="0"
      ></iframe>

      <div class="grid grid-cols-1 web:grid-cols-5 gap-3">
        <div
          class="col-span-1 web:col-span-2 border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide"
        >
          <div
            class="w-20 h-20 rounded-2xl bg-grey-light-active shadow-tag-logo flex items-center justify-center relative overflow-hidden"
          >
            <img
              class="w-full h-full rounded-2xl"
              :src="clankerStore.currentSelectedClanker?.logo"
              alt=""
            />
          </div>
          <div class="flex-1 py-1">
            <div class="flex flex-wrap justify-between gap-x-4 items-center">
              <div class="flex items-center">
                <span class="text-black text-h2">{{
                  clankerStore.currentSelectedClanker?.name
                }}</span>
              </div>
              <div class="text-base flex gap-1">
                <span class="font-semibold text-grey-64">market cap</span>
                <span
                  class="text-gradient bg-gradient-primary font-semibold"
                  >{{ formatPrice(parseFloat(clankerStore.currentSelectedClanker?.marketCap as any) * useStateStore().ethPrice) }}</span
                >
              </div>
            </div>
            <div class="my-3">
              {{ clankerStore.currentSelectedClanker?.tick }}
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">CA</span>
              <div
                class="bg-white text-grey-light-active text-sm h-4 flex items-center rounded-[3px]"
              >
                {{ clankerStore.currentSelectedClanker?.token }}
              </div>
              <button
                @click="onCopy(clankerStore.currentSelectedClanker?.token ?? '')"
                :disabled="!clankerStore.currentSelectedClanker?.token"
              >
                <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="" />
              </button>
            </div>

          <div
            class="col-span-1 web:col-span-3 border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex flex-col gap-3"
          >
            <div class="flex justify-center text-white space-x-4">
              <button
                :disabled="checkingTweet"
                @click="checkTweet"
                class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11"
              >
                Blinks
                <i-ep-loading v-show="checkingTweet" class="animate-spin" />
              </button>

              <el-popover
                popper-class="c-popper"
                placement="bottom-end"
                width="200"
                ref="tweetTypeRef"
                trigger="click"
              >
                <template #reference>
                  <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">
                    Post To Earn
                  </button>
                </template>
                <template #default>
                  <div
                    class="bg-grey-normal rounded-2xl px-3 py-4 w-[240px] shadow-popper-tip text-white text-lg flex flex-col gap-2 items-start"
                  >
                    <button
                      @click="onTweetType(CurationType.TWEET)"
                      :disabled="checkingAccount"
                      class="whitespace-nowrap flex items-center space-x-3"
                    >
                      Tweet on-chain
                      <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                    </button>
                    <button
                      @click="onTweetType(CurationType.SPACE)"
                      :disabled="checkingAccount"
                      class="whitespace-nowrap flex items-center space-x-3"
                    >
                      Tweet an onchain Space
                      <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                    </button>
                  </div>
                </template>
              </el-popover>
              <!-- <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post To Earn</button> -->
            </div>
          </div>

          <iframe
            class="min-h-[400px]"
            v-if="clankerStore.currentSelectedClanker"
            :src="`https://app.uniswap.org/#/swap`"
          />
          </div>

        </div>
      </div>
    </div>
    <div class="flex-1">
      <van-pull-refresh
        class="h-full min-h-full"
        v-model="refreshing"
        @refresh="onRefresh"
        loading-text="Loading"
        pulling-text="Pull to refresh data"
        loosing-text="Release to refresh"
      >
        <van-list
          :loading="loading"
          :finished="finished"
          :immediate-check="false"
          finished-text="No more"
          :offset="50"
          @load="onLoad"
        >
          <div v-for="(tweet, index) of tweets" :key="tweet.tweetId" class="mb-2">
            <TweetItem class="bg-white rounded-2xl" :tweet="tweet"> </TweetItem>
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
