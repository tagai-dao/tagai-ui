<script setup lang="ts">
import { onMounted, ref, computed, onActivated } from "vue";
import { useModalStore, useStateStore } from "@/stores/common";
import { useCommunityStore } from "@/stores/community";
import { GlobalModalType } from "@/types";
import TagContent from "@/views/tag-detail/TagContent.vue";
import TagCredit from "@/views/tag-detail/TagCredit.vue";
import TagToken from "@/views/tag-detail/TagToken.vue";
import TagProposal from "@/views/tag-detail/TagProposal.vue";
import {useRoute, useRouter} from "vue-router";
import { getCommunityDetail, getIpshareInfo } from "@/apis/api";
import { getTokenInfo } from '@/utils/pump'
import { useInterval, usePageScroll, useTools } from "@/composables/useTools";
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import CreateBlinkModal from '@/components/common/CreateBlinkModal.vue'
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import { useCurationStore } from "@/stores/curation";
import { formatPrice, formatAddress } from "@/utils/helper";
import { TotalSupply, SocialSupply, BondingCurveSupply, ListSupply } from '@/config'
import { ethers } from "ethers";
import IconLinks from "@/components/home/IconLinks.vue";
import BuyAndSellView from "../buy-sell/BuyAndSellView.vue";
import RecordList from "../buy-sell/RecordList.vue";
import PostAI from "@/views/tag-detail/PostAI.vue";
import { OperateType, useTweet } from "@/composables/useTweet";

const tabOptions = [
  // {label: 'Group', key: 'group'},
  { label: 'Square', key: 'content' },
  {label: 'Proposal', key: 'proposal'},
  // {label: 'Trades', key: 'trade'},
  { label: 'Credit', key: 'credit' },
  { label: 'Token', key: 'token' },
  {label: 'AI', key: 'ai'},

]
enum CurationType {
  TWEET,
  SPACE,
  BLINK,
  TIP_CURATE
}

const { pageScroll, pageScrollTo } = usePageScroll()
const pageScrollRef = ref()
const activeTab = ref('content')
const modalStore = useModalStore()
const comStore = useCommunityStore()
const tweetTypeRef = ref()
const route = useRoute()
const router = useRouter()
const tokenInfo = ref()
const checkingAccount = ref(false);
const checkingTweet = ref(false);
const showModal = ref(false);
const curationType = ref(CurationType.TWEET);
const accStore = useAccountStore();
const { setInter } = useInterval()
const { onCopy } = useTools()
const { preCheckCuration } = useTweet()

const onlineSpace = computed(() => {
  const spaces = useCurationStore().allSpaces;
  if (!spaces || spaces.length == 0) return false;
  if (!comStore.currentSelectedCommunity?.tick) return false;
  return !!spaces.find(sp => sp.tick == comStore.currentSelectedCommunity!.tick)
})

const onTweetType = async (type: CurationType) => {
  // check ipshare
  try {
    checkingAccount.value = true
    if (!accStore.getAccountInfo?.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      return;
    }
    curationType.value = type;
    tweetTypeRef.value.hide()
    showModal.value = true
  } catch (e) {
    handleErrorTip(e)
  } finally {
    checkingAccount.value = false
  }
}

const progressData = ref([
  { trackWidth: 15, value: 0, percent: "10%", background: '#FF3D54', desc: 'Social Distributed' },
  { trackWidth: 70, value: 0, percent: "10%", background: '#FE913F', desc: 'Bonding Curve' },
  { trackWidth: 15, value: 0, percent: "10%", background: '#FFCC00', desc: 'Listed' }
])

async function updateProgress() {
  getTokenInfo([comStore.currentSelectedCommunity!]).then((coms: any) => {
    const com = coms[0]
    comStore.currentSelectedCommunity = coms[0]
    progressData.value = [
      { ...progressData.value[0], value: (com.totalClaimedSocialRewards / SocialSupply * 100), percent: '15%' },
      { ...progressData.value[1], value: (com.bondingCurveSupply / BondingCurveSupply * 100), percent: '70%' },
      { ...progressData.value[2], value: 100, percent: '15%', desc: com.listed ? 'Listed' : 'Pending List' }
    ]
  }).catch(e => {
    console.error(2, e)
  })
}

async function checkTipCurate() {
  try {
    checkingTweet.value = true
    const account = accStore.getAccountInfo
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      return;
    }

    if (!(await preCheckCuration(OperateType.TIP_CURATE, undefined, 10))) {
      return;
    }
    onTweetType(CurationType.TIP_CURATE);
  } catch (e) {
    handleErrorTip(e)
  } finally {
    checkingTweet.value = false
  }
}

