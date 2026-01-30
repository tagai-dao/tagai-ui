<script setup lang="ts">
import {onMounted, ref, onUnmounted} from "vue";
import TabHoldTag from "@/views/wallet/TabHoldTag.vue";
import TabPrediction from "@/views/wallet/TabPrediction.vue";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { formatAddress, formatBalance, formatPrice } from "@/utils/helper";
import { useTools } from "@/composables/useTools";
import TabSocialAccount from "@/views/wallet/TabSocialAccount.vue";
import TabIPShareHolding from "@/views/wallet/TabIPShareHolding.vue";
import { usePrivyStore } from "@/stores/privy";
import {applyPureReactInVue} from "veaury";
import Wallet from "@/react_app/Wallet.jsx";
import { isAddress } from "viem";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";

const ReactWallet = applyPureReactInVue(Wallet);

const accStore = useAccountStore()
const privyStore = usePrivyStore()
const tabOptions = ['holding', 'ipshare', 'prediction', 'socialAccount']
const activeTab = ref('holding')
const showPrivyModal = ref(false)
const { profile, replaceEmptyProfile, gotoTwitter, updateBalance } = useAccount();
const { onCopy } = useTools()

async function disconnect() {
  accStore.ethConnectState = EthWalletState.Disconnect;
  accStore.ethConnectAddress = '';
  accStore.ethWalletType = 'none';
}

async function showPrivy() {
  // 显示PrivyModal弹窗
  showPrivyModal.value = true
}
onMounted(async () => {
  // 检查登录状态和 token 有效性
  const token = await useAccount().checkoutAccessToken()
  if (!token) {
    // token 无效，已触发 logout，不继续执行
    return
  }
  
  if (!accStore.getAccountInfo?.ethAddr || !isAddress(accStore.getAccountInfo?.ethAddr)) {
    // show bond address
    useAccount().bondEthAddress()
    return;
  }
  
  updateBalance()
})

</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="bg-white py-3 px-3 rounded-2xl mx-3">
      <div class="flex gap-2 items-center">
        <img class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             :src="profile" @error="replaceEmptyProfile" alt="">
        <div class="h-full flex-1">
          <div class="text-h3">{{ accStore.getAccountInfo.twitterName }}</div>
          <div class="flex items-center gap-1 leading-5">
            <span class="text-grey-8d">@{{ accStore.getAccountInfo.twitterUsername }}</span>
            <span v-if="accStore.getAccountInfo.accountType === 0" class="mx-4px"> · </span>
            <button v-if="accStore.getAccountInfo.accountType === 0" @click="gotoTwitter" >
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
      </div>
      <div class="pl-12 flex justify-start items-center mt-2 gap-3">
        <div class="flex items-center flex-wrap gap-4 cursor-pointer" @click="onCopy(useAccountStore().getAccountInfo?.ethAddr ?? '')">
            <span>BSC {{ $t('address') }}: {{ formatAddress(useAccountStore().getAccountInfo?.ethAddr ?? '') }}</span>
        </div>
        <ReactWallet v-if="accStore.getAccountInfo?.walletType == 1 && accStore.ethConnectState === EthWalletState.Connected" />
      </div>
      <div class="pl-12 flex justify-start items-center mt-2 gap-1">
        {{ $t('balance') }}: 
        <span class="font-bold">
          {{ formatBalance(accStore.ethBalance) }} 
        </span>
        BNB
        <button v-if="accStore.getAccountInfo?.walletType == 1 && accStore.ethConnectState === EthWalletState.Connected" 
          class="h-8 ml-3 bg-gradient-primary rounded-full px-3 text-white text-h5 hover:opacity-90 transition-all duration-200"
          @click="showPrivy">
          {{ $t('web3.recharge') }}
        </button>
      </div>
      <div class="text-xl bg-gradient-primary rounded-full px-3 py-2
       mt-1 flex justify-center items-center text-white mx-12">
        {{ formatPrice(accStore.holdingValue) }}
      </div>
      <!-- <div v-if="useAccountStore().ethConnectState === EthWalletState.Connected" class="pl-12 flex justify-between items-center gap-3a mt-1">
        <div @click="onCopy(useAccountStore().ethConnectAddress)" 
          class="flex-1 flex items-center flex-wrap gap-4 cursor-pointer">
          <span>Connected: {{ formatAddress(useAccountStore().ethConnectAddress) }}</span>
          <button @click.stop="disconnect">
            <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-logout.svg" alt="">
          </button>
        </div>
      </div> -->
    </div>
    <div class="flex justify-around items-center gap-2 bg-white h-12 min-h-12 px-4 rounded-2xl mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-8 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'bg-orange-normal text-white':'text-grey-3f'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div class="flex-1 overflow-auto " id="profile-tab-scroller">
      <!-- <TabHoldCoin v-if="activeTab==='holdCoin'"/> -->
      <TabHoldTag v-if="activeTab==='holding'"/>
      <TabIPShareHolding v-if="activeTab==='ipshare'"/>
      <TabPrediction v-if="activeTab==='prediction'"/>
      <TabSocialAccount v-if="activeTab==='socialAccount'"/>
    </div>
    <PrivyModal @close="showPrivyModal = false" v-if="showPrivyModal"/>
  </div>
</template>

<style scoped>

</style>
