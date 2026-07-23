<script setup lang="ts">
import {onMounted, ref, computed, onActivated, nextTick, onUnmounted, watch} from "vue";
import {useModalStore, useStateStore} from "@/stores/common";
import { useCommunityStore } from "@/stores/community";
import {GlobalModalType, type Tweet} from "@/types";
import TagContent from "@/views/tag-detail/TagContent.vue";
import PredictIndex from '@/views/tag-detail/Prediction/Index.vue';
import CreditIndex from "@/views/tag-detail/Credit/Index.vue";
import TagToken from "@/views/tag-detail/TagToken.vue";
import SpcxbLiquidity from "@/views/tag-detail/SpcxbLiquidity.vue";
import TagProposal from "@/views/tag-detail/TagProposal.vue";
import TagTippedContent from "@/views/tag-detail/TagTippedContent.vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { getCommunityDetail, getConversationId,
      getCommunityDeployerIpshare, getCommunityDeployTweet } from "@/apis/api";
import { getTokenInfo } from '@/utils/pump'
import {useInterval, usePageScroll, useTools} from "@/composables/useTools";
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import CreateBlinkModal from '@/components/common/CreateBlinkModal.vue'
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import CommunityMiniTagIndex from "@/views/tag-detail/communityMiniTags/Index.vue";
import { useCurationStore } from "@/stores/curation";
import { formatAmount, formatPrice } from "@/utils/helper";
import { TotalSupply, SocialSupply, BondingCurveSupply, ListSupply, PUMP9_VERSION, usesThirdPartyMarketCap } from '@/config'
import IconLinks from "@/components/home/IconLinks.vue";
import CommunityLogo from "@/components/common/CommunityLogo.vue";
import BuyAndSellView from "../buy-sell/BuyAndSellView.vue";
import RecordList from "../buy-sell/RecordList.vue";
import PostAI from "@/views/tag-detail/PostAI.vue";
import { OperateType, useTweet } from "@/composables/useTweet";
import CreateTipCurateModal from "@/components/common/CreateTipCurateModal.vue";
import emitter from "@/utils/emitter";
import { DeBoxChatWidget } from '@debox-pro/chat-widget-html';
import { useWindowSize } from "@vant/use";
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from "@/components/tweets/CommerceBtn.vue";
import { isAddress } from "viem";
import { getIPShareSupply } from "@/utils/ipshare";
import { useChainStore } from '@/stores/chain'

const baseTabOptions = computed(() => {
  const predictTab = predictionEnabled.value
    ? [{label: 'Predict', key: 'predict'}]
    : []
  if (comStore.currentSelectedCommunity?.isImport) {
    return [
      {label: 'Square', key: 'content'},
      ...predictTab,
      {label: 'Credit', key: 'credit'},
      {label: 'Token', key: 'token'},
      {label: 'AI', key: 'ai'},
    ]
  }
  return [
    {label: 'Square', key: 'content'},
    ...predictTab,
    {label: 'Trades', key: 'trade'},
    {label: 'Credit', key: 'credit'},
    {label: 'Token', key: 'token'},
    {label: 'AI', key: 'ai'},
  ]
})

/** SPCXB 等第三方市值代币：Token Tab 后插入「流动性」Tab */
const tabOptions = computed(() => {
  const tabs = [...baseTabOptions.value]
  if (usesThirdPartyMarketCap(comStore.currentSelectedCommunity?.tick)) {
    const tokenIdx = tabs.findIndex(t => t.key === 'token')
    if (tokenIdx >= 0) {
      tabs.splice(tokenIdx + 1, 0, { label: 'liquidity.tab', key: 'liquidity' })
    }
  }
  return tabs
})
enum CurationType {
  TWEET,
  SPACE,
  BLINK,
  TIP_CURATE
}