async function checkTweet() {
  try {
    checkingTweet.value = true
    const account = accStore.getAccountInfo
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      return;
    }

    if (!accStore.getAccountInfo.solAddr) {
      modalStore.setModalVisible(true, GlobalModalType.BondSol)
      return;
    }

    onTweetType(CurationType.BLINK);
  } catch (e) {
    handleErrorTip(e)
  } finally {
    checkingTweet.value = false
  }
}

onMounted(async () => {
  pageScrollTo(pageScrollRef.value)
  let tick = route.params.id;

  if (!comStore.currentSelectedCommunity?.tick || comStore.currentSelectedCommunity?.tick != tick) {
    if (typeof (tick) !== 'string') {
      router.replace('/')
      return;
    }
    comStore.currentSelectedCommunity = null
    comStore.currentSelectedCommunity = await getCommunityDetail(tick) as any
    if (!comStore.currentSelectedCommunity?.tick) {
      router.replace('/')
    }
  }
  // updateProgress();
  // setInter(updateProgress, 3000);
})

</script>

<template>
  <div class="h-full overflow-auto no-scroll-bar py-2 flex flex-col gap-3 px-3 relative" ref="pageScrollRef"
    @scroll="pageScroll(pageScrollRef)">
    <div class="grid grid-cols-1 gap-3">
      <div
        class="col-span-1 web:col-span-2 border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
        <div
          class="w-20 h-20 rounded-2xl bg-grey-light-active shadow-tag-logo flex items-center justify-center relative overflow-hidden">
          <img class="w-full h-full rounded-2xl" :src="comStore.currentSelectedCommunity?.logo" alt="">
          <img v-if="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
          <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg]">{{$t('listed')}}</div>
        </div>
        <div class="flex-1 py-1">
          <div class="flex flex-wrap justify-between gap-x-4 items-center">
            <div class="flex items-center">
              <span class="text-black text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
              <IconLinks :community="comStore.currentSelectedCommunity" />
            </div>
            <div class="text-base flex gap-1">
              <span class="font-semibold text-grey-64">{{$t('marketCap')}}</span>
              <span class="text-gradient bg-gradient-primary font-semibold">{{ formatPrice(parseFloat(comStore.currentSelectedCommunity?.marketCap as any)) }}</span>
            </div>
          </div>
          <div class="flex justify-between items-end gap-3 mt-1">
            <div class="whitespace-pre-line text-h5 leading-4 text-grey-5a">
              {{ comStore.currentSelectedCommunity?.description }}
            </div>
            <button
              v-if="!!accStore.getAccountInfo?.ethAddr && comStore.currentSelectedCommunity?.creator == accStore.getAccountInfo?.ethAddr"
              @click="modalStore.setModalVisible(true, GlobalModalType.ModifyCoin)"
              :disabled="!comStore.currentSelectedCommunity">
              <img class="w-8 h-6" src="~@/assets/icons/icon-edit.svg" alt="">
            </button>
          </div>
          <div>
            <div class="flex items-center gap-2 mt-2 text-lg">
              <span class="font-semibold">CA</span>
              <div class="bg-white text-grey-light-active h-4 flex items-center rounded-[3px]">
                {{ formatAddress(comStore.currentSelectedCommunity?.token ?? '') }}
              </div>
              <button @click="onCopy(comStore.currentSelectedCommunity?.token ?? '')"
                      :disabled="!(comStore.currentSelectedCommunity?.token)">
                <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="">
              </button>
            </div>
            <div class="flex justify-center text-white space-x-8 mt-2">
