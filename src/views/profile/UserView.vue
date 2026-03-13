<script setup lang="ts">
import {onMounted, ref, computed, watch} from "vue";
import TabBlink from "@/views/profile/TabBlink.vue";
import TabPost from "@/views/profile/TabPost.vue";
import TabCreateCoin from "@/views/profile/TabCreateCoin.vue";
import { useAccountStore, useIpshareData } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";
import { useInterval } from "@/composables/useTools";
import FarcasterBtn from "@/components/login/FarcasterBtn.vue";
import { useModalStore, useStateStore } from "@/stores/common";
import { GlobalModalType, type Account } from "@/types";
import { useRoute, useRouter } from "vue-router";
import emptyProfile from '@/assets/icons/icon-default-avatar.svg'
import { getUserProfile, getIPShareFee, getCapturedFee } from '@/apis/api'
import TipTokenRecord from "@/views/wallet/TipTokenRecord.vue";
import { calculateIPsharePriceLocal } from "@/utils/ipshare";
import { formatAmount, formatPrice } from "@/utils/helper";
import { getIPshareSupplies, getIPshareBalances, getIPshareStaked } from "@/utils/ipshareAsset";
import IPShareTradeModal from "@/components/ipshare/IPShareTradeModal.vue";
import IPShareStakeModal from "@/components/ipshare/IPShareStakeModal.vue";
import { isAddress } from "viem";

const accStore = useAccountStore()
const ipshareStore = useIpshareData()
const stateStore = useStateStore()
const tabOptions = ['post', 'tipRecord']
const activeTab = ref('post')
const vp = ref(0)
const op = ref(0)
const userInfo = ref<Account | null>(null);
const { setInter } = useInterval()
const route = useRoute()
const router = useRouter()

// IPShare 相关状态
const showTradeModal = ref(false)
const showStakeModal = ref(false)
const kolFee = ref(0)
const capturedFee = ref(0)
const ipshareExpanded = ref(false)

const userEthAddr = computed(() => userInfo.value?.ethAddr || '')

const isCreatedIPshare = computed(() => {
  const supply = ipshareStore.ipshareSupplies[userEthAddr.value] ?? 0
  return supply > 0
})

const ipsharePrice = computed(() => {
  const supply = ipshareStore.ipshareSupplies[userEthAddr.value] ?? 0
  return formatPrice(stateStore.ethPrice * calculateIPsharePriceLocal(supply))
})

const tvl = computed(() => {
  const supply = ipshareStore.ipshareSupplies[userEthAddr.value] ?? 0
  return formatPrice((supply ** 3) / 3 / 100000 - 1 / 3 / 100000).replace('$', '')
})

const subjectFee = computed(() => {
  const fee = ipshareStore.kolsInfo[userEthAddr.value] ?? kolFee.value
  return formatPrice(fee * stateStore.ethPrice)
})

const valueCaptured = computed(() => {
  return formatAmount(capturedFee.value)
})

const replaceEmptyProfile = (e: any) => {
    e.target.src = emptyProfile
}

const gotoTwitter = () => {
    window.open('https://x.com/' + userInfo.value?.twitterUsername, '__blank')
}

async function loadIPShareData(ethAddr: string) {
  if (!ethAddr || !isAddress(ethAddr)) return
  try {
    await Promise.all([
      getIPshareSupplies([ethAddr]),
      getIPshareBalances([ethAddr]),
      getIPshareStaked([ethAddr]),
      loadKolFee(ethAddr),
      loadCapturedFee(ethAddr)
    ])
  } catch (error) {
    console.error('Load IPShare data error:', error)
  }
}

async function loadKolFee(ethAddr: string) {
  try {
    const fee = await getIPShareFee(ethAddr)
    const feeValue = typeof fee === 'number' ? fee : (typeof fee === 'object' && fee !== null ? 0 : Number(fee) || 0)
    kolFee.value = feeValue
    ipshareStore.saveKolsInfo({ [ethAddr]: feeValue })
  } catch (error) {
    console.error('Load kol fee error:', error)
  }
}

async function loadCapturedFee(ethAddr: string) {
  try {
    const fee = await getCapturedFee(ethAddr)
    const feeValue = typeof fee === 'number' ? fee : (typeof fee === 'object' && fee !== null ? 0 : Number(fee) || 0)
    capturedFee.value = feeValue
  } catch (error) {
    console.error('Load captured fee error:', error)
  }
}