const { pageScrollTo } = usePageScroll()
const pageScrollRef = ref()
const tabScrollRef = ref()
const pageScrollTop = ref(0)
const tabScrollTop = ref(0)
const pageScroll = (ref: any, type: string) => {
  if(type==='page') pageScrollTop.value = pageScrollRef.value.scrollTop
  if(type==='tab') tabScrollTop.value = tabScrollRef.value.scrollTop
  if(tabScrollRef.value.scrollTop>100 && document.body.clientWidth>800) {
    pageScrollTo(pageScrollRef.value, 412)
  }
}
const activeTab = ref('content')
const chainStore = useChainStore()
const predictionEnabled = computed(() => chainStore.deployment.features.prediction)
watch(predictionEnabled, enabled => {
  if (!enabled && activeTab.value === 'predict') activeTab.value = 'content'
})
const modalStore = useModalStore()
const comStore = useCommunityStore()
const tweetTypeRef = ref()
const route = useRoute()
const router = useRouter()
const selectTab = (key: string) => {
  activeTab.value = key
  router.replace({
    query: {
      ...route.query,
      tab: key === 'content' ? undefined : key,
      channel: key === 'ai' ? route.query.channel : undefined,
      quoteTweetId: key === 'ai' ? route.query.quoteTweetId : undefined,
    },
  })
}
watch(
  [() => route.query.tab, tabOptions],
  ([queryTab]) => {
    const requested = typeof queryTab === 'string' ? queryTab : 'content'
    if (tabOptions.value.some((tab) => tab.key === requested)) {
      activeTab.value = requested
    }
  },
  { immediate: true },
)
const tokenInfo = ref()
const checkingAccount = ref(false);
const checkingTweet = ref(false);
const showModal = ref(false);
const curationType = ref(CurationType.TWEET);
const accStore = useAccountStore();
const nativeSymbol = computed(() => chainStore.nativeCurrency.symbol)
const isPumpV9OrV10 = computed(() => {
  const version = Number(comStore.currentSelectedCommunity?.version)
  return version === PUMP9_VERSION || version === 10
})
const tokenExternalLinks = computed(() => {
  const token = comStore.currentSelectedCommunity?.token
  if (!token) return null
  const isRh = chainStore.deployment.key === 'rh'
  return {
    explorer: `${chainStore.browser.replace(/\/$/, '')}/token/${token}`,
    explorerLabel: isRh ? 'Blockscout' : 'BscScan',
    dexScreener: `https://dexscreener.com/${isRh ? 'robinhood' : 'bsc'}/${token}`,
    gmgn: isRh ? null : `https://gmgn.ai/bsc/token/${token}`,
  }
})
/** USD 参考价不可用时，保留链上计算出的原生币市值，避免错误显示为 $0.00。 */
const marketCapText = computed(() => {
  const nativeMarketCap = Number(comStore.currentSelectedCommunity?.marketCap ?? 0)
  const nativeUsdPrice = Number(useStateStore().ethPrice ?? 0)
  if (!Number.isFinite(nativeMarketCap) || nativeMarketCap <= 0) return formatPrice(0)
  if (Number.isFinite(nativeUsdPrice) && nativeUsdPrice > 0) {
    return formatPrice(Math.round(nativeMarketCap * nativeUsdPrice))
  }
  return `${formatAmount(nativeMarketCap)} ${nativeSymbol.value}`
})
const { setInter } = useInterval()
const {onCopy} = useTools()
const { preCheckCuration } = useTweet()
const deployTweetList = ref([])

const showTradeBox = ref(false)
const {width} = useWindowSize()
/** 社区侧栏 Teleport 目标（K 线已对 RH 未 list 开放，统一标准布局） */
const normalSidebarTarget = ref<HTMLElement | null>(null)
const communitySidebarTarget = computed(() => normalSidebarTarget.value)
const onlineSpace = computed(() => {
  const spaces = useCurationStore().allSpaces;
  if (!spaces || spaces.length == 0) return false;
  if (!comStore.currentSelectedCommunity?.tick) return false;
  return !!spaces.find(sp => sp.tick == comStore.currentSelectedCommunity!.tick)
})

const onTweetType =  async (type: CurationType) => {
  // check ipshare
  try{
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
  {trackWidth: 15, value: 0, percent: "10%", background: '#FF3D54', desc: 'Social Distributed'},
  {trackWidth: 70, value: 0, percent: "10%", background: '#FE913F', desc: 'Bonding Curve'},
  {trackWidth: 15, value: 0, percent: "10%", background: '#FFCC00', desc: 'Listed'}
])

