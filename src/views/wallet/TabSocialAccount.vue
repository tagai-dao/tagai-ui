<script setup lang="ts">
import AddTokenList from "@/views/wallet/social/AddTokenList.vue";
import EditAllowance from "@/views/wallet/social/EditAllowance.vue";
import AddNewToken from "@/views/wallet/social/AddNewToken.vue";
import TipToken from "@/views/wallet/social/TipToken.vue";
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import EditLimit from "@/views/wallet/social/EditLimit.vue";
import { useAccountStore } from "@/stores/web3";
import { formatAmount } from "@/utils/helper";
import { onMounted, ref } from "vue";
import { getRewardsClaimd } from "@/utils/twitterTip";
import { ethers } from "ethers";
import WrapBNB from "@/views/wallet/social/WrapBNB.vue";
import { useAccount } from "@/composables/useAccount";

const accStore = useAccountStore()
const socialAccountModalStore = useSocialAccountModalStore()
const { updateBalance } = useAccount();

function setModalType(type: SocialAccountModalType) {
  socialAccountModalStore.modalType = type
  socialAccountModalStore.modalVisible = true
}

function refreshBalance() {
  updateBalance()
  socialAccountModalStore.updateSocialAccountTokens()
}

onMounted(() => {
  getRewardsClaimd(accStore.getAccountInfo.twitterId).then((res:any) => {
    socialAccountModalStore.needClaim = res == ethers.ZeroAddress;
  })
})

</script>

<template>
  <div class="h-full px-3">
    <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3 relative mb-2">
      <div class="flex justify-center items-center mb-2">
        <div class="relative w-min">
          <span class="text-grey-normal text-h1">{{ formatAmount(accStore.wethBalance) }}</span>
          <div class="absolute left-[120%] bottom-1 flex items-center gap-2">
            <span class="whitespace-nowrap text-h5 text-gradient bg-gradient-primary">WBNB</span>
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.tipDes1') }}</div>
                  <ul class="list-decimal pl-5">
                    <li>{{ $t('profileView.tipDes2') }}</li>
                    <li>{{ $t('profileView.tipDes3') }}</li>
                    <li>{{ $t('profileView.tipDes4') }}</li>
                    <li>{{ $t('profileView.tipDes5') }}</li>
                    <li>{{ $t('profileView.tipDes6') }}</li>
                  </ul>
                </div>
              </template>
            </el-popover>
            <el-popover @click="refreshBalance" popper-class="c-popper" placement="right-start">
              <template #reference>
                <img class="w-5 min-w-5 min-h-5 cursor-pointer" src="~@/assets/icons/icon-refresh.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl flex p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.refreshBalance') }}</div>
                  </div>
              </template>
            </el-popover>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 max-w-[500px] mx-auto">
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5"
          @click="setModalType(SocialAccountModalType.AddToken)">
          {{$t('profileView.addToken')}}
        </button>
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5"
          @click="setModalType(SocialAccountModalType.WrapBNB)">
          {{$t('profileView.wrap')}}
        </button>
        <button @click="$router.push('/tip-record')" class="relative">
          <img class="w-8 h-8" src="~@/assets/icons/icon-record.svg" alt="">
          <div class="absolute top-[-3px] right-[-3px] w-4 h-4 bg-red-normal rounded-full" v-if="socialAccountModalStore.needClaim"></div>
        </button>
      </div>
    </div>
    <AddTokenList></AddTokenList>
    <el-dialog v-model="socialAccountModalStore.modalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false"
               align-center
               destroy-on-close >
      <EditAllowance v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditAllowance"/>
      <EditLimit v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditLimit"/>
      <AddNewToken v-if="socialAccountModalStore.modalType==SocialAccountModalType.AddToken" @added="refreshBalance"/>
      <WrapBNB v-if="socialAccountModalStore.modalType==SocialAccountModalType.WrapBNB"/>
      <TipToken v-if="socialAccountModalStore.modalType==SocialAccountModalType.TipToken"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
