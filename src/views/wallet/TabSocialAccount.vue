<script setup lang="ts">
import AddTokenList from "@/views/wallet/social/AddTokenList.vue";
import EditAvailableBalance from "@/views/wallet/social/EditAvailableBalance.vue";
import AddNewToken from "@/views/wallet/social/AddNewToken.vue";
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import EditCreditLimit from "@/views/wallet/social/EditCreditLimit.vue";
import { useAccountStore } from "@/stores/web3";
import { formatAmount } from "@/utils/helper";
import { onMounted, ref } from "vue";
import { getRewardsClaimd } from "@/utils/twitterTip";
import { ethers } from "ethers";
const accStore = useAccountStore()
const socialAccountModalStore = useSocialAccountModalStore()
const needClaim = ref(false)

function setModalType(type: SocialAccountModalType) {
  socialAccountModalStore.modalType = type
  socialAccountModalStore.modalVisible = true
}

onMounted(() => {
  getRewardsClaimd(accStore.getAccountInfo.twitterId).then((res:any) => {
    needClaim.value = res == ethers.ZeroAddress;
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
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5"
          @click="setModalType(SocialAccountModalType.AddToken)">
          {{$t('profileView.addToken')}}
        </button>
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5">
          {{$t('profileView.wrap')}}
        </button>
        <button @click="$router.push('/tip-record')" class="relative">
          <img class="w-10 h-10" src="~@/assets/icons/icon-record.svg" alt="">
          <div class="absolute top-[-3px] right-[-3px] w-4 h-4 bg-red-normal rounded-full" v-if="needClaim"></div>
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
      <AddNewToken v-if="socialAccountModalStore.modalType==SocialAccountModalType.AddToken"/>
      <EditAvailableBalance v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditAvailableBalance"/>
      <EditCreditLimit v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditCreditLimit"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