async function updateProgress() {
  const selectedCommunity = comStore.currentSelectedCommunity
  if (!selectedCommunity) return
  getTokenInfo([selectedCommunity]).then((coms: any) => {
    const com = coms[0]
    if (!com) return
    comStore.currentSelectedCommunity = com
    let bondingCurveProgress =  (com.bondingCurveSupply / BondingCurveSupply * 100);
    if (!com.listed && bondingCurveProgress >= 99.99){
      bondingCurveProgress = 99.99
    }

    progressData.value = [
      {...progressData.value[0], value: (com.totalClaimedSocialRewards / SocialSupply * 100), percent: '15%'},
      {...progressData.value[1], value: com.listed ? 100 : bondingCurveProgress, percent:'65%'},
      {...progressData.value[2], value: 100, percent:'20%', desc: com.listed ? 'Listed' : 'Pending List'}
    ]
  }).catch(e => {
    console.error(2, e)
  })
}

async function checkTipCurate() {
  try{
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
  } catch(e) {
    handleErrorTip(e)
  } finally {
    checkingTweet.value = false
  }
}

async function checkTweet() {
  try{
    checkingTweet.value = true
    const account = accStore.getAccountInfo
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      return;
    }

    if (isAddress(accStore.getAccountInfo.ethAddr ?? '')) {
      if (!accStore.ipshare?.ethAddr) {
        const supply: any = await getIPShareSupply(accStore.getAccountInfo.ethAddr ?? '');
        if (supply >= 10) {
          accStore.ipshare = {
            ethAddr: accStore.getAccountInfo.ethAddr ?? '',
            shareSupply: supply,
            created: true
          };
        }
        console.log('ipshare:', accStore.ipshare)
      }
    }else {
      modalStore.setModalVisible(true, GlobalModalType.BondEth)
      return;
    }
    console.log('ipshare2:', accStore.ipshare)
    if (!isAddress(accStore.ipshare?.ethAddr ?? '')) {
      modalStore.setModalVisible(true, GlobalModalType.CreateIPShare)
      return;
    }
    onTweetType(CurationType.BLINK);
  } catch(e) {
    handleErrorTip(e)
  } finally {
    checkingTweet.value = false
  }
}

onMounted(async () => {
  const tick = route.params.id;
  if (!comStore.currentSelectedCommunity?.tick || comStore.currentSelectedCommunity?.tick != tick){
    if (typeof(tick) !== 'string') {
      router.replace('/')
      return;
    }
    comStore.currentSelectedCommunity = null
    comStore.currentSelectedCommunity = await getCommunityDetail(tick) as any
    if (!comStore.currentSelectedCommunity?.tick) {
      router.replace('/')
    }
  }

  deployTweetList.value = [];
  // get deploy tweet
  if (comStore.currentSelectedCommunity?.createdByAi) {
    const deployTweet = await getCommunityDeployTweet(comStore.currentSelectedCommunity?.tick, accStore.getAccountInfo?.twitterId)
    const ipshare = await getCommunityDeployerIpshare(comStore.currentSelectedCommunity?.tick)
    console.log('ipshare:', ipshare)
    if (ipshare) {
      comStore.currentSelectedCommunity.ipshare = ipshare as string
    }
    // @ts-ignore
    deployTweetList.value = deployTweet as Tweet[]
  }

  updateProgress();
  setInter(updateProgress, 15000);
  // try {
  //   let conversationId: any = comStore.currentSelectedCommunity?.deboxConversationId;
  //   if (!conversationId) {
  //       // get conversation id from api
  //       conversationId = await getConversationId(comStore.currentSelectedCommunity?.token ?? '');
  //   }
  //   console.log('conversationId:', conversationId)
  //   if (conversationId) {
  //     DeBoxChatWidget.init({
  //         projectId: '0H35zPC1NeleZd59',
  //         zIndex: '9999'
  //     });
  //     // ttai B1R1eRl8'
  //     DeBoxChatWidget.setConversation(conversationId);
  //   }
  // } catch (error) {
  //   console.error('add debox chat widget error:', error)
  // }
})
onUnmounted(() => {
  console.log('unmounted')
  deployTweetList.value = []
  // DeBoxChatWidget.destroy();
})
const topBanner = ref<any>(null)
const topBannerClass = ref('h-[15px] overflow-hidden')
watch([() => topBanner.value, () => deployTweetList.value.length], () => {
  topBannerClass.value = 'h-auto'
  setTimeout(() => {
    pageScrollRef.value.scrollTo({top: topBanner.value.offsetHeight+8})
  })
})

