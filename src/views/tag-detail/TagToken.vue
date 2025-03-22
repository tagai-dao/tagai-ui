<script setup lang="ts">
import { useCommunityStore } from "@/stores/community";
import {onMounted, ref} from "vue";
import { formatAddress, formatAmount, formatPrice, sleep } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { type TokenHoldingList } from "@/types";
import { getHolderList } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { TotalSupply, SocialSupply, ListSupply } from '@/config'
import UserAvatar from "@/components/common/UserAvatar.vue";
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4 } from "@/config";

const comStore = useCommunityStore()

const holdingList = ref<TokenHoldingList[]>([])

const chartOptions = ref({
  chart: {
    height: 200,
    type: 'line',
    toolbar: {
      show: false
    },
  },
  stroke: {
    width: 5,
    curve: 'smooth'
  },
  xaxis: {
    type: 'datetime',
    categories: ['1/11/2000', '2/11/2000', '3/11/2000', '4/11/2000', '5/11/2000', '6/11/2000', '7/11/2000', '8/11/2000', '9/11/2000', '10/11/2000', '11/11/2000', '12/11/2000', '1/11/2001', '2/11/2001', '3/11/2001','4/11/2001' ,'5/11/2001' ,'6/11/2001'],
    tickAmount: 10,
    labels: {
      show: false
    }
  },
  yaxis: {
    labels: {
      show: false
    }
  },
  title: {
    show: false
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      type: 'horizontal',
      opacityFrom: 1,
      opacityTo: 1,
      stops: [0, 50, 100],
      colorStops: [
        [
          { offset: 0, color: '#FF8F40', opacity: 1},
          { offset: 35, color: '#F963B5', opacity: 1},
          { offset: 65, color: '#4040F7', opacity: 1}
        ]
      ]
    },
  }
})
const series = ref([{
  name: 'Price',
  data: [4, 3, 10, 9, 29, 19, 22, 9, 12, 7, 19, 5, 13, 9, 17, 2, 7, 5]
}])

const chartTabs = ['12H', '24H', '1W', '1Y', 'All']
const activeTab = ref('12H')

const progressData = ref([
  {amount: 20, stopHeight: 20, background: '#FA8383'},
  {amount: 20, stopHeight: 40, background: '#FACA83'},
  {amount: 20, stopHeight: 60, background: '#B0FA83'},
  {amount: 20, stopHeight: 80, background: '#83DDFA'},
  {amount: 20, stopHeight: 100, background: '#9B83FA'},
])


const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);

