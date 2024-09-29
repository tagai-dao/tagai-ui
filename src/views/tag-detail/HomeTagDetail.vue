<script setup lang="ts">
import {onMounted, ref, computed, onActivated} from "vue";
import {useModalStore, useStateStore} from "@/stores/common";
import { useCommunityStore } from "@/stores/community";
import {GlobalModalType} from "@/types";
import TagContent from "@/views/tag-detail/TagContent.vue";
import TagCredit from "@/views/tag-detail/TagCredit.vue";
import TagToken from "@/views/tag-detail/TagToken.vue";
import {useRoute, useRouter} from "vue-router";
import { getCommunityDetail, getIpshareInfo } from "@/apis/api";
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

const tabOptions = [
  // {label: 'Group', key: 'group'},
  {label: 'Square', key: 'content'},
  {label: 'Credit', key: 'credit'},
  {label: 'Token', key: 'token'},
]
enum CurationType {
  TWEET,
  SPACE,
  BLINK
}

const { pageScroll, pageScrollTo} = usePageScroll()
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
const {onCopy} = useTools()

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
    progressData.value = [
      {...progressData.value[0], value: (com.totalClaimedSocialRewards / SocialSupply * 100), percent: '15%'},
      {...progressData.value[1], value: (com.bondingCurveSupply / BondingCurveSupply * 100), percent:'70%'},
      {...progressData.value[2], value: 100, percent:'15%', desc: com.listed ? 'Listed' : 'Pending List'}
    ]
  }).catch(e => {
    console.error(2, e)
  })
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
      const ipshare: any = await getIpshareInfo(accStore.getAccountInfo.ethAddr);
      accStore.ipshare = ipshare;
    }
    if (!accStore.ipshare.ethAddr) {
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
  setInter(updateProgress, 3000);
})

onActivated(() => {
  pageScrollTo(pageScrollRef.value)
})
</script>

<template>
  <div class="h-full overflow-auto no-scroll-bar py-2 flex flex-col gap-3 px-3 relative"
       ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
    <div class="grid grid-cols-1 web:grid-cols-5 gap-3">
      <div class="col-span-1 web:col-span-2 border-[1px] border-white bg-grey-fa rounded-2xl py-5 px-3.5 flex gap-3 overflow-hide">
        <div class="w-20 h-20 rounded-2xl bg-grey-light-active shadow-tag-logo flex items-center justify-center relative overflow-hidden">
          <img class="w-full h-full rounded-2xl" :src="comStore.currentSelectedCommunity?.logo" alt="">
          <img v-if="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
          <div v-if="comStore.currentSelectedCommunity?.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg]">listed</div>
        </div>
        <div class="flex-1 py-1">
          <div class="flex flex-wrap justify-between gap-x-4 items-center">
            <div class="flex items-center">
              <span class="text-black text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
              <IconLinks :community="comStore.currentSelectedCommunity"/>
            </div>
            <div class="text-base flex gap-1">
              <span class="font-semibold text-grey-64">market cap</span>
              <span class="text-gradient bg-gradient-primary font-semibold">{{ formatPrice(parseFloat(comStore.currentSelectedCommunity?.marketCap as any) * useStateStore().ethPrice) }}</span>
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
          <span class="text-sm font-semibold">CA</span>
          <div class="bg-white text-grey-light-active text-xs h-4 flex items-center flex-1 rounded-[3px]">
            {{ comStore.currentSelectedCommunity?.token }}
          </div>
          <button @click="onCopy(comStore.currentSelectedCommunity?.token??'')"
                  :disabled="!(comStore.currentSelectedCommunity?.token)">
            <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="">
          </button>
        </div>
        <div class="text-base font-medium flex items-center gap-1">
          <span>Bonding Curve progress：{{ progressData[1].value.toFixed(2) }}%</span>
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
                <div class="flex gap-1">
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
          <button class="bg-grey-normal px-6 h-8 text-white text-sm rounded-full whitespace-nowrap font-bold"
          @click="$router.push(`/buy-sell/${$route.params?.id??''}`)">
            Trade
          </button>
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
        <div class="flex justify-center text-white space-x-8">
          <button :disabled="checkingTweet" @click="checkTweet" class="w-1/3 bg-gradient-primary flex justify-center items-center text-h5 rounded-full h-11">
            Blinks
            <i-ep-loading v-show="checkingTweet" class="animate-spin" />
          </button>

          <el-popover popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
            <template #reference>
              <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post To Earn</button>
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
          </el-popover>
          <!-- <button class="w-1/3 bg-gradient-primary text-h5 rounded-full h-11">Post To Earn</button> -->
        </div>
      </div>
    </div>
    <div class="flex justify-between items-center gap-2 bg-white h-12 min-h-12 px-4 rounded-2xl">
      <button v-for="tab of tabOptions" :key="tab.key"
              class="px-3 rounded-full h-8 text-h3"
              :class="tab.key===activeTab?'bg-grey-normal text-white':'text-grey-3f'"
              @click="activeTab=tab.key">{{tab.label}}</button>
    </div>
    <!-- <TagGroup v-if="activeTab==='group'" class="flex-1 overflow-hidden"/> -->
    <TagContent v-if="activeTab==='content'"/>
    <TagCredit v-if="activeTab==='credit'"/>
    <TagToken v-if="activeTab==='token'"/>
  </div>
  <el-dialog v-model="showModal"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
      <CreateBlinkModal @close="showModal = false" v-if="curationType == CurationType.BLINK" />
      <CreateTweetModal @close="showModal = false" v-if="curationType == CurationType.TWEET" />
      <CreateSpaceModal @close="showModal = false" v-if="curationType == CurationType.SPACE" />
  </el-dialog>
</template>

<style scoped>

</style>
