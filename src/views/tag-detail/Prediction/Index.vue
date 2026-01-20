<script setup lang="ts">
import { ref } from 'vue'
import { GlobalModalType } from '@/types'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import PredictBattle from './PredictBattle.vue'
import PredictEvent from './PredictEvent.vue'

const accStore = useAccountStore()
const activeTab = ref<'event' | 'battle'>('event')

const createPredict = () => {
  if (!accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return;
  }
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }

  useModalStore().setModalVisible(true, GlobalModalType.CreatePredict)
}
</script>

<template>
  <div class="prediction-index-container w-full h-full flex flex-col">
    <!-- 顶部 Header: 左侧 Tabs，右侧 创建按钮 -->
    <div class="flex justify-between items-center px-4 py-3 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
      <!-- Tabs -->
      <div class="flex p-1 bg-gray-100 rounded-lg">
        <button 
          class="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
          :class="activeTab === 'event' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'event'"
        >
          {{ $t('createPredict.tabEvent') }}
        </button>
        <button 
          class="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
          :class="activeTab === 'battle' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          @click="activeTab = 'battle'"
        >
          {{ $t('createPredict.tabBattle') }}
        </button>
      </div>

      <!-- Create Button -->
      <button class="flex gap-2 items-center cursor-pointer px-4 py-1.5 rounded-full bg-gradient-primary text-white shadow-md hover:shadow-lg transition-all active:scale-95"
              @click="createPredict">
        <span class="text-xl -mt-0.5 font-bold">+</span>
        <span class="whitespace-nowrap text-sm font-medium">{{$t('createPredictBattle')}}</span>
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-hidden">
      <KeepAlive>
        <component :is="activeTab === 'event' ? PredictEvent : PredictBattle" />
      </KeepAlive>
    </div>
  </div>
</template>

<style scoped>
.prediction-index-container {
  background-color: #f8f9fa;
  min-height: 100vh;
}

/* 渐变背景类，如果全局已有可以省略 */
.bg-gradient-primary {
  background: linear-gradient(135deg, #FE913F 0%, #E58339 100%);
}
</style>
