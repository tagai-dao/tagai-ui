<script setup lang="ts">
import { ref } from 'vue'
import { GlobalModalType } from '@/types'
import { useModalStore } from '@/stores/common'
import PredictBattle from './PredictBattle.vue'
import PredictEvent from './PredictEvent.vue'

const modalStore = useModalStore()
const activeTab = ref<'event' | 'battle'>('event')

/** 预览用：未登录也可打开创建弹窗；恢复鉴权时取消下行注释并恢复 ensureAuth */
const createPredict = () => {
  modalStore.setModalVisible(true, GlobalModalType.CreatePredict)
}
</script>

<template>
  <div class="prediction-index-container w-full h-full flex flex-col">
    <div class="flex justify-between items-center px-4 py-3 bg-white/50 backdrop-blur-sm sticky top-0 z-10 gap-2">
      <div class="flex p-1 bg-gray-100 rounded-lg shrink-0">
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

      <button
        class="flex gap-2 items-center cursor-pointer px-4 py-1.5 rounded-full bg-gradient-primary text-white shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
        @click="createPredict"
      >
        <span class="text-xl -mt-0.5 font-bold">+</span>
        <span class="whitespace-nowrap text-sm font-medium">{{ $t('createPredictBattle') }}</span>
      </button>
    </div>

    <div class="flex-1 min-h-0">
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

.bg-gradient-primary {
  background: linear-gradient(135deg, #FE913F 0%, #E58339 100%);
}
</style>
