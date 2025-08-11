<script setup lang="ts">
import {onMounted, ref, onUnmounted} from "vue";
import TabHoldTag from "@/views/wallet/TabHoldTag.vue";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { formatAddress, formatAmount } from "@/utils/helper";
import { useTools } from "@/composables/useTools";
import TabSocialAccount from "@/views/wallet/TabSocialAccount.vue";
import { useUserStore } from "@/stores/privy";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import emitter from "@/utils/emitter";

const accStore = useAccountStore()
const privyStore = useUserStore()
const modalStore = useModalStore()
const tabOptions = ['holding', 'socialAccount']
const activeTab = ref('socialAccount')
const needClaim = ref(false)
const { profile, replaceEmptyProfile, gotoTwitter, updateBalance } = useAccount();
const { onCopy } = useTools()

async function disconnect() {
  if (accStore.getWalletType === 'privy-twitter') {
    await privyStore.logout();
  }
  
  accStore.ethConnectState = EthWalletState.Disconnect;
  accStore.ethConnectAddress = '';
  accStore.ethWalletType = 'none';
}

async function showPrivy() {
  // 显示PrivyModal弹窗
  modalStore.setModalVisible(true, GlobalModalType.PrivyWallet)
}
onMounted(() => {
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
            <span class="mx-4px"> · </span>
            <button @click="gotoTwitter" >
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
      </div>
      <div class="pl-12 flex justify-start items-center mt-2 gap-3">
        <div class="flex items-center flex-wrap gap-4 cursor-pointer" @click="onCopy(useAccountStore().getAccountInfo?.ethAddr ?? '')">
            <span>BSC {{ $t('address') }}: {{ formatAddress(useAccountStore().getAccountInfo?.ethAddr ?? '') }}</span>
        </div>
        <button v-if="accStore.getAccountInfo?.walletType == 1 && accStore.ethConnectState === EthWalletState.Connected" @click="showPrivy">
          <img class="w-20 h-4 min-w-4" src="~@/assets/icons/privy-logo.png" alt="">
        </button>
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
      <TabSocialAccount v-if="activeTab==='socialAccount'"/>
    </div>
  </div>
</template>

<style scoped>

</style>
