<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import { useAccountStore } from "@/stores/web3";
import HalfCircleProgress from "@/components/common/HalfCircleProgress.vue";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";

const accStore = useAccountStore()
const modalStore = useModalStore()

const { vp, op } = useAccount()

async function createCoin() {
  const acc = accStore.getAccountInfo;
  if (!acc) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
  }else if (!acc.ethAddr) {
    modalStore.setModalVisible(true, GlobalModalType.BondEth)
    return
  }else {
    modalStore.setModalVisible(true, GlobalModalType.CreateCoin)
    return
  }
}
</script>

<template>
  <div class="relative">
    <div class="absolute h-[76px] left-0 right-0 bottom-0 flex items-center justify-center rounded-md overflow-hidden">
      <div class="flex-1 h-full bg-gradient-tab"></div>
      <img class="h-full object-cover object-center" src="~@/assets/images/tabbar-bg.svg" alt="">
      <div class="flex-1 h-full bg-gradient-tab"></div>
    </div>
    <div class="w-full flex justify-between items-end px-8 py-4 relative z-10">
      <router-link to="/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
        <template v-if="$route.name==='home'">
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
          <span class="text-gradient bg-gradient-primary text-h5">Tag</span>
        </template>
        <template v-else>
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
          <span class="text-h5 text-grey-normal">Tag</span>
        </template>
      </router-link>
      <button class="mb-9" @click="createCoin">
        <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
      </button>
      <router-link to="/profile/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
        <div v-if="accStore.getAccountInfo"  class="w-7 h-7 relative">
<!--          OP-->
          <HalfCircleProgress class="c-progress-dashboard w-full h-full relative"
                              type="dashboard"
                              color="#34C759"
                              :stroke-width="2"
                              :width="24"
                              :percentage="op * 100 / MAX_OP">
            <template #default>
              <div class="absolute top-0 left-0 right-0 bottom-0 p-[2px]">
                <img class="w-full h-full rounded-full"
                     :src="accStore.getAccountInfo.profile.replace('normal', '200x200')" alt="">
              </div>
            </template>
          </HalfCircleProgress>
          <div class="absolute top-0 left-0 right-0 bottom-0">
<!--            VP-->
            <HalfCircleProgress class="c-progress-dashboard w-full h-full relative"
                                :style="{transform: 'scale(1, -1)'}"
                                type="dashboard"
                                color="#FE913F"
                                :stroke-width="2"
                                :width="24"
                                :percentage="vp * 100 / MAX_VP">
              <template #default></template>
            </HalfCircleProgress>
          </div>
        </div>
        <img v-else class="w-7 h-7 rounded-full" src="~@/assets/icons/icon-tabbar-profile.svg" alt="">
        <span class="text-h5 text-grey-normal">Profile</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>

</style>