<!--              <button :disabled="checkingTweet" @click="checkTweet" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">-->
<!--                Blinks-->
<!--                <i-ep-loading v-show="checkingTweet" class="animate-spin" />-->
<!--              </button>-->

              <el-popover popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
                <template #reference>
                  <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">{{$t('postView.postToEarn')}}</button>
                </template>
                <template #default>
                  <div class="bg-grey-normal rounded-2xl px-3 py-4 w-[240px] shadow-popper-tip text-white text-lg flex flex-col gap-2 items-start">
                    <button @click="onTweetType(CurationType.TWEET)"
                            :disabled="checkingAccount"
                            class="whitespace-nowrap flex items-center space-x-3">
                      {{$t('postView.tweetOnChain')}}
                      <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                    </button>
                    <button @click="onTweetType(CurationType.SPACE)"
                            :disabled="checkingAccount"
                            class="whitespace-nowrap flex items-center space-x-3">
                      {{$t('postView.spaceOnChain')}}
                      <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                    </button>
                  </div>
                </template>
              </el-popover>
              <!-- <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post To Earn</button> -->
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="h-full sticky top-[0px]" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
      <div class="h-full flex gap-2">
        <div class="h-full w-full flex flex-col gap-2">
          <div id="dexscreener-embed" class="w-full h-full rounded-xl overflow-hidden">
            <iframe
                :src="`https://dexscreener.com/solana/${comStore.currentSelectedCommunity?.token}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=1&loadChartSettings=0&chartDefaultOnMobile=1&chartTheme=light&theme=light&chartStyle=1&chartType=usd&interval=15`">
            </iframe>
          </div>
          <div class="flex-1 overflow-auto no-scroll-bar">
            <TagContent v-if="activeTab === 'content'" />
          </div>
        </div>
        <div class="web:w-[340px] web:min-w-[340px] hidden flex-col gap-2 h-full overflow-auto no-scroll-bar">
          <div class="flex flex-col gap-2">
            <div class="border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
              <div class="w-20 h-20 rounded-2xl bg-grey-light-active shadow-tag-logo flex items-center justify-center relative overflow-hidden">
                <img class="w-full h-full rounded-2xl" :src="comStore.currentSelectedCommunity?.logo" alt="">
                <img v-if="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
                <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg]">{{ $t('listed') }}</div>
              </div>
              <div class="flex-1 py-1">
                <div class="flex flex-wrap justify-between gap-x-4 items-center">
                  <div class="flex items-center">
                    <span class="text-black text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
                    <IconLinks :community="comStore.currentSelectedCommunity" />
                  </div>
                  <div class="text-base flex gap-1">
                    <span class="font-semibold text-grey-64">{{ $t('marketCap') }}</span>
                    <span class="text-gradient bg-gradient-primary font-semibold">{{ formatPrice(parseFloat(comStore.currentSelectedCommunity?.marketCap as any)) }}</span>
                  </div>
                </div>
                <div class="flex justify-between items-end gap-3 mt-1">
                  <div class="whitespace-pre-line text-h5 leading-4 text-grey-5a">
                    {{ comStore.currentSelectedCommunity?.description }}
                  </div>
                  <button
                      v-if="!!accStore.getAccountInfo?.ethAddr && comStore.currentSelectedCommunity?.creator == accStore.getAccountInfo?.ethAddr"
                      @click="modalStore.setModalVisible(true, GlobalModalType.ModifyCoin)"
                      :disabled="!comStore.currentSelectedCommunity">
                    <img class="w-8 h-6" src="~@/assets/icons/icon-edit.svg" alt="">
                  </button>
                </div>
                <div>
                  <div class="flex items-center gap-2 mt-2 text-lg">
                    <span class="font-semibold">CA</span>
                    <div class="bg-white text-grey-light-active h-4 flex items-center rounded-[3px]">
                      {{ formatAddress(comStore.currentSelectedCommunity?.token ?? '') }}
                    </div>
                    <button @click="onCopy(comStore.currentSelectedCommunity?.token ?? '')"
                            :disabled="!(comStore.currentSelectedCommunity?.token)">
                      <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="">
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
<!--          <div class="h-full sticky top-[0px]">-->
<!--            <PostAI/>-->
<!--          </div>-->
        </div>
      </div>
    </div>
  </div>
  <el-dialog v-model="showModal" modal-class="overlay-white" class="max-w-[500px] rounded-[20px]" width="90%"
    :show-close="false" align-center destroy-on-close>
    <CreateBlinkModal @close="showModal = false" v-if="curationType == CurationType.BLINK" />
    <CreateTipCurateModal @close="showModal = false" v-if="curationType == CurationType.TIP_CURATE" />
    <CreateTweetModal @close="showModal = false" v-if="curationType == CurationType.TWEET" />
    <CreateSpaceModal @close="showModal = false" v-if="curationType == CurationType.SPACE" />
  </el-dialog>
</template>

<style scoped>
#dexscreener-embed {
  position: relative;
  width: 100%;
  height: 40%;
}

@media(min-width:1400px) {
  #dexscreener-embed {
    padding-bottom: 65%;
  }
}

#dexscreener-embed iframe {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 0;
}
</style>