const topBannerContainerRef = ref<any>(null)
watch(() => tabScrollTop.value, () => {
  if(topBannerContainerRef.value?.offsetHeight && tabScrollTop.value>100 && pageScrollTop.value<topBannerContainerRef.value.offsetHeight+12) {
    pageScrollRef.value.scrollTo({top: topBannerContainerRef.value.offsetHeight+12, behavior: 'smooth'})
  }
})

onActivated(async () => {
  pageScrollRef.value.scrollTo({top: pageScrollTop.value})
  tabScrollRef.value.scrollTo({top: tabScrollTop.value})
})

onBeforeRouteLeave((to, from, next) => {
  if (to.path.indexOf('/post-detail')>=0 || to.path.indexOf('/space-detail')>=0 || to.path.indexOf('/predict/')>=0) {
    emitter.emit('setPageAliveState', {isAlive: true, pageName: 'HomeTagDetail'})
  } else {
    emitter.emit('setPageAliveState', {isAlive: false, pageName: 'HomeTagDetail'})
  }
  next()
})

</script>

<template>
  <div class="h-full mobile-scroll-container no-scroll-bar flex flex-col py-2 gap-3 px-3 relative"
       ref="pageScrollRef" @scroll="pageScroll(pageScrollRef, 'page')">
    <div class="grid grid-cols-1 web:hidden gap-3 " ref="topBannerContainerRef">
      <div v-if="deployTweetList.length>0"
           class="col-span-1 border-[1px] border-line bg-grey-fa rounded-2xl px-3.5 flex gap-3 overflow-hide"
           ref="topBanner">
        <TweetItem :tweet="deployTweetList[0]" :show-market-cap="false">
          <template #tweet-action-bar>
            <PostButtonGroup :tweet="deployTweetList[0]"/>
          </template>
          <template #tweet-trade>
            <CommerceBtn :tweet="deployTweetList[0]"/>
          </template>
        </TweetItem>
      </div>
      <div v-else class="col-span-1 web:col-span-2 border-[1px] border-line bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
        <CommunityLogo
          :logo="comStore.currentSelectedCommunity?.logo"
          :show-audio="!!onlineSpace"
        >
          <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] whitespace-nowrap">
                  {{comStore.currentSelectedCommunity?.isImport ? $t('imported') : $t('listed')}}
                </div>
        </CommunityLogo>
        <div class="flex-1 py-1">
          <div class="flex flex-wrap justify-between gap-x-4 items-center">
            <div class="flex items-center">
              <span class="text-content text-h2" :class="comStore.currentSelectedCommunity?.listed ? 'text-orange-normal' : ''">{{ comStore.currentSelectedCommunity?.tick }}</span>
              <button v-if="comStore.currentSelectedCommunity?.createdByAi" class="pl-2 h-5 text-sm rounded-md gradient-text glow-effect">
                {{comStore.currentSelectedCommunity?.version === 5 ? $t('postView.ixo') : $t('postView.aiCreate')}}
              </button>
              <IconLinks :community="comStore.currentSelectedCommunity"/>
            </div>
            <div class="text-base flex gap-1">
              <span class="font-semibold text-grey-64">{{$t('marketCap')}}</span>
              <span class="text-gradient bg-gradient-primary font-semibold tabular-nums">{{ marketCapText }}</span>
            </div>
          </div>
          <div class="flex justify-between items-end gap-3 mt-1">
            <div class="whitespace-pre-line text-h5 leading-4 text-grey-5a">
              {{ comStore.currentSelectedCommunity?.description }}
            </div>
            <button v-if="!!accStore.getAccountInfo?.ethAddr && comStore.currentSelectedCommunity?.creator == accStore.getAccountInfo?.ethAddr"
                    @click="modalStore.setModalVisible(true, GlobalModalType.ModifyCoin)"
                    :disabled="!comStore.currentSelectedCommunity">
              <img class="w-8 h-6" src="~@/assets/icons/icon-edit.svg" alt="">
            </button>
          </div>
        </div>
      </div>
      <div class="col-span-1 web:col-span-3 border-[1px] border-line bg-grey-fa rounded-2xl py-5 px-3.5 flex flex-col gap-3">
        <div v-if="deployTweetList.length>0"  class="flex gap-3 overflow-hide">
          <CommunityLogo
            :logo="comStore.currentSelectedCommunity?.logo"
            size="md"
            :show-audio="!!onlineSpace"
          >
            <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-xs
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] scale-75">
              {{comStore.currentSelectedCommunity?.isImport ? $t('imported') : $t('listed')}}
            </div>
          </CommunityLogo>
          <div class="flex-1 py-1">
            <div class="flex flex-wrap justify-between gap-x-4 items-center">
              <div class="flex items-center">
                <span class="text-content text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
                <IconLinks :community="comStore.currentSelectedCommunity"/>
              </div>
              <div class="text-base flex gap-1">
                <span class="font-semibold text-grey-64">{{ $t('marketCap') }}</span>
                <span class="text-gradient bg-gradient-primary font-semibold tabular-nums">{{ marketCapText }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-semibold whitespace-nowrap">CA</span>
          <div class="bg-surface text-grey-light-active text-sm h-4 flex items-center rounded-[3px]">
            {{ comStore.currentSelectedCommunity?.token }}
          </div>
          <button class="p-1.5 -m-1" @click="onCopy(comStore.currentSelectedCommunity?.token??'')"
                  :disabled="!(comStore.currentSelectedCommunity?.token)">
            <img class="w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="">
          </button>
          <div v-if="tokenExternalLinks" class="flex items-center gap-2 text-xs text-grey-64">
            <a class="hover:text-orange-normal underline underline-offset-2" target="_blank" rel="noopener"
               :href="tokenExternalLinks.explorer">{{ tokenExternalLinks.explorerLabel }}</a>
            <a class="hover:text-orange-normal underline underline-offset-2" target="_blank" rel="noopener"
               :href="tokenExternalLinks.dexScreener">DexScreener</a>
            <a v-if="tokenExternalLinks.gmgn" class="hover:text-orange-normal underline underline-offset-2" target="_blank" rel="noopener"
               :href="tokenExternalLinks.gmgn">GMGN</a>
          </div>
        </div>
        <div v-if="!comStore.currentSelectedCommunity?.isImport" class="text-base font-medium flex items-center gap-1">
          <span>{{$t('postView.curveProgress')}}: {{ progressData[1].value.toFixed(2) }}%</span>
          <el-popover popper-class="c-popper">
            <template #reference>
              <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
            </template>
            <template #default>
              <div class="bg-surface rounded-xl p-2 shadow-popper-tip w-[200px]">
                {{ $t('community.distributionTip') }}
              </div>
            </template>
          </el-popover>
        </div>
        <div v-if="!comStore.currentSelectedCommunity?.isImport" class="flex items-center gap-3">
          <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden w-full
                      bg-surface gap-[2px]">
            <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                        placement="top" popper-class="c-arrow-popper">
              <template #content>
                <div class="flex gap-1 text-grey-normal">
                  <span class="text-sm">
                    {{ index === 0 && isPumpV9OrV10 ? $t('postView.v4HookTransactionDistribution') : data.desc }}
                  </span>
                  <span class="font-semibold text-base">{{data.percent}}</span>
                </div>
              </template>
              <div class="w-full h-full bg-grey-light" :style="{width:`${data.trackWidth}%`}">
                <div class="h-full"
                     :style="{background: data.background, width:`${data.value.toFixed(2)}%`}" >
                </div>
              </div>
            </el-tooltip>
          </div>
          <!-- <button class="bg-grey-normal px-6 h-8 text-white text-sm rounded-full whitespace-nowrap font-bold"
          @click="$router.push(`/buy-sell/${$route.params?.id??''}`)">
            Trade
          </button> -->
          <!-- <el-popover popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
            <template #reference>
              <button class="bg-grey-normal px-3 h-8 text-white text-sm rounded-full whitespace-nowrap font-bold">
                Post to Earn
              </button>
            </template>
            <template #default>
              <div class="bg-grey-normal rounded-2xl px-3 py-4 w-[240px] shadow-popper-tip text-white text-lg flex flex-col gap-2 items-start">
                <button @click="onTweetType(CurationType.TWEET)"
                        :disabled="checkingAccount"
                        class="whitespace-nowrap flex items-center space-x-3">
                    Tweet on-chain
                    <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                </button>
                <button @click="onTweetType(CurationType.SPACE)"
                        :disabled="checkingAccount"
                        class="whitespace-nowrap flex items-center space-x-3">
                        Tweet an onchain Space
                    <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                </button>
              </div>
            </template>
          </el-popover> -->
        </div>
        <div class="flex justify-center space-x-4">
          <button :disabled="checkingTweet" @click="checkTweet" class="w-1/3 bg-surface border border-orange-normal text-orange-normal flex justify-center items-center text-h5 rounded-full h-11 transition-colors">
            Blinks
            <i-ep-loading v-show="checkingTweet" class="animate-spin" />
          </button>
          <button class="w-1/3 bg-gradient-primary text-white flex justify-center items-center text-h5 gap-1 rounded-full h-11"
                  @click="showTradeBox=!showTradeBox">
            <span>{{$t('trade')}}</span>
            <i-ep-caret-bottom  class="transition-transform duration-300"
                                :class="{ 'rotate-180': showTradeBox }"></i-ep-caret-bottom>
          </button>
          <button :disabled="checkingTweet" @click="checkTipCurate" class="w-1/3 bg-surface border border-orange-normal text-orange-normal flex justify-center items-center text-h5 rounded-full h-11 transition-colors">
            {{$t('tip')}} ${{ comStore.currentSelectedCommunity?.tick }}
            <i-ep-loading v-show="checkingTweet" class="animate-spin" />
          </button>

          <el-popover popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
            <template #reference>
              <button class="w-1/3 bg-surface border border-orange-normal text-orange-normal text-h5 rounded-full h-11 transition-colors">Post</button>
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
    <div>
      <BuyAndSellView v-if="(showTradeBox || width>800)" />
      <div class="min-h-0 web:min-h-full web:h-full web:sticky web:top-[0px]" ref="tabContainerRef">
      <div class="flex gap-2 web:h-full">
        <div class="w-full flex flex-col gap-2 web:h-full web:overflow-hidden">
          <div class="overflow-x-auto no-scroll-bar flex justify-between items-center gap-2 bg-surface h-12 min-h-12 px-4 rounded-2xl mb-2">
            <button v-for="tab of tabOptions" :key="tab.key"
                    class="px-3.5 rounded-full h-8 text-h3 font-medium whitespace-nowrap transition-colors"
                    :class="tab.key===activeTab?'bg-grey-normal text-white shadow-sm':'text-grey-3f hover:text-content hover:bg-surface-2'"
                    @click="selectTab(tab.key)">{{$t(tab.label)}}</button>
          </div>
          <div class="min-h-0 web:flex-1 web:overflow-auto no-scroll-bar" ref="tabScrollRef" @scroll="pageScroll(tabScrollRef, 'tab')">
            <!-- <TagGroup v-if="activeTab==='group'" class="flex-1 overflow-hidden"/> -->
            <TagContent v-if="activeTab==='content'"/>
            <PredictIndex v-if="activeTab==='predict'"/>
            <TagTippedContent v-if="activeTab==='tipped'"/>
            <TagProposal v-if="activeTab==='proposal'"/>
            <RecordList v-if="activeTab==='trade' && comStore.currentSelectedCommunity?.token"/>
            <CreditIndex v-if="activeTab==='credit'"/>
            <TagToken v-if="activeTab==='token'"/>
            <SpcxbLiquidity v-if="activeTab==='liquidity'"/>
            <PostAI v-if="activeTab==='ai'"/>
            <CommunityMiniTagIndex  v-if="activeTab==='activity'"/>
          </div>
        </div>
        <!-- Teleport 目标保持挂载，避免社区数据异步到达时丢失信息栏。 -->
        <div ref="normalSidebarTarget"
             class="web:w-[340px] web:min-w-[340px] hidden web:flex flex-col gap-2 h-full overflow-auto no-scroll-bar"></div>
        <Teleport v-if="communitySidebarTarget" :to="communitySidebarTarget">
        <div class="web:w-[340px] web:min-w-[340px] hidden web:flex flex-col gap-2 h-full overflow-auto no-scroll-bar">
          <div class="flex flex-col gap-2">
            <!-- 社区身份卡：始终置于部署推文卡上方，凸显社区身份 -->
            <div class="border-[1px] border-line bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
              <CommunityLogo
                :logo="comStore.currentSelectedCommunity?.logo"
                :show-audio="!!onlineSpace"
              >
                <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] whitespace-nowrap">
                  {{comStore.currentSelectedCommunity?.isImport ? $t('imported') : $t('listed')}}
                </div>
              </CommunityLogo>
              <div class="flex-1 py-1">
                <div class="flex flex-wrap justify-between gap-x-4 items-center">
                  <div class="flex items-center">
                    <span class="text-content text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
                    <IconLinks :community="comStore.currentSelectedCommunity"/>
                  </div>
                  <div class="text-base flex gap-1">
                    <span class="font-semibold text-grey-64">{{ $t('marketCap') }}</span>
                    <span class="text-gradient bg-gradient-primary font-semibold tabular-nums">{{ marketCapText }}</span>
                  </div>
                </div>
                <div class="flex justify-between items-end gap-3 mt-1">
                  <div class="whitespace-pre-line text-h5 leading-4 text-grey-5a">
                    {{ comStore.currentSelectedCommunity?.description }}
                  </div>
                  <button v-if="!!accStore.getAccountInfo?.ethAddr && comStore.currentSelectedCommunity?.creator == accStore.getAccountInfo?.ethAddr"
                          @click="modalStore.setModalVisible(true, GlobalModalType.ModifyCoin)"
                          :disabled="!comStore.currentSelectedCommunity">
                    <img class="w-8 h-6" src="~@/assets/icons/icon-edit.svg" alt="">
                  </button>
                </div>
              </div>
            </div>
            <!-- 部署推文卡：置于社区身份卡下方 -->
            <div v-if="deployTweetList.length>0"
                 class="border-[1px] border-line bg-grey-fa rounded-2xl px-3.5 flex gap-3 overflow-hide">
              <TweetItem :tweet="deployTweetList[0]" :show-market-cap="false">
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="deployTweetList[0]"/>
                </template>
                <template #tweet-trade>
                  <CommerceBtn :tweet="deployTweetList[0]"/>
                </template>
              </TweetItem>
            </div>
            <div class="border-[1px] border-line bg-grey-fa rounded-2xl py-5 px-3.5 flex flex-col gap-3">
              <div class="flex items-center gap-2 ">
                <span class="text-sm font-semibold whitespace-nowrap">CA</span>
                <div class="bg-surface text-grey-light-active text-sm h-4 flex items-center rounded-[3px] flex-1 truncate">
                  {{ comStore.currentSelectedCommunity?.token }}
                </div>
                <button class="p-2 -m-1" @click="onCopy(comStore.currentSelectedCommunity?.token??'')"
                        :disabled="!(comStore.currentSelectedCommunity?.token)">
                  <img class="w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="">
                </button>
              </div>
              <div v-if="tokenExternalLinks" class="flex items-center gap-3 text-xs text-grey-64">
                <a class="underline underline-offset-2" target="_blank" rel="noopener"
                   :href="tokenExternalLinks.explorer">{{ tokenExternalLinks.explorerLabel }}</a>
                <a class="underline underline-offset-2" target="_blank" rel="noopener"
                   :href="tokenExternalLinks.dexScreener">DexScreener</a>
                <a v-if="tokenExternalLinks.gmgn" class="underline underline-offset-2" target="_blank" rel="noopener"
                   :href="tokenExternalLinks.gmgn">GMGN</a>
              </div>
              <div v-if="!comStore.currentSelectedCommunity?.isImport" class="text-base font-medium flex items-center gap-1">
                <span>{{$t('postView.curveProgress')}}: {{ progressData[1].value.toFixed(2) }}%</span>
                <el-popover popper-class="c-popper">
                  <template #reference>
                    <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
                  </template>
                  <template #default>
                    <div class="bg-surface rounded-xl p-2 shadow-popper-tip">
                      {{ $t('community.distributionTip') }}
                    </div>
                  </template>
                </el-popover>
              </div>
              <div v-if="!comStore.currentSelectedCommunity?.isImport" class="flex items-center gap-3">
                <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden w-full
                      bg-surface gap-[2px]">
                  <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                              placement="top" popper-class="c-arrow-popper">
                    <template #content>
                      <div class="flex gap-1 text-grey-normal">
                        <span class="text-sm">
                          {{ index === 0 && isPumpV9OrV10 ? $t('postView.v4HookTransactionDistribution') : data.desc }}
                        </span>
                        <span class="font-semibold text-base">{{data.percent}}</span>
                      </div>
                    </template>
                    <div class="w-full h-full bg-grey-light" :style="{width:`${data.trackWidth}%`}">
                      <div class="h-full"
                           :style="{background: data.background, width:`${data.value.toFixed(2)}%`}" >
                      </div>
                    </div>
                  </el-tooltip>
                </div>
              </div>
              <div class="flex justify-center text-white space-x-8">
                <button :disabled="checkingTweet" @click="checkTweet" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
                  Blinks
                  <i-ep-loading v-show="checkingTweet" class="animate-spin" />
                </button>

                <button v-if="accStore.getAccountInfo?.accountType !== 1" :disabled="checkingTweet" @click="checkTipCurate" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
                  {{$t('tip')}} ${{ comStore.currentSelectedCommunity?.tick }}
                  <i-ep-loading v-show="checkingTweet" class="animate-spin" />
                </button>

                
                <button v-if="accStore.getAccountInfo?.accountType === 1" 
                  @click="onTweetType(CurationType.TWEET)"
                class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post</button>
                <el-popover v-else popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
                  <template #reference>
                    <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post</button>
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
                        {{$t('postView.spaceOnChain') }}
                        <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                      </button>
                    </div>
                  </template>
                </el-popover>
                <!-- <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post To Earn</button> -->
              </div>
              <!-- <button class="bg-grey-normal px-6 h-8 text-white text-sm rounded-full whitespace-nowrap font-bold w-full"
              @click="$router.push(`/buy-sell/${$route.params?.id??''}`)">
                Trade
              </button> -->
              <!-- <el-popover popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
                <template #reference>
                  <button class="bg-grey-normal px-3 h-8 text-white text-sm rounded-full whitespace-nowrap font-bold">
                    Post to Earn
                  </button>
                </template>
                <template #default>
                  <div class="bg-grey-normal rounded-2xl px-3 py-4 w-[240px] shadow-popper-tip text-white text-lg flex flex-col gap-2 items-start">
                    <button @click="onTweetType(CurationType.TWEET)"
                            :disabled="checkingAccount"
                            class="whitespace-nowrap flex items-center space-x-3">
                        Tweet on-chain
                        <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                    </button>
                    <button @click="onTweetType(CurationType.SPACE)"
                            :disabled="checkingAccount"
                            class="whitespace-nowrap flex items-center space-x-3">
                            Tweet an onchain Space
                        <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                    </button>
                  </div>
                </template>
              </el-popover> -->
            </div>
          </div>
          <div class="h-full sticky top-[0px]">
            <PostAI v-if="activeTab !== 'ai'" compact/>
          </div>
        </div>
        </Teleport>
      </div>
      </div>
    </div>
  </div>
  <el-dialog v-model="showModal"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
      <CreateBlinkModal @close="showModal = false" v-if="curationType == CurationType.BLINK" />
      <CreateTipCurateModal @close="showModal = false" v-if="curationType == CurationType.TIP_CURATE" />
      <CreateTweetModal @close="showModal = false" v-if="curationType == CurationType.TWEET" />
      <CreateSpaceModal @close="showModal = false" v-if="curationType == CurationType.SPACE" />
  </el-dialog>
</template>

<style scoped>
.gradient-text {
  background: linear-gradient(
    300deg,
    #ff0080,
    #ff8c00,
    #40e0d0,
    #7b68ee,
    #ff0080
  );
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
