<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { handleErrorTip, notify } from '@/utils/notify'
import { GlobalModalType } from '@/types'
import { getTweetCurations, createFPMMMarket as createFPMMMarketApi, preCreateFPMMMarket } from '@/apis/api'
import { OperateType, useTweet } from '@/composables/useTweet'
import { useCommunityStore } from '@/stores/community'
import { useAccount } from '@/composables/useAccount'
import emitter from '@/utils/emitter'
import { getTokenBalance } from '@/utils/web3'
import { formatAmount } from '@/utils/helper'
import { parseUnits } from 'viem'
import { createMarket } from '@/utils/fpmm'

const { t } = useI18n()
const { preCheckCuration } = useTweet()
const accStore = useAccountStore()
const modalStore = useModalStore()
const comStore = useCommunityStore()
const userBalance = ref(0)
const { accountMismatch } = useAccount()
// 表单数据
const formData = reactive({
  title: '',
  predict1: '',
  predict2: '',
  tweetAId: '',
  tweetBId: '',
  initAmount: ''
})

// 错误信息
const errors = reactive({
  title: '',
  predict1: '',
  predict2: '',
  initAmount: ''
})

// 加载状态
const createLoading = ref(false)

// 推特链接验证正则表达式
const twitterUrlRegex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/(\d+)/

// 验证推特链接
const validateTwitterUrl = (url: string): RegExpMatchArray | null => {
  return url.trim().match(twitterUrlRegex)
}

// 验证表单
const validateForm = async (): Promise<boolean> => {
  
  // 重置错误信息
  errors.title = ''
  errors.predict1 = ''
  errors.predict2 = ''
  
  // 验证标题
  if (!formData.title.trim()) {
    errors.title = t('createPredict.titleRequired')
    return false
  } else if (formData.title.trim().length < 3) {
    errors.title = t('createPredict.titleTooShort')
    return false
  } else if (formData.title.trim().length > 100) {
    errors.title = t('createPredict.titleTooLong')
    return false
  }
  
  // 验证预测1
  let predictA = validateTwitterUrl(formData.predict1)
  let predictB = validateTwitterUrl(formData.predict2)
  if (!formData.predict1.trim()) {
    errors.predict1 = t('createPredict.predict1Required')
    return false
  } else if (!predictA) {
    errors.predict1 = t('createPredict.invalidTwitterUrl')
    return false
  }
  
  // 验证预测2
  if (!formData.predict2.trim()) {
    errors.predict2 = t('createPredict.predict2Required')
    return false
  } else if (!predictB) {
    errors.predict2 = t('createPredict.invalidTwitterUrl')
    return false
  }

  // 验证初始资金
  if (!formData.initAmount) {
    errors.initAmount = t('createPredict.amountRequired')
    return false
  } else if (isNaN(Number(formData.initAmount)) || Number(formData.initAmount) <= 0) {
    errors.initAmount = t('createPredict.invalidAmount')
    return false
  }

  // check tweetId
  const tweetIdA = predictA?.[3]
  const tweetIdB = predictB?.[3]
  if (!tweetIdA) {
    errors.predict1 = t('createPredict.invalidTwitterUrl')
    return false
  }
  if (!tweetIdB) {
    errors.predict2 = t('createPredict.invalidTwitterUrl')
    return false
  }
  if (tweetIdA === tweetIdB) {
    errors.predict2 = t('createPredict.predictsCannotBeSame')
    return false
  }

  formData.tweetAId = tweetIdA
  formData.tweetBId = tweetIdB

  // check curation
  const currentCurations: any = await getTweetCurations(tweetIdA, tweetIdB)
  const tweetA = currentCurations.find((item: any) => item.tweetId === tweetIdA)
  const tweetB = currentCurations.find((item: any) => item.tweetId === tweetIdB)
  const currentTime = Date.now()
  if (tweetA) {
    if (tweetA.tick !== comStore.currentSelectedCommunity?.tick) {
      errors.predict1 = t('createPredict.predictsFromDifferentCommunities', { community: comStore.currentSelectedCommunity?.tick })
      return false 
    }
    if ((tweetA.dayNumber + 3) * 86400000  - 8 * 3600000 < currentTime) {
      errors.predict1 = t('createPredict.predictsExpired')
      return false
    }
  }
  
  if (tweetB) {
    if (tweetB.tick !== comStore.currentSelectedCommunity?.tick) {
      errors.predict2 = t('createPredict.predictsFromDifferentCommunities', { community: comStore.currentSelectedCommunity?.tick })
      return false
    }
    if ((tweetB.dayNumber + 3) * 86400000  - 8 * 3600000 < currentTime) {
      errors.predict2 = t('createPredict.predictsExpired')
      return false
    }
    formData.tweetBId = tweetB.tweetId
  }
  
  return true
}