async function onRefresh() {
  if (loading.value) return;
  refreshing.value = true;
  finished.value = false;
  try{
    let list: any = await getHolderList(comStore.currentSelectedCommunity!.token)
    if (list && list.length > 0) {
      list = list.map((h: any) => {
        return {
          ...h,
          community: comStore.currentSelectedCommunity,
          amount: h.amount.toString() / 1e18,
          ethAddr: h.holder
        }
      })
      holdingList.value = list as TokenHoldingList[];
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  if (refreshing.value || finished.value || holdingList.value.length == 0) return;
  loading.value = true;
  try{
    let list: any = await getHolderList(comStore.currentSelectedCommunity!.token, Math.floor((holdingList.value.length - 1) / 30) + 1);
    if (list && list.length > 0) {
      list = list.map((h: any) => {
        return {
          ...h,
          community: comStore.currentSelectedCommunity,
          amount: h.amount.toString() / 1e18,
          ethAddr: h.holder
        }
      })
      holdingList.value = holdingList.value.concat(list as TokenHoldingList[]);
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

const onUserAvatar = () => {

}
function replaceEmptyImg(e: any) {
    e.target.src = emptyAvatar;
}

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.3)
  }
  onRefresh()
})
</script>

<template>
  <div class="" v-if="comStore.currentSelectedCommunity?.tick">
    <!-- <div class="bg-white p-3 rounded-2xl">
      <div class="flex justify-between items-center">
        <div class="flex items-end gap-1">
          <span class="text-lg font-bold leading-5">LATC</span>
          <span class="text-xs text-grey-6f leading-4">Chart</span>
        </div>
        <div class="text-red-e6 text-base">0.2886 $</div>
      </div>
      <apexchart type="line" height="200" ref="chart"
                 :options="chartOptions"
                 :series="series"></apexchart>
      <div class="bg-grey-e7 h-14 rounded-full p-1 flex items-center">
        <button v-for="tab of chartTabs" :key="tab"
                class="h-full flex-1 rounded-full text-h5"
                :class="activeTab===tab?'bg-white shadow-tab':'text-grey-6f'">{{tab}}</button>
      </div>
    </div> -->
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">{{$t('postView.tokenInfo')}}</div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{ $t('postView.price') }}</span>
        <span class="text-h5 text-black-19">{{ formatPrice((comStore.currentSelectedCommunity.price ?? 0) * useStateStore().ethPrice) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.totalSupply')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(TotalSupply) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.socialSupply')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(SocialSupply) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.bindCurveSold')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(comStore.currentSelectedCommunity.bondingCurveSupply) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.dexLiquidity')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(ListSupply) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.cap')}}</span>
        <span class="text-h5 text-black-19">{{ formatPrice(Math.round((comStore.currentSelectedCommunity.marketCap ?? 0) * useStateStore().ethPrice)) }}</span>
      </div>
    </div>
    <!-- <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">Tweet Pool</div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Content and Interaction</span>
        <span class="text-h5 text-black-19">60%(0.236M)</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Space</span>
        <span class="text-h5 text-black-19">40%(0.084M)</span>
      </div>
      <div class="my-1">
        <div class="text-h4 text-grey-93 mb-1">Social Distribution Strategy</div>
        <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden">
          <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                      placement="top-start">
            <template #content>
              <span class="text-xs">{{data.amount}}</span>
            </template>
            <div class="h-full"
                 :style="{ flex: 1,  background: data.background}" >
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="reward" class="text-h4 text-grey-93">Unclaimed Reward:</label>
        <div class="border-[1px] border-grey-c9 rounded-xl h-11 flex items-center gap-2 px-5">
          <input class="flex-1 text-h3" :value="123"
                 type="text" id="reward">
          <span class="text-h3">$ LATC</span>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="reward" class="text-h4 text-grey-93">Pool Contract:</label>
        <div class="border-[1px] border-grey-c9 rounded-xl h-11 flex items-center gap-2 px-5">
          <input class="flex-1 text-h3" :value="'0x3475...3880'" disabled type="text" id="reward">
        </div>
      </div>
    </div> -->
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">{{$t('postView.holderList')}}</div>
      <van-pull-refresh
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
      <div class="grid grid-cols-5 gap-x-2 h-8 items-center text-h4"
           v-for="(holder, i) of holdingList" :key="i">
          <div class="col-span-3 truncate flex items-center gap-1">
            <span class="min-w-4">{{i + 1}}</span>
            <UserAvatar :profile-img="holder.profile" :name="holder.twitterName" :username="holder.twitterUsername"
                    :followers="holder.followers" :followings="holder.followings"
                    :eth-addr="holder.ethAddr" :credit="0"
                    :steem-id="holder.steemId" :teleported="true">
              <template #avatar-img>
                <img v-if="holder.profile"
                 class="w-4 h-4 min-w-4 rounded-full cursor-pointer bg-color2A"
                 @click.stop="onUserAvatar" @error="replaceEmptyImg" :src="holder.profile"
                 alt="">
            <img v-else
                 class="w-4 h-4 min-w-4 rounded-full cursor-pointer bg-color2A"
                 @click.stop="onUserAvatar" src="~@/assets/icons/icon-default-avatar.svg" alt="">
              </template>
            </UserAvatar>
            <!-- <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt=""> -->
            <span class="">{{ formatAddress(holder.ethAddr) }}</span>
            <span v-show="holder.ethAddr == comStore.currentSelectedCommunity.token" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">Contract</span>
            <span v-show="holder.ethAddr == comStore.currentSelectedCommunity.creator" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">Deployer</span>
            <span v-show="holder.ethAddr == comStore.currentSelectedCommunity.pair" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">DEX</span>
            <span v-show="holder.ethAddr == '0x3758AA66caD9F2606F1F501c9CB31b94b713A6d5'" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">NerveNetwork: Bridge</span>
            <span v-show="holder.ethAddr == PumpContract1 || holder.ethAddr == PumpContract2 || holder.ethAddr == PumpContract3 || holder.ethAddr == PumpContract4" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">Social Distribution</span>
          </div>
        <span class="col-span-2 text-right">{{ formatAmount(holder.amount) }} / {{ (holder.amount / 10000000).toFixed(2) }}%</span>
      </div>
      </van-list>
    </van-pull-refresh>

    </div>
  </div>
</template>

<style scoped>

</style>
