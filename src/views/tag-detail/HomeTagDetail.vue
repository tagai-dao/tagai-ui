<script setup lang="ts">
import { onMounted, ref, computed, onActivated, nextTick, onUnmounted } from "vue";
import {useModalStore, useStateStore} from "@/stores/common";
import { useCommunityStore } from "@/stores/community";
import {GlobalModalType} from "@/types";
import TagContent from "@/views/tag-detail/TagContent.vue";
import TagCredit from "@/views/tag-detail/TagCredit.vue";
import TagToken from "@/views/tag-detail/TagToken.vue";
import TagProposal from "@/views/tag-detail/TagProposal.vue";
import TagTippedContent from "@/views/tag-detail/TagTippedContent.vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { getCommunityDetail, getIpshareInfo, getConversationId } from "@/apis/api";
import { getTokenInfo } from '@/utils/pump'
import {useInterval, usePageScroll, useTools} from "@/composables/useTools";
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import CreateBlinkModal from '@/components/common/CreateBlinkModal.vue'
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import { useCurationStore } from "@/stores/curation";
import { formatPrice } from "@/utils/helper";
import { TotalSupply, SocialSupply, BondingCurveSupply, ListSupply } from '@/config'
import { ethers } from "ethers";
import IconLinks from "@/components/home/IconLinks.vue";
import BuyAndSellView from "../buy-sell/BuyAndSellView.vue";
import RecordList from "../buy-sell/RecordList.vue";
import PostAI from "@/views/tag-detail/PostAI.vue";
import { OperateType, useTweet } from "@/composables/useTweet";
import CreateTipCurateModal from "@/components/common/CreateTipCurateModal.vue";
import emitter from "@/utils/emitter";
import { DeBoxChatWidget } from '@debox-pro/chat-widget-html';


