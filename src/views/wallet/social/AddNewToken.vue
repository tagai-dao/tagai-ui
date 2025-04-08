<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { ref } from "vue";
import { getTokenByTickOrCA } from "@/apis/api";

const socialAccountModalStore = useSocialAccountModalStore()
const tick = ref('')
const showTickerError = ref(false)
const allowance = ref<number | null>(null)
const transactionLimit = ref<number | null>(null)
const dailyLimit = ref<number | null>(null)
const state = ref(0)

async function confirm() {
    showTickerError.value = false
    if (!tick.value) {
        showTickerError.value = true
        state.value = 0
        return
    }
    state.value = 1
    const res:any = await getTokenByTickOrCA(tick.value)
    if (!res?.token) {
        showTickerError.value = true
        state.value = 0
        return
    }
    
  
}

</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('profileView.addToken') }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg">{{$t('profileView.inputTick')}}:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-h3 my-3"
               v-model="tick" type="text" :placeholder="$t('profileView.inputTickPlaceholder')"/>
        <span class="text-red-500 text-sm" v-if="showTickerError">{{$t('profileView.tickerError')}}</span>
      </div>
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg">{{$t('profileView.inputAllowance')}}:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-h3 my-3"
               v-model="allowance" type="number" :placeholder="$t('profileView.inputAllowancePlaceholder')"/>
      </div>
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg">{{$t('profileView.inputTransactionLimit')}}:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-h3 my-3"
               v-model="transactionLimit" type="number" :placeholder="$t('profileView.inputTransactionLimitPlaceholder')"/>
      </div>
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg">{{$t('profileView.inputDailyLimit')}}:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-h3 my-3"
               v-model="dailyLimit" type="number" :placeholder="$t('profileView.inputDailyLimitPlaceholder')"/>
      </div>
      <button @click="confirm" class="h-10 w-full bg-orange-normal rounded-full text-white text-h5 mt-5">
        {{$t('confirm')}}
      </button>
      
      <!-- 进度条组件 -->
      <div class="mt-6">
        <div class="flex items-center justify-between mb-2">
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full" :class="state >= 1 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
            <span class="text-sm mt-1">{{$t('profileView.newTokenStep1')}}</span>
          </div>
          <div class="flex-1 h-[2px] mx-2" :class="state >= 2 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full" :class="state >= 2 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
            <span class="text-sm mt-1">{{$t('profileView.newTokenStep2')}}</span>
          </div>
          <div class="flex-1 h-[2px] mx-2" :class="state >= 3 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full" :class="state >= 3 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
            <span class="text-sm mt-1">{{$t('profileView.step3')}}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>