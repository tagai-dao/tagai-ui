<script setup lang="ts">
import {ref} from "vue";
import {useAccountStore} from "@/stores/web3";
import {GlobalModalType} from "@/types";
import {useModalStore} from "@/stores/common";
const acc = useAccountStore().getAccountInfo;
const modalStore = useModalStore();

const step = ref(1)
</script>

<template>
  <div class="px-1 flex flex-col gap-y-10">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">Create IpShare</span>
      <img class="cursor-pointer" src="~@/assets/icons/icon-modal-close.svg" alt=""
           @click="modalStore.setModalVisible(false)"/>
    </div>
    <div v-if="step===1" class="pb-6 flex flex-col gap-4">
      <div class="min-h-20 text-center flex flex-col justify-center items-center gap-4">
        <div class="break-words text-sm text-center text-grey-normal">
          一段文字描述一段文字描述一段文字描述一段文字描述一段文字描述一段文字描述
        </div>
        <div class="text-sm leading-4 text-center text-grey-normal">
         需支付 <span class="text-2xl font-bold text-orange-normal">0.01</span> ETH
        </div>
      </div>
      <div class="flex justify-center gap-10">
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-orange-normal">
          <span class="text-gradient bg-gradient-primary font-bold text-lg">1</span>
        </button>
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-grey-light">
          <span class="text-grey-light-active font-bold text-lg">2</span>
        </button>
      </div>
      <div class="flex justify-center">
        <button class="h-12 w-[80%] bg-gradient-primary text-white font-bold rounded-full text-lg
                      flex items-center justify-center gap-2 disabled:opacity-30"
                @click="step=2">
          <span>Create</span>
          <i-ep-loading class="animate-spin" />
        </button>
      </div>
    </div>
    <div v-if="step===2" class="pb-6 flex flex-col gap-4">
      <div class="min-h-20 text-center flex flex-col justify-center items-center">
        <span class="text-3xl font-extrabold text-gradient bg-gradient-primary">
          创建成功！
        </span>
      </div>
      <div class="flex justify-center gap-10">
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-grey-light">
          <span class="text-grey-light-active font-bold text-lg">1</span>
        </button>
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-orange-normal">
          <span class="text-gradient bg-gradient-primary font-bold text-lg">2</span>
        </button>
      </div>
      <div class="flex justify-center">
        <button class="h-12 w-[80%] bg-gradient-primary text-white font-bold rounded-full text-lg
                      flex items-center justify-center gap-2 disabled:opacity-30"
                @click="step=1">
          <span>Tweet</span>
          <i-ep-loading class="animate-spin" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>