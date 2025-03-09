<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import ProfileBtn from "@/layout/ProfileBtn.vue";
import CreateBtn from "@/layout/CreateBtn.vue";

const accStore = useAccountStore()
const modalStore = useModalStore()

const { vp, op } = useAccount()


</script>

<template>
  <div class="relative h-[76px]">
    <div class="absolute h-[76px] left-0 right-0 bottom-0 flex items-center justify-center rounded-md overflow-hidden">
      <div class="flex-1 h-full bg-gradient-tab"></div>
      <img class="h-full object-cover object-center" src="~@/assets/images/tabbar-bg.svg" alt="">
      <div class="flex-1 h-full bg-gradient-tab"></div>
    </div>
    <div class="w-full flex justify-between items-end px-8 py-4 relative z-10">
      <router-link to="/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
        <template v-if="$route.name==='home'">
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
          <span class="text-gradient bg-gradient-primary text-h5">{{$t('tag')}}</span>
        </template>
        <template v-else>
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
          <span class="text-h5 text-grey-normal">{{$t('tag')}}</span>
        </template>
      </router-link>
      <CreateBtn/>
      <ProfileBtn class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
      </ProfileBtn>
    </div>
  </div>
</template>

<style scoped>

</style>
