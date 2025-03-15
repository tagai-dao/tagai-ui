<script setup lang="ts">
import {onMounted, ref} from "vue";
import TabHoldTag from "@/views/wallet/TabHoldTag.vue";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { formatAddress, formatAmount } from "@/utils/helper";
import { useTools } from "@/composables/useTools";

const accStore = useAccountStore()
const tabOptions = ['tags', 'ipshares']
const activeTab = ref('tags')
const { profile, replaceEmptyProfile, gotoTwitter, updateBalance } = useAccount();
const { onCopy } = useTools()

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
      <div class="pl-14 flex justify-between items-center gap-3a mt-2">
      <div class="flex-1 flex items-center flex-wrap gap-4 cursor-pointer" @click="onCopy(useAccountStore().getAccountInfo?.ethAddr ?? '')">
          <span>BSC {{ $t('address') }}: {{ formatAddress(useAccountStore().getAccountInfo?.ethAddr ?? '') }}</span>
        </div>
      </div>
      <div class="pl-14 flex justify-between items-center gap-3a mt-1">
        <div class="flex-1 flex items-center flex-wrap gap-4">
          <span>BNB {{ $t('balance') }}: {{ formatAmount(useAccountStore().ethBalance) }}</span>
        </div>
      </div>
    </div>
    <!-- <div class="flex justify-between gap-2 bg-white rounded-xl py-3 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div> -->
    <div class="flex-1 overflow-auto " id="profile-tab-scroller">
      <!-- <TabHoldCoin v-if="activeTab==='holdCoin'"/> -->
      <TabHoldTag v-if="activeTab==='tags'"/>
    </div>
  </div>
</template>

<style scoped>

</style>