function onTrade() {
  showTradeModal.value = true
}

function onStake() {
  showStakeModal.value = true
}

function onTradeSuccess() {
  showTradeModal.value = false
  if (userEthAddr.value) {
    loadIPShareData(userEthAddr.value)
  }
}

function onStakeSuccess() {
  showStakeModal.value = false
  if (userEthAddr.value) {
    loadIPShareData(userEthAddr.value)
  }
}

// 当用户 ethAddr 可用后加载 IPShare 数据
watch(userEthAddr, (addr) => {
  if (addr && isAddress(addr)) {
    loadIPShareData(addr)
  }
})

onMounted(async () => {
  const username = route.params.username as string
  if (!username) {
    router.replace('/')
    return;
  }
  
  const res = await getUserProfile(undefined, route.params.username as string)
  userInfo.value = res as Account
})

</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="bg-white py-3 px-3 rounded-2xl mx-3">
      <div class="flex gap-2 items-center">
        <img class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             :src="userInfo?.profile" @error="replaceEmptyProfile" alt="">
        <div class="h-full flex-1">
          <div class="text-h3">{{ userInfo?.twitterName }}</div>
          <div class="flex items-center gap-1 leading-5">
            <span class="text-grey-8d">@{{ userInfo?.twitterUsername }}</span>
            <span v-if="userInfo?.accountType == 0" class="mx-4px"> · </span>
            <button v-if="userInfo?.accountType == 0" @click="gotoTwitter" >
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
      </div>
      <div class="pl-14 flex justify-between items-center gap-3a mt-2">
        <div class="flex-1 flex items-center flex-wrap gap-4">
          <span>{{ userInfo?.followings }} {{ $t('profileView.followings') }}</span>
          <span>{{ userInfo?.followers }} {{ $t('profileView.followers') }}</span>
        </div>
      </div>
    </div>

    <!-- IPShare Section -->
    <div v-if="userEthAddr && isCreatedIPshare" class="bg-white py-3 px-3 rounded-2xl mx-3">
      <!-- Header with Expand/Collapse Button -->
      <div class="flex items-center justify-between cursor-pointer" @click="ipshareExpanded = !ipshareExpanded">
        <div class="border-1 border-orange-normal rounded-xl px-4 py-3 flex-1">
          <div class="text-base font-bold text-grey-8d">{{ $t('ipshare.totalSupply') || 'IPShare Supply' }}</div>
          <div class="text-center">
            <span class="text-orange-normal text-3xl font-bold">{{ formatAmount(ipshareStore.ipshareSupplies[userEthAddr] || 0) }}</span>
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
                  <div class="text-gray-700 p-2 max-w-200px text-xs">{{ $t('profileView.feeIncomeDesc') || 'Users buy/sell IPShare will cost BNB for fee. 4.5% is to the KOL, 2.5% is to protocol.' }}</div>
                </template>
                <button>
                  <img class="w-4 h-4" src="~@/assets/icons/icon-tip.svg" alt="">
                </button>
              </el-tooltip>
            </div>
          </div>
        </div>
      </el-collapse-transition>
    </div>

    <div class="flex justify-between gap-2 bg-white rounded-xl py-3 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div v-if="userInfo?.twitterId" class="flex-1 overflow-auto " id="profile-tab-scroller">
      <TabPost v-if="activeTab==='post'" :userInfo="userInfo"/>
      <TipTokenRecord v-if="activeTab==='tipRecord'" :userInfo="userInfo"/>
    </div>

    <!-- IPShare Modals -->
    <IPShareTradeModal
      v-if="userEthAddr && isCreatedIPshare"
      v-model="showTradeModal"
      :subject-address="userEthAddr"
      :subject-info="{
        name: userInfo?.twitterName || '',
        supply: ipshareStore.ipshareSupplies[userEthAddr] || 0
      }"
      @success="onTradeSuccess"
    />
    
    <IPShareStakeModal
      v-if="userEthAddr && isCreatedIPshare"
      v-model="showStakeModal"
      :subject-address="userEthAddr"
      :subject-info="{
        name: userInfo?.twitterName || ''
      }"
      @success="onStakeSuccess"
    />
  </div>
</template>

<style scoped>

</style>