// 创建预测
const createPredict = async () => {
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  if (!(await validateForm())) {
    return
  }
  
  createLoading.value = true
  const accInfo = accStore.getAccountInfo
  
  try {
    // 检查用户余额是否足够
    const b = await getTokenBalance(comStore.currentSelectedCommunity?.token as `0x${string}`)
    if (b < parseUnits(formData.initAmount.toString(), 18)) {
      notify({ message: t('errMessage.insufficientBalance'), type: 'info' })
      return;
    }

    useModalStore().setModalCloseEnable(false);

    // 预创建市场记录，并生成questionid
    const preMarketData: any = await preCreateFPMMMarket(accInfo?.twitterId, comStore.currentSelectedCommunity?.tick ?? '', formData.title, formData.tweetAId, formData.tweetBId);
    console.log(633, preMarketData)
    let { questionId, needOP, feePath, dayNumber } = preMarketData;

    if (feePath && typeof(feePath) === 'string') {
      feePath = JSON.parse(feePath)
    }

    if (!(await preCheckCuration(OperateType.CREATE_PREDICT, undefined, needOP))) {
      notify({ message: t('errMessage.insufficientOp'), type: 'info' })
      return;
    }

    // 开始创建市场
    const { hash, fpmmMaker } = await createMarket(questionId, comStore.currentSelectedCommunity?.token as `0x${string}`, feePath ?? [], (dayNumber + 3) * 86400, parseUnits(formData.initAmount.toString(), 18))
    console.log({hash, fpmmMaker})
    await createFPMMMarketApi(accInfo.twitterId, questionId, hash);
    console.log('创建预测:', formData, fpmmMaker, hash)
    // const res = await createPredictApi(accStore.getAccountInfo?.twitterId, comStore.currentSelectedCommunity?.tick ?? '', formData.title, formData.tweetAId, formData.tweetBId)
    modalStore.setModalVisible(false);
    emitter.emit('createPredictSuccess')
  } catch (error) {
    console.log(66, error)
    handleErrorTip(error)
  } finally {
    useModalStore().setModalCloseEnable(true);
    createLoading.value = false
  }
}

// 关闭模态框
const closeModal = () => {
  modalStore.setModalVisible(false)
  // 重置表单和错误
  formData.title = ''
  formData.predict1 = ''
  formData.predict2 = ''
  formData.initAmount = ''
  errors.title = ''
  errors.predict1 = ''
  errors.predict2 = ''
  errors.initAmount = ''
}

onMounted(async () => {
  // @ts-ignore
  userBalance.value = Number((await getTokenBalance(comStore.currentSelectedCommunity?.token as `0x${string}`)).toString() / 1e18)
})
</script>