const tabOptions = [
  // {label: 'Group', key: 'group'},
  {label: 'Square', key: 'content'},
  {label: 'Tipped', key: 'tipped'},
  {label: 'Proposal', key: 'proposal'},
  {label: 'Trades', key: 'trade'},
  {label: 'Credit', key: 'credit'},
  {label: 'Token', key: 'token'},
  {label: 'AI', key: 'ai'},
]
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
  if(tabScrollRef.value.scrollTop>100 && document.body.clientWidth>1104) {
    pageScrollTo(pageScrollRef.value, 412)
  }
}
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
const {onCopy} = useTools()
const { preCheckCuration } = useTweet()

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
  getTokenInfo([comStore.currentSelectedCommunity!]).then((coms: any) => {
    const com = coms[0]
    comStore.currentSelectedCommunity = coms[0]
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

    if (ethers.isAddress(accStore.getAccountInfo.ethAddr)) {
      if (!accStore.ipshare?.ethAddr) {
        const ipshare: any = await getIpshareInfo(accStore.getAccountInfo.ethAddr);
        console.log('ipshare:', ipshare)
        accStore.ipshare = ipshare;
      }
    }else {
      modalStore.setModalVisible(true, GlobalModalType.BondEth)
      return;
    }
    console.log('ipshare2:', accStore.ipshare)
    if (!ethers.isAddress(accStore.ipshare?.ethAddr)) {
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

  updateProgress();
  setInter(updateProgress, 15000);
  try {
    let conversationId: any = comStore.currentSelectedCommunity?.deboxConversationId;
    if (!conversationId) {
        // get conversation id from api
        conversationId = await getConversationId(comStore.currentSelectedCommunity?.token ?? '');
    }
    console.log('conversationId:', conversationId)
    if (conversationId) {
      DeBoxChatWidget.init({
          projectId: '0H35zPC1NeleZd59',
          zIndex: '9999'
      });
      // ttai B1R1eRl8'
      DeBoxChatWidget.setConversation(conversationId);
    }
  } catch (error) {
    console.error('add debox chat widget error:', error)
  }
})
onUnmounted(() => {
  console.log('unmounted')
  DeBoxChatWidget.destroy();
})

onActivated(async () => {
  pageScrollRef.value.scrollTo({top: pageScrollTop.value})
  tabScrollRef.value.scrollTo({top: tabScrollTop.value})
})

onBeforeRouteLeave((to, from, next) => {
  if (to.path.indexOf('/post-detail')>=0) {
    emitter.emit('setPageAliveState', {isAlive: true, pageName: 'HomeTagDetail'})
  } else {
    emitter.emit('setPageAliveState', {isAlive: false, pageName: 'HomeTagDetail'})
  }
  next()
})

</script>

<template>
  <div class="h-full overflow-auto no-scroll-bar pt-2 pb-2 flex flex-col gap-3 px-3 relative"
       ref="pageScrollRef" @scroll="pageScroll(pageScrollRef, 'page')">
    <div class="grid grid-cols-1 web:hidden gap-3">
      <div class="col-span-1 web:col-span-2 border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
        <div class="w-20 h-20 rounded-2xl bg-grey-light-active shadow-tag-logo flex items-center justify-center relative overflow-hidden">
          <img class="w-full h-full rounded-2xl" :src="comStore.currentSelectedCommunity?.logo.startsWith('https://tiptag') ? comStore.currentSelectedCommunity?.logo + '?x-oss-process=image/resize,w_200' : comStore.currentSelectedCommunity?.logo" alt="">
          <img v-if="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
          <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] whitespace-nowrap">{{$t('listed')}}</div>
        </div>
        <div class="flex-1 py-1">
          <div class="flex flex-wrap justify-between gap-x-4 items-center">
            <div class="flex items-center">
              <span class="text-black text-h2" :class="comStore.currentSelectedCommunity?.listed ? 'text-orange-normal' : ''">{{ comStore.currentSelectedCommunity?.tick }}</span>
              <button v-if="comStore.currentSelectedCommunity?.createdByAi" class="pl-2 h-5 text-sm rounded-md gradient-text glow-effect">
                {{$t('postView.aiCreate')}}
              </button>
              <IconLinks :community="comStore.currentSelectedCommunity"/>
            </div>
            <div class="text-base flex gap-1">
              <span class="font-semibold text-grey-64">{{$t('marketCap')}}</span>
              <span class="text-gradient bg-gradient-primary font-semibold">{{ formatPrice(Math.round(parseFloat(comStore.currentSelectedCommunity?.marketCap as any) * useStateStore().ethPrice)) }}</span>
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
      <div class="col-span-1 web:col-span-3 border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold whitespace-nowrap">CA</span>
          <div class="bg-white text-grey-light-active text-sm h-4 flex items-center rounded-[3px]">
            {{ comStore.currentSelectedCommunity?.token }}
          </div>
          <button @click="onCopy(comStore.currentSelectedCommunity?.token??'')"
                  :disabled="!(comStore.currentSelectedCommunity?.token)">
            <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="">
          </button>
        </div>
        <div class="text-base font-medium flex items-center gap-1">
          <span>{{$t('postView.curveProgress')}}: {{ progressData[1].value.toFixed(2) }}%</span>
          <el-popover popper-class="c-popper">
            <template #reference>
              <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
            </template>
            <template #default>
              <div class="bg-white rounded-xl p-2 shadow-popper-tip w-[200px]">
                {{ $t('community.distributionTip') }}
              </div>
            </template>
          </el-popover>
        </div>
        <div class="flex items-center gap-3">
          <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden w-full
                      bg-white gap-[2px]">
            <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                        placement="top" popper-class="c-arrow-popper">
              <template #content>
                <div class="flex gap-1 text-grey-normal">
                  <span class="text-sm">{{data.desc}}</span>
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
        <div class="flex justify-center text-white space-x-4">
          <!-- <button :disabled="checkingTweet" @click="checkTweet" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
            Blinks
            <i-ep-loading v-show="checkingTweet" class="animate-spin" />
          </button> -->

          <button :disabled="checkingTweet" @click="checkTipCurate" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
            {{$t('tip')}} ${{ comStore.currentSelectedCommunity?.tick }}
            <i-ep-loading v-show="checkingTweet" class="animate-spin" />
          </button>

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
    <BuyAndSellView />
    <div class="h-full sticky top-[0px]">
      <div class="h-full flex gap-2">
        <div class="h-full w-full flex flex-col gap-2  overflow-hidden">
          <div class="overflow-x-auto no-scroll-bar flex justify-between items-center gap-2 bg-white h-12 min-h-12 px-4 rounded-2xl mb-2">
            <button v-for="tab of tabOptions" :key="tab.key"
                    class="px-3 rounded-full h-8 text-h3 whitespace-nowrap"
                    :class="[tab.key===activeTab?'bg-grey-normal text-white':'text-grey-3f', tab.key==='ai'?'web:hidden':'']"
                    @click="activeTab=tab.key">{{$t(tab.label)}}</button>
          </div>
          <div class="flex-1 overflow-auto no-scroll-bar" ref="tabScrollRef" @scroll="pageScroll(tabScrollRef, 'tab')">
            <!-- <TagGroup v-if="activeTab==='group'" class="flex-1 overflow-hidden"/> -->
            <TagContent v-if="activeTab==='content'"/>
            <TagTippedContent v-if="activeTab==='tipped'"/>
            <TagProposal v-if="activeTab==='proposal'"/>
            <RecordList v-if="activeTab==='trade' && comStore.currentSelectedCommunity?.token"/>
            <TagCredit v-if="activeTab==='credit'"/>
            <TagToken v-if="activeTab==='token'"/>
            <PostAI class="web:hidden" v-if="activeTab==='ai'"/>
          </div>
        </div>
        <div class="web:w-[340px] web:min-w-[340px] hidden web:flex flex-col gap-2 h-full overflow-auto no-scroll-bar">
          <div class="flex flex-col gap-2">
            <div class="border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
              <div class="w-20 h-20 rounded-2xl bg-grey-light-active shadow-tag-logo flex items-center justify-center relative overflow-hidden">
                <img class="w-full h-full rounded-2xl" :src="comStore.currentSelectedCommunity?.logo.startsWith('https://tiptag') ? comStore.currentSelectedCommunity?.logo + '?x-oss-process=image/resize,w_200' : comStore.currentSelectedCommunity?.logo" alt="">
                <img v-if="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
                <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg]">{{ $t('listed') }}</div>
              </div>
              <div class="flex-1 py-1">
                <div class="flex flex-wrap justify-between gap-x-4 items-center">
                  <div class="flex items-center">
                    <span class="text-black text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
                    <IconLinks :community="comStore.currentSelectedCommunity"/>
                  </div>
                  <div class="text-base flex gap-1">
                    <span class="font-semibold text-grey-64">{{ $t('marketCap') }}</span>
                    <span class="text-gradient bg-gradient-primary font-semibold">{{ formatPrice(Math.round(parseFloat(comStore.currentSelectedCommunity?.marketCap as any) * useStateStore().ethPrice)) }}</span>
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
            <div class="border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex flex-col gap-3">
              <div class="flex items-center gap-2 ">
                <span class="text-sm font-semibold whitespace-nowrap">CA</span>
                <div class="bg-white text-grey-light-active text-sm h-4 flex items-center rounded-[3px] flex-1 truncate">
                  {{ comStore.currentSelectedCommunity?.token }}
                </div>
                <button @click="onCopy(comStore.currentSelectedCommunity?.token??'')"
                        :disabled="!(comStore.currentSelectedCommunity?.token)">
                  <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="">
                </button>
              </div>
              <div class="text-base font-medium flex items-center gap-1">
                <span>{{$t('postView.curveProgress')}}: {{ progressData[1].value.toFixed(2) }}%</span>
                <el-popover popper-class="c-popper">
                  <template #reference>
                    <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
                  </template>
                  <template #default>
                    <div class="bg-white rounded-xl p-2 shadow-popper-tip">
                      {{ $t('community.distributionTip') }}
                    </div>
                  </template>
                </el-popover>
              </div>
              <div class="flex items-center gap-3">
                <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden w-full
                      bg-white gap-[2px]">
                  <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                              placement="top" popper-class="c-arrow-popper">
                    <template #content>
                      <div class="flex gap-1 text-grey-normal">
                        <span class="text-sm">{{data.desc}}</span>
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
                <!-- <button :disabled="checkingTweet" @click="checkTweet" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
                  Blinks
                  <i-ep-loading v-show="checkingTweet" class="animate-spin" />
                </button> -->

                <button :disabled="checkingTweet" @click="checkTipCurate" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
                  {{$t('tip')}} ${{ comStore.currentSelectedCommunity?.tick }}
                  <i-ep-loading v-show="checkingTweet" class="animate-spin" />
                </button>

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
                        {{$t('postView.spaceOnChain') }}
                        <i-ep-loading v-show="checkingAccount" class="animate-spin" />
                      </button>
                    </div>
                  </template>
                </el-popover>
                <!-- <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post To Earn</button> -->
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
          </div>
          <div class="h-full sticky top-[0px]">
            <PostAI/>
          </div>
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
