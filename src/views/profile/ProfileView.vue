<script setup lang="ts">
import {onMounted, ref, computed, watch} from "vue";
import TabBlink from "@/views/profile/TabBlink.vue";
import TabPost from "@/views/profile/TabPost.vue";
import TabPrediction from "@/views/profile/TabPrediction.vue";
import TabCreateCoin from "@/views/profile/TabCreateCoin.vue";
import TabBlinksTweet from "@/views/profile/TabBlinksTweet.vue";
import { useAccountStore, useIpshareData } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";
import { getIPShareSupply, calculateIPsharePriceLocal } from "@/utils/ipshare";
import { useInterval, useTools } from "@/composables/useTools";
import FarcasterBtn from "@/components/login/FarcasterBtn.vue";
import { useModalStore, useStateStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { useRoute, useRouter } from "vue-router";
import {applyPureReactInVue} from "veaury";
import LogoutOAuth from '@/react_app/Logout.jsx'
import { formatAddress, formatAmount, formatPrice } from "@/utils/helper";
import { getIPshareSupplies, getIPshareBalances, getIPshareStaked } from "@/utils/ipshareAsset";
import { getIPShareFee, getCapturedFee } from "@/apis/api";
import IPShareTradeModal from "@/components/ipshare/IPShareTradeModal.vue";
import IPShareStakeModal from "@/components/ipshare/IPShareStakeModal.vue";
import { isAddress } from "viem";

const ReactLogoutOAuth = applyPureReactInVue(LogoutOAuth);

const accStore = useAccountStore()
const ipshareStore = useIpshareData()
const stateStore = useStateStore()
const tabOptions = ['post', 'blinksTweet', 'createCoin']
const activeTab = ref('post')
const { onCopy } = useTools()
const { profile, replaceEmptyProfile, gotoTwitter, vp, op, logout, updateBalance } = useAccount();
const { setInter } = useInterval()
const router = useRouter()

// IPShare 相关状态
const showTradeModal = ref(false)
const showStakeModal = ref(false)
const kolFee = ref(0)
const capturedFee = ref(0)
const loadingIPShare = ref(false)
const ipshareExpanded = ref(false) // IPShare Section 折叠/展开状态

const profileTableData = ref([
  { action: 'Curation', vp: 'Selected vp', op: 'Selected vp'},
  { action: 'Tweet', vp: '0', op: '200'},
  { action: 'Quote', vp: '0', op: '200'},
  { action: 'Reply', vp: '0', op: '50'},
  { action: 'Retweet', vp: '0', op: '5'},
  { action: 'Like', vp: '0', op: '3'},
])

const donutEth = computed(() => accStore.getAccountInfo?.ethAddr)
const isCreatedIPshare = computed(() => {
  const supply = ipshareStore.ipshareSupplies[donutEth.value || ''] ?? 0;
  return supply > 0;
})

const ipsharePrice = computed(() => {
  const supply = ipshareStore.ipshareSupplies[donutEth.value || ''] ?? 0;
  return formatPrice(stateStore.ethPrice * calculateIPsharePriceLocal(supply));
})

const tvl = computed(() => {
  const supply = ipshareStore.ipshareSupplies[donutEth.value || ''] ?? 0;
  return formatPrice((supply ** 3) / 3 / 100000 - 1 / 3 / 100000).replace('$', '');
})

const subjectFee = computed(() => {
  // 优先使用 store 中的数据（参考 Donut 实现）
  const fee = ipshareStore.kolsInfo[donutEth.value || ''] ?? kolFee.value;
  return formatPrice(fee * stateStore.ethPrice);
})

const valueCaptured = computed(() => {
  return formatAmount(capturedFee.value);
})

async function updateIPShare() {
  const acc = useAccountStore().getAccountInfo;

  try {
    if (acc.ethAddr && isAddress(acc.ethAddr)) {
      updateBalance();
      const supply: any = await getIPShareSupply(acc.ethAddr);
      if (supply >= 10) {
        useAccountStore().ipshare = {
          ethAddr: acc.ethAddr,
          shareSupply: supply,
          created: true
        };
        // 更新 IPShare 数据
        await loadIPShareData(acc.ethAddr);
      }
    }
  } catch (error) {
    console.error('Update IPShare error:', error);
  }
}

async function loadIPShareData(ethAddr: string) {
  if (!ethAddr || !isAddress(ethAddr)) return;
  
  try {
    loadingIPShare.value = true;
    await Promise.all([
      getIPshareSupplies([ethAddr]),
      getIPshareBalances([ethAddr]),
      getIPshareStaked([ethAddr]),
      loadKolFee(ethAddr),
      loadCapturedFee(ethAddr)
    ]);
  } catch (error) {
    console.error('Load IPShare data error:', error);
  } finally {
    loadingIPShare.value = false;
  }
}

async function loadKolFee(ethAddr: string) {
  try {
    const fee = await getIPShareFee(ethAddr);
    const feeValue = typeof fee === 'number' ? fee : (typeof fee === 'object' && fee !== null ? 0 : Number(fee) || 0);
    kolFee.value = feeValue;
    // 保存到 store（参考 Donut 实现）
    ipshareStore.saveKolsInfo({ [ethAddr]: feeValue });
  } catch (error) {
    console.error('Load kol fee error:', error);
  }
}

async function loadCapturedFee(ethAddr: string) {
  try {
    const fee = await getCapturedFee(ethAddr);
    const feeValue = typeof fee === 'number' ? fee : (typeof fee === 'object' && fee !== null ? 0 : Number(fee) || 0);
    capturedFee.value = feeValue;
  } catch (error) {
    console.error('Load captured fee error:', error);
  }
}

function onTrade() {
  showTradeModal.value = true;
}

function onStake() {
  showStakeModal.value = true;
}

function onTradeSuccess() {
  showTradeModal.value = false;
  if (donutEth.value) {
    loadIPShareData(donutEth.value);
  }
}

function onStakeSuccess() {
  showStakeModal.value = false;
  if (donutEth.value) {
    loadIPShareData(donutEth.value);
  }
}

// 监听账户信息变化，加载 IPShare 数据
watch(() => accStore.getAccountInfo?.ethAddr, (newAddr) => {
  if (newAddr && isAddress(newAddr)) {
    loadIPShareData(newAddr);
  }
}, { immediate: true })

function editProfile() {
  useModalStore().setModalVisible(true, GlobalModalType.CreateUserInfo)
}

onMounted(() => {
  updateIPShare()
  setInter(updateIPShare, 100000)
})

</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="bg-white py-3 px-3 rounded-2xl mx-3">
      <div class="flex gap-2 items-center">
        <div class="relative w-14 h-14 min-w-14">
          <img class="w-14 h-14 min-w-14 rounded-full cursor-pointer bg-color2A"
              :src="profile" @error="replaceEmptyProfile" alt="">
          <button class="rounded-full w-10 h-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" 
            v-if="accStore.getAccountInfo.accountType !== 0" 
            @click="editProfile">
            <div class="rounded-full bg-black-19 opacity-40 w-10 h-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            </div>
            <img src="~@/assets/icons/btn-edit.svg" class="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" alt="">
          </button>
        </div>
        <div class="h-full flex-1">
          <div class="text-h3 flex items-center gap-2">
            {{ accStore.getAccountInfo.twitterName }}
          </div>
          <div class="flex items-center gap-1 leading-5">
            <span @click="onCopy(accStore.getAccountInfo.twitterUsername)" class="text-grey-8d overflow-hidden text-ellipsis whitespace-nowrap">{{ accStore.getAccountInfo.accountType === 1 ? formatAddress(accStore.getAccountInfo.twitterUsername, 6, 3) : '@' + accStore.getAccountInfo.twitterUsername }}</span>

            <button v-if="accStore.getAccountInfo.accountType == 0" @click="gotoTwitter" class="flex items-center gap-1">
              <span class="mx-4px"> · </span>
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-[65px] flex flex-col items-center gap-1">
            <div class="w-full flex justify-between text-sm px-1 text-grey-normal">
              <span>{{ (op * 100 / MAX_OP).toFixed(2) }}%</span>
              <span>OP</span>
            </div>
            <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
              <el-progress :percentage="op * 100 / MAX_OP" :stroke-width="6" :show-text="false"
                           class="c-gradient-progress c-gradient-progress-green w-full"/>
              <template #content>
                <div class="max-w-[400px] py-4">
                  <div class="text-grey-normal py-1">{{ $t('curation.opDesc') }}</div>
                  <el-table :data="profileTableData" border style="width: 100%">
                    <el-table-column prop="action" label="Action"/>
                    <el-table-column prop="vp" label="VP" width="120" />
                    <el-table-column prop="op" label="OP" width="120" />
                  </el-table>
                </div>
              </template>
            </el-tooltip>
          </div>
          <div class="w-[65px] flex flex-col items-center gap-1">
            <div class="w-full flex justify-between text-sm px-1 text-grey-normal">
              <span>{{ (vp * 100 / MAX_VP).toFixed(2) }}%</span>
              <span>VP</span>
            </div>
            <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
              <el-progress :percentage="vp * 100 / MAX_VP" :stroke-width="6" :show-text="false"
                           class="c-gradient-progress c-gradient-progress-orange w-full"/>
              <template #content>
                <div class="max-w-[400px]">
                  <div class="text-grey-normal py-1">{{  $t('curation.vpDesc')  }}</div>
                </div>
              </template>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div class="pl-14 flex justify-between items-center gap-3a mt-2">
        <div class="flex-1 flex items-center flex-wrap gap-4">
          <span>{{ accStore.getAccountInfo.followings }} {{ $t('profileView.followings') }}</span>
          <span>{{ accStore.getAccountInfo.followers }} {{ $t('profileView.followers') }}</span>
        </div>
<!--        <button @click="logout();$router.replace('/')">-->
<!--          <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-logout.svg" alt="">-->
<!--        </button>-->
        <div @click="logout();$router.replace('/')">
          <ReactLogoutOAuth/>
        </div>
      </div>
      <div v-if="accStore.getAccountInfo.farcasterName && accStore.getAccountInfo.isAuthFarcaster" class="pl-14 flex justify-start items-center gap-3a mt-2">
        <img class="w-4 h-4" src="~@/assets/icons/icon-farcaster.svg" alt="">
        <div class="ml-2 text-sm">
          {{ accStore.getAccountInfo.farcasterName }}
        </div>
      </div>
      <!-- <div v-else class="flex pl-14 justify-start items-center gap-3a mt-2 ">
        <button @click="useModalStore().setModalVisible(true, GlobalModalType.Register)" class="bg-gradient-primary flex items-center px-2 py-1 rounded-full">
          <img class="w-4 h-4 mr-2" src="~@/assets/icons/icon-farcaster.svg" alt="">
          <span class="text-white text-sm">
            {{$t('profileView.bindFacaster')}}
          </span>
        </button>
      </div> -->
    </div>
    
    <!-- IPShare Section -->
    <div v-if="donutEth" class="bg-white py-3 px-3 rounded-2xl mx-3">
      <!-- Create IPShare Button -->
      <button v-if="!isCreatedIPshare"
              class="h-12 w-full bg-gradient-primary text-white rounded-full shadow-sm"
              @click="useModalStore().setModalVisible(true, GlobalModalType.CreateIPShare)">
        <span class="text-lg font-bold">
          {{ $t('ipshare.createIpShare') || 'Create IPShare' }}
        </span>
      </button>
      
      <!-- IPShare Info -->
      <template v-else-if="isCreatedIPshare">
        <!-- Header with Expand/Collapse Button -->
        <div class="flex items-center justify-between cursor-pointer" @click="ipshareExpanded = !ipshareExpanded">
          <div class="border-1 border-orange-normal rounded-xl px-4 py-3 flex-1">
            <div class="text-base font-bold text-grey-8d">{{ $t('ipshare.totalSupply') || 'IPShare Supply' }}</div>
            <div class="text-center">
              <span class="text-orange-normal text-3xl font-bold">{{ formatAmount(ipshareStore.ipshareSupplies[donutEth] || 0) }}</span>
            </div>
          </div>
          <button class="ml-3 p-2 hover:bg-gray-100 rounded-full transition-colors">
            <i-ep-caret-bottom v-if="!ipshareExpanded" class="w-5 h-5 text-grey-8d transition-transform" />
            <i-ep-caret-top v-else class="w-5 h-5 text-grey-8d transition-transform" />
          </button>
        </div>
        
        <!-- Collapsible Content -->
        <el-collapse-transition>
          <div v-show="ipshareExpanded">
            <!-- Price and TVL -->
            <div class="px-2 flex justify-between items-center text-xs my-2">
              <span>IPShare {{ $t('postView.price') || 'Price' }} <span class="text-orange-normal">{{ ipsharePrice }}</span></span>
              <span>TVL {{ tvl }} $BNB</span>
            </div>
            
            <!-- Trade and Staking Buttons -->
            <div class="flex gap-4 mt-4">
              <button class="h-9 flex-1 rounded-full bg-gradient-primary text-white transition-colors"
                      @click="onTrade">
                <span class="font-bold">{{ $t('trade') || 'Trade' }}</span>
              </button>
              <button class="h-9 flex-1 rounded-full bg-gradient-primary text-white transition-colors"
                      @click="onStake">
                <span class="font-bold">{{ $t('ipshare.stake') || 'Stake' }}</span>
              </button>
            </div>
            
            <!-- Fee Income -->
            <div v-if="kolFee > 0" class="flex items-center justify-between bg-gray-50 rounded-full px-4 h-10 mt-3">
              <div class="flex gap-2 items-center">
                <span class="text-sm text-grey-8d">{{ $t('profileView.feeIncome') || 'Fee Income' }}</span>
                <span class="font-medium text-black">{{ subjectFee }}</span>
                <el-tooltip popper-class="c-arrow-popper">
                  <template #content>
                    <div class="text-white p-2 max-w-200px text-xs">{{ $t('profileView.feeIncomeDesc') || 'Users buy/sell IPShare will cost BNB for fee. 4.5% is to the KOL, 2.5% is to protocol.' }}</div>
                  </template>
                  <button>
                    <img class="w-4 h-4" src="~@/assets/icons/icon-tip.svg" alt="">
                  </button>
                </el-tooltip>
              </div>
            </div>
          </div>
        </el-collapse-transition>
      </template>
    </div>
    
    <div class="flex justify-between gap-2 bg-white rounded-xl py-3 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div class="flex-1 overflow-auto " id="profile-tab-scroller">
      <!-- <TabHoldCoin v-if="activeTab==='holdCoin'"/> -->
      <TabPost v-if="activeTab==='post'"/>
      <TabBlinksTweet v-if="activeTab==='blinksTweet'"/>
      <TabBlink v-if="activeTab==='blink'"/>
      <TabCreateCoin v-if="activeTab==='createCoin'"/>
    </div>
    
    <!-- IPShare Modals -->
    <IPShareTradeModal
      v-if="donutEth && isCreatedIPshare"
      v-model="showTradeModal"
      :subject-address="donutEth"
      :subject-info="{
        name: accStore.getAccountInfo?.twitterName || '',
        supply: ipshareStore.ipshareSupplies[donutEth] || 0
      }"
      @success="onTradeSuccess"
    />
    
    <IPShareStakeModal
      v-if="donutEth && isCreatedIPshare"
      v-model="showStakeModal"
      :subject-address="donutEth"
      :subject-info="{
        name: accStore.getAccountInfo?.twitterName || ''
      }"
      @success="onStakeSuccess"
    />
  </div>
</template>

<style scoped>

</style>
