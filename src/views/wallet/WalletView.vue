<script setup lang="ts">
import {onMounted, ref} from "vue";
import TabHoldTag from "@/views/wallet/TabHoldTag.vue";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { formatAddress, formatAmount } from "@/utils/helper";
import { useTools } from "@/composables/useTools";
import axios from "axios";

const accStore = useAccountStore()
const tabOptions = ['tags', 'ipshares']
const activeTab = ref('tags')
const { profile, replaceEmptyProfile, gotoTwitter, updateBalance } = useAccount();
const { onCopy } = useTools()

onMounted(async () => {
  console.log(10)
  updateBalance()
  
  const response = await fetch('https://mainnet.helius-rpc.com/?api-key=d66140ab-63a2-4fb8-981a-7ccf7e7db999', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "jsonrpc": "2.0",
      "id": "text",
      "method": "getTokenAccounts",
      "params": {
        page: 1,
        limit: 100,
        owner: "238ZySG89DBkHtbm8syYFQx4Be9uPyNinLxq7ZcoeJPb"
      }
    }),
});
const data = await response.json();
console.log(data)
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
      <div class="flex-1 flex items-center flex-wrap gap-4 cursor-pointer" @click="onCopy(useAccountStore().getAccountInfo?.solAddr ?? '')">
          <span>Sol address: {{ formatAddress(useAccountStore().getAccountInfo?.solAddr ?? '') }}</span>
        </div>
      </div>
      <div class="pl-14 flex justify-between items-center gap-3a mt-1">
        <div class="flex-1 flex items-center flex-wrap gap-4">
          <span>Sol balance: {{ formatAmount(useAccountStore().solBalance) }}</span>
        </div>
      </div>
    </div>
    <!-- <div class="flex justify-between gap-2 bg-white rounded-xl py-3 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div> -->
    <!-- <div class="flex-1 overflow-auto " id="profile-tab-scroller">
      <TabHoldTag v-if="activeTab==='tags'"/>
    </div> -->
  </div>
</template>

<style scoped>

</style>
