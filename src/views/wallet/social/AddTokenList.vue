<script setup lang="ts">
import { ref } from "vue";
import { useSocialAccountModalStore } from "@/stores/wallet";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const scroller = document.querySelector('#profile-tab-scroller')

const onLoad = async () => {

}

const onRefresh = async () => {

}

</script>

<template>
  <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                    :loading-text="$t('loading')"
                    :lpulling-text="$t('pullToRefreshData')"
                    :loosing-text="$t('releaseToRefresh')">
    <van-list :loading="loading"
              :finished="finished"
              :immediate-check="false"
              :scroller="scroller"
              :offset="50"
              @load="onLoad">
      <div v-for="i of 5" :key="i"
           class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3 mb-2">
        <div class="flex items-start gap-2">
          <div class="w-10 min-w-10 h-10 rounded-full bg-grey-normal-active shadow-tag-logo
                      flex items-center justify-center relative overflow-hidden">
            <img class="w-10" src="../../../assets/icons/icon-default-coin.svg" alt="">
          </div>
          <div class="flex-1">
            <div class="flex gap-2 items-center">
              <span class="text-grey-normal text-h3 leading-5">TTAI</span>
            </div>
            <div class="flex justify-between items-center mt-1 text-h4">
              {{ $t('balance') }}: 0.00
            </div>
          </div>
          <button class="h-8 bg-gradient-primary rounded-full px-5 text-white text-h5">
            {{$t('tip')}}
          </button>
        </div>
        <div class="pl-12 flex flex-col gap-2 mt-2">
          <div class="flex items-center gap-2 text-h4">
            <span>{{ $t('profileView.availableBalance') }}: </span>
            <span class="text-h5">0.00</span>
            <button @click="useSocialAccountModalStore().openAvailableBalanceModal('TTAI')">
              <img class="w-6" src="../../../assets/icons/icon-edit.svg" alt="">
            </button>
          </div>
          <div class="flex items-center gap-2 text-h4">
            <span>{{ $t('profileView.creditLimit') }}:</span>
            <span class="bg-red-normal text-white px-1 py-1 rounded-md text-sm">100/trans</span>
            <span class="bg-red-normal text-white px-1 py-1 rounded-md text-sm">10000/day</span>
            <button @click="useSocialAccountModalStore().openCreditLimitModal('TTAI')">
              <img class="w-6" src="../../../assets/icons/icon-edit.svg" alt="">
            </button>
          </div>
        </div>
      </div>
    </van-list>
  </van-pull-refresh>
</template>

<style scoped>

</style>