<template>
  <div class="create-predict-modal">
    <!-- 标题 -->
    <div class="text-center mb-6">
      <h2 class="text-2xl font-bold text-black mb-2">{{ $t('createPredict.title') }}</h2>
      <p class="text-grey-normal text-sm">{{ $t('createPredict.subtitle') }}</p>
    </div>

    <!-- 表单 -->
    <div class="space-y-4">
      <!-- 预测标题 -->
      <div>
        <label class="block text-sm font-medium text-black mb-2">
          {{ $t('createPredict.battleTitle') }}
          <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.title"
          type="text"
          :placeholder="$t('createPredict.titlePlaceholder')"
          class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          :class="{
            'border-red-500': errors.title,
            'border-grey-light': !errors.title
          }"
          maxlength="100"
        />
        <div v-if="errors.title" class="text-red-500 text-sm mt-1">
          {{ errors.title }}
        </div>
        <div class="text-grey-normal text-xs mt-1">
          {{ formData.title.length }}/100 {{ $t('createPredict.characters') }}
        </div>
      </div>

      <!-- 预测1 -->
      <div>
        <label class="block text-sm font-medium text-black mb-2">
          {{ $t('createPredict.predict1') }}
          <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.predict1"
          type="url"
          :placeholder="$t('createPredict.twitterUrlPlaceholder')"
          class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          :class="{
            'border-red-500': errors.predict1,
            'border-grey-light': !errors.predict1
          }"
        />
        <div v-if="errors.predict1" class="text-red-500 text-sm mt-1">
          {{ errors.predict1 }}
        </div>
      </div>

      <!-- 预测2 -->
      <div>
        <label class="block text-sm font-medium text-black mb-2">
          {{ $t('createPredict.predict2') }}
          <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.predict2"
          type="url"
          :placeholder="$t('createPredict.twitterUrlPlaceholder')"
          class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          :class="{
            'border-red-500': errors.predict2,
            'border-grey-light': !errors.predict2
          }"
        />
        <div v-if="errors.predict2" class="text-red-500 text-sm mt-1">
          {{ errors.predict2 }}
        </div>
      </div>

      <!-- 注入资金 -->
      <div>
        <label class="flex items-center gap-1 text-sm font-medium text-black mb-2">
          {{ $t('createPredict.initAmount') }}
          <span class="text-red-500">*</span>
          <el-tooltip
            class="box-item"
            effect="dark"
            :content="$t('createPredict.initAmountTip')"
            placement="top"
          >
            <button class="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs hover:bg-gray-300 transition-colors">
              ?
            </button>
          </el-tooltip>
        </label>
        <div class="relative">
          <input
            v-model="formData.initAmount"
            type="number"
            step="0.0001"
            min="0"
            :placeholder="$t('createPredict.amountPlaceholder')"
            class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
            :class="{
              'border-red-500': errors.initAmount,
              'border-grey-light': !errors.initAmount
            }"
          />
          <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-grey-normal text-sm font-medium">{{ comStore.currentSelectedCommunity?.tick }}</span>
        </div>
        <div class="flex justify-between items-start mt-1">
          <div class="text-red-500 text-sm">
            {{ errors.initAmount }}
          </div>
          <div class="text-grey-normal text-xs text-right ml-auto">
            {{ $t('balance') }}: {{ formatAmount(userBalance)}} {{ comStore.currentSelectedCommunity?.tick }}
          </div>
        </div>
      </div>
    </div>

    <!-- 按钮区域 -->
    <div class="gap-3 mt-8">
      <button
        @click="createPredict"
        :disabled="createLoading || accountMismatch"
        class="w-full h-12 bg-gradient-primary text-white font-bold rounded-full text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i-ep-loading v-if="createLoading" class="animate-spin" />
        <span>{{ accStore.ethConnectAddress ? $t('createPredict.create') : $t('connect') }}</span>
      </button>
      <span v-if="accountMismatch" class="text-red-e6 text-sm text-center">
        {{ $t('web3.addressMismatch', {address: useAccountStore().getAccountInfo.ethAddr}) }}
      </span>
      <span v-if="createLoading" class="text-red-e6 text-sm text-center">
        {{ $t('createPredict.creatingTip') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.create-predict-modal {
  padding: 24px;
}

/* 输入框聚焦样式 */
input:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 错误状态样式 */
input.border-red-500:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
</style>
