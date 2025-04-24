<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSocialAccountModalStore } from "@/stores/wallet";
import { WETH } from "@/config";
import { type SocialAccountTokens } from "@/types";
import { formatAmount } from "@/utils/helper";

const socialAccountModalStore = useSocialAccountModalStore()
const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const scroller = document.querySelector('#profile-tab-scroller')

const onLoad = async () => {

}

const onRefresh = async () => {
  await socialAccountModalStore.updateSocialAccountTokens()
}

onMounted(async () => {
  onRefresh()
})

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
      <div v-for="token of socialAccountModalStore.socialAccountTokens" :key="token.token"
           class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3 mb-2">
        <div class="flex items-start gap-2">
          <div class="w-10 min-w-10 h-10 cursor-pointer rounded-full bg-grey-normal-active shadow-tag-logo
                      flex items-center justify-center relative overflow-hidden">
            <img class="w-10" :src="token.logo" alt="">
          </div>
          <div class="flex-1">
            <div class="flex gap-2 items-center">
              <span class="text-grey-normal text-h3 leading-5">{{ token.tick }}</span>
              <el-popover v-if="token.tick == 'WBNB'" popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.wbnbDesc') }}</div>
                </div>
              </template>
            </el-popover>
            </div>
            <div class="flex justify-between items-center mt-1 text-h4">
              {{ $t('balance') }}: {{ formatAmount(token.balance) }}
            </div>
          </div>
          <button v-if="token.token != WETH" 
          class="h-8 bg-gradient-primary rounded-full px-5 text-white text-h5"
          @click="socialAccountModalStore.openTipTokenModal(token)">
            {{$t('tip')}}
          </button>
        </div>
        <div class="pl-12 flex flex-col gap-2 mt-2">
          <div class="flex items-center gap-2 text-h4">
            <span>{{ $t('profileView.allowance') }}: </span>
            <span class="text-h5">{{ formatAmount(token.allowance) }}</span>
            <button @click="socialAccountModalStore.openAllowanceModal(token)">
              <img class="w-6" src="../../../assets/icons/icon-edit.svg" alt="">
            </button>
          </div>
          <div class="flex items-center gap-2 text-h4">
            <span>{{ $t('profileView.limit') }}:</span>
            <span class="text-h5">{{ formatAmount(token.maxPerTx) }} / trans</span>
            <span class="text-h5">{{ formatAmount(token.maxPerDay) }} / day</span>
            <button @click="socialAccountModalStore.openLimitModal(token)">
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
