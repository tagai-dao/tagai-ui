<script setup lang="ts">
import AddTokenList from "@/views/wallet/social/AddTokenList.vue";
import EditAvailableBalance from "@/views/wallet/social/EditAvailableBalance.vue";
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import EditCreditLimit from "@/views/wallet/social/EditCreditLimit.vue";

const socialAccountModalStore = useSocialAccountModalStore()
</script>

<template>
  <div class="h-full px-3">
    <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3 relative mb-2">
      <div class="flex justify-center items-center mb-2">
        <div class="relative w-min">
          <span class="text-grey-normal text-h1">0.00</span>
          <div class="absolute left-[120%] bottom-1 flex items-center gap-2">
            <span class="whitespace-nowrap text-h5 text-gradient bg-gradient-primary">WBNB</span>
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">您可以在推特上打赏任何 TagAI代币给任何 Twitter账号，只需几步简单的设定: </div>
                  <ul class="list-decimal pl-5">
                    <li>将BNB转换成WBNB;</li>
                    <li>设置WBNB授权额度;</li>
                    <li>设置 WBNB交易限额;</li>
                    <li>添加社交代币，设置授权额度和限额;</li>
                    <li>打赏</li>
                  </ul>
                </div>
              </template>
            </el-popover>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5">
          {{$t('profileView.addToken')}}
        </button>
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5">
          {{$t('profileView.wrap')}}
        </button>
        <button @click="$router.push('/tip-record')">
          <img class="w-10 h-10" src="~@/assets/icons/icon-record.svg" alt="">
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
      <EditAvailableBalance v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditAvailableBalance"/>
      <EditCreditLimit v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditCreditLimit"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
