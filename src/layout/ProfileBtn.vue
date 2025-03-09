<script setup lang="ts">

import {MAX_OP, MAX_VP} from "@/config";
import {useAccountStore} from "@/stores/web3";
import {useAccount} from "@/composables/useAccount";
import HalfCircleProgress from "@/components/common/HalfCircleProgress.vue";

const accStore = useAccountStore()
const { vp, op, profile, replaceEmptyProfile } = useAccount()
</script>

<template>
  <router-link to="/profile/" class="">
    <div v-if="accStore.getAccountInfo"  class="w-7 h-7 relative">
      <!--          OP-->
      <HalfCircleProgress class="c-progress-dashboard w-full h-full relative"
                          type="dashboard"
                          color="#34C759"
                          :stroke-width="2"
                          :width="24"
                          :percentage="op * 100 / MAX_OP">
        <template #default>
          <div class="absolute top-0 left-0 right-0 bottom-0 p-[3px]">
            <img class="w-full h-full rounded-full"
                 :src="profile" @error="replaceEmptyProfile" alt="">
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
      <div class="w-[3px] h-[0.5px] bg-white absolute left-0 top-1/2 transform -translate-y-1/2"></div>
      <div class="w-[3px] h-[0.5px] bg-white absolute right-0 top-1/2 transform -translate-y-1/2"></div>
    </div>
    <img v-else class="w-7 h-7 rounded-full" src="~@/assets/icons/icon-tabbar-profile.svg" alt="">
    <span class="text-h5 text-grey-normal web:hidden">{{ $t('profile') }}</span>
  </router-link>

</template>

<style scoped>

</style>
