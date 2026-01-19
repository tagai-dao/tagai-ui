<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
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

// Tab状态
const activeTab = ref<'event' | 'battle'>('event')

// 描述文字展开/收起状态
const battleDescExpanded = ref(false)
const eventDescExpanded = ref(false)
const battleDescRef = ref<HTMLElement | null>(null)
const eventDescRef = ref<HTMLElement | null>(null)
const battleDescNeedMore = ref(false)
const eventDescNeedMore = ref(false)

// 检查文字是否需要展开按钮
const checkDescOverflow = async () => {
  await nextTick()
  // 检查 Battle 描述
  if (battleDescRef.value) {
    const element = battleDescRef.value
    // 创建一个隐藏的副本来测量完整高度
    const clone = element.cloneNode(true) as HTMLElement
    clone.style.position = 'absolute'
    clone.style.visibility = 'hidden'
    clone.style.height = 'auto'
    clone.style.maxHeight = 'none'
    clone.style.width = element.offsetWidth + 'px'
    clone.classList.remove('line-clamp-2')
    document.body.appendChild(clone)
    const fullHeight = clone.scrollHeight
    document.body.removeChild(clone)
    // 计算2行的预期高度
    const computedStyle = window.getComputedStyle(element)
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5
    const expectedHeight = lineHeight * 2
    battleDescNeedMore.value = fullHeight > expectedHeight + 1
  }
  // 检查 Event 描述
  if (eventDescRef.value) {
    const element = eventDescRef.value
    const clone = element.cloneNode(true) as HTMLElement
    clone.style.position = 'absolute'
    clone.style.visibility = 'hidden'
    clone.style.height = 'auto'
    clone.style.maxHeight = 'none'
    clone.style.width = element.offsetWidth + 'px'
    clone.classList.remove('line-clamp-2')
    document.body.appendChild(clone)
    const fullHeight = clone.scrollHeight
    document.body.removeChild(clone)
    const computedStyle = window.getComputedStyle(element)
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5
    const expectedHeight = lineHeight * 2
    eventDescNeedMore.value = fullHeight > expectedHeight + 1
  }
}

// 切换描述文字展开/收起
const toggleBattleDesc = () => {
  battleDescExpanded.value = !battleDescExpanded.value
}

const toggleEventDesc = () => {
  eventDescExpanded.value = !eventDescExpanded.value
}

// 监听 Tab 切换，重置展开状态
watch(activeTab, () => {
  battleDescExpanded.value = false
  eventDescExpanded.value = false
  nextTick(() => {
    checkDescOverflow()
  })
})

// 监听国际化语言变化，重新检查
watch(() => t('createPredict.tabBattleDesc'), () => {
  nextTick(() => {
    checkDescOverflow()
  })
})

watch(() => t('createPredict.tabEventDesc'), () => {
  nextTick(() => {
    checkDescOverflow()
  })
})

// 表单数据 - 对战
const formData = reactive({
  title: '',
  predict1: '',
  predict2: '',
  tweetAId: '',
  tweetBId: '',
  initAmount: '',
  distributionHint: 50
})

// 表单数据 - 真实世界
const realWorldFormData = reactive({
  title: '',
  body: '',
  announceDate: '',
  initAmount: '',
  distributionHint: 50
})

// 错误信息 - 对战
const errors = reactive({
  title: '',
  predict1: '',
  predict2: '',
  initAmount: ''
})

// 错误信息 - 真实世界
const realWorldErrors = reactive({
  title: '',
  body: '',
  announceDate: '',
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

// 验证表单 - 对战
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

// 验证表单 - 真实世界
const validateRealWorldForm = (): boolean => {
  realWorldErrors.title = ''
  realWorldErrors.body = ''
  realWorldErrors.announceDate = ''
  realWorldErrors.initAmount = ''

  let isValid = true

  // 验证标题
  if (!realWorldFormData.title.trim()) {
    realWorldErrors.title = t('createPredict.titleRequired')
    isValid = false
  } else if (realWorldFormData.title.trim().length < 3) {
    realWorldErrors.title = t('createPredict.titleTooShort')
    isValid = false
  } else if (realWorldFormData.title.trim().length > 100) {
    realWorldErrors.title = t('createPredict.titleTooLong')
    isValid = false
  }

  // 验证内容
  if (!realWorldFormData.body.trim()) {
    realWorldErrors.body = t('createPredict.bodyRequired')
    isValid = false
  } else if (realWorldFormData.body.trim().length > 300) {
    realWorldErrors.body = t('createPredict.bodyTooLong')
    isValid = false
  }

  // 验证日期
  if (!realWorldFormData.announceDate) {
    realWorldErrors.announceDate = t('createPredict.announceDateRequired')
    isValid = false
  } else {
    // 简单检查日期是否在未来
    if (new Date(realWorldFormData.announceDate).getTime() < Date.now()) {
      realWorldErrors.announceDate = t('createPredict.announceDateFuture')
      isValid = false
    }
  }

  // 验证初始资金
  if (!realWorldFormData.initAmount) {
    realWorldErrors.initAmount = t('createPredict.amountRequired')
    isValid = false
  } else if (isNaN(Number(realWorldFormData.initAmount)) || Number(realWorldFormData.initAmount) <= 0) {
    realWorldErrors.initAmount = t('createPredict.invalidAmount')
    isValid = false
  }

  return isValid
}

// 创建预测 - 对战
const createPredict = async () => {
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  
  createLoading.value = true
  const accInfo = accStore.getAccountInfo
  
  try {
    if (activeTab.value === 'battle') {
        if (!(await validateForm())) {
            return
        }
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
        const { hash, fpmmMaker } = await createMarket(questionId, comStore.currentSelectedCommunity?.token as `0x${string}`, feePath ?? [], formData.distributionHint, (dayNumber + 3) * 86400, parseUnits(formData.initAmount.toString(), 18))
        console.log({hash, fpmmMaker})
        await createFPMMMarketApi(accInfo.twitterId, questionId, hash);
        console.log('创建预测:', formData, fpmmMaker, hash)
        // const res = await createPredictApi(accStore.getAccountInfo?.twitterId, comStore.currentSelectedCommunity?.tick ?? '', formData.title, formData.tweetAId, formData.tweetBId)
        useModalStore().setModalCloseEnable(true);
        modalStore.setModalVisible(false);
        emitter.emit('createPredictSuccess')
    } else {
        // Real World Predict Creation Logic
        if (!validateRealWorldForm()) {
            return
        }
        
         // 检查用户余额是否足够
        const b = await getTokenBalance(comStore.currentSelectedCommunity?.token as `0x${string}`)
        if (b < parseUnits(realWorldFormData.initAmount.toString(), 18)) {
            notify({ message: t('errMessage.insufficientBalance'), type: 'info' })
            return;
        }
        
        console.log(t('createPredict.createRealWorld'), realWorldFormData)
        // TODO: 调用后端API
        // 模拟成功
        // notify({ message: '创建成功(模拟)', type: 'success' })
        // modalStore.setModalVisible(false)
        useModalStore().setModalCloseEnable(true); // Ensure modal can be closed if it fails or finishes
        // Temporary: keep modal open or close? User said "API pending", so maybe just log.
    }

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

  // 重置真实世界表单
  realWorldFormData.title = ''
  realWorldFormData.body = ''
  realWorldFormData.announceDate = ''
  realWorldFormData.initAmount = ''
  realWorldErrors.title = ''
  realWorldErrors.body = ''
  realWorldErrors.announceDate = ''
  realWorldErrors.initAmount = ''
}

onMounted(async () => {
  // @ts-ignore
  userBalance.value = Number((await getTokenBalance(comStore.currentSelectedCommunity?.token as `0x${string}`)).toString() / 1e18)
  // 检查描述文字是否需要展开按钮
  await nextTick()
  checkDescOverflow()
})
</script>

<template>
  <div class="create-predict-modal">
    <!-- 关闭按钮 -->
    <img
      class="absolute top-4 right-4 sm:top-6 sm:right-6 cursor-pointer w-6 h-6 hover:opacity-70 transition-opacity z-10"
      @click="closeModal"
      src="~@/assets/icons/icon-modal-close.svg"
      alt="Close"
    />
    
    <!-- Tabs -->
    <div class="flex p-1 bg-gray-100 rounded-lg mb-6">

      <button 
        class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200"
        :class="activeTab === 'event' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'event'"
      >
        {{ $t('createPredict.tabEvent') }}
      </button>
      <button 
        class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200"
        :class="activeTab === 'battle' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'battle'"
      >
        {{ $t('createPredict.tabBattle') }}
      </button>
    </div>

    <!-- 标题 (通用) -->
    <div class="text-left mb-6" v-if="activeTab === 'battle'">
      <div class="relative">
        <p 
          ref="battleDescRef"
          class="text-grey-normal text-sm"
          :class="!battleDescExpanded && battleDescNeedMore ? 'line-clamp-2' : ''"
        >
          {{ $t('createPredict.tabBattleDesc') }}
        </p>
        <button
          v-if="battleDescNeedMore"
          @click="toggleBattleDesc"
          class="text-blue-500 underline text-sm mt-1 inline-block hover:text-blue-600 transition-colors"
        >
          {{ battleDescExpanded ? $t('less') : $t('more') }}
        </button>
      </div>
    </div>
    <div class="text-left mb-6" v-else>
      <div class="relative">
        <p 
          ref="eventDescRef"
          class="text-grey-normal text-sm"
          :class="!eventDescExpanded && eventDescNeedMore ? 'line-clamp-2' : ''"
        >
          {{ $t('createPredict.tabEventDesc') }}
        </p>
        <button
          v-if="eventDescNeedMore"
          @click="toggleEventDesc"
          class="text-blue-500 underline text-sm mt-1 inline-block hover:text-blue-600 transition-colors"
        >
          {{ eventDescExpanded ? $t('less') : $t('more') }}
        </button>
      </div>
    </div>

    <!-- 预测对战表单 -->
    <div class="space-y-4" v-if="activeTab === 'battle'">
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

      <!-- Initial Ratio Slider -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <label class="flex items-center gap-1 text-sm font-medium text-black">
            {{ $t('createPredict.initialRatio') }}
            <span class="text-red-500">*</span>
            <el-tooltip
              class="box-item"
              effect="dark"
              :content="$t('createPredict.initialRatioTip')"
              placement="top"
            >
              <button class="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs hover:bg-gray-300 transition-colors">
                ?
              </button>
            </el-tooltip>
          </label>
          <span class="text-sm font-medium">
            <span class="text-red-500">{{ formData.distributionHint }}%</span> / <span class="text-blue-500">{{ 100 - formData.distributionHint }}%</span>
          </span>
        </div>
        
        <div class="relative h-6 flex items-center">
          <input 
            type="range" 
            v-model.number="formData.distributionHint" 
            min="1" 
            max="99"
            class="w-full h-2 rounded-lg appearance-none cursor-pointer slider-thumb"
            :style="{
              background: `linear-gradient(to right, #ef4444 ${formData.distributionHint}%, #3b82f6 ${formData.distributionHint}%)`
            }"
          />
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

    <!-- 真实世界预测表单 -->
    <div class="space-y-4" v-else-if="activeTab === 'event'">
        <!-- 标题 -->
        <div>
            <label class="block text-sm font-medium text-black mb-2">
            {{ $t('createPredict.titleLabel') }}
            <span class="text-red-500">*</span>
            </label>
            <input
            v-model="realWorldFormData.title"
            type="text"
            :placeholder="$t('createPredict.titlePlaceholderEvent')"
            class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :class="{
                'border-red-500': realWorldErrors.title,
                'border-grey-light': !realWorldErrors.title
            }"
            maxlength="100"
            />
            <div v-if="realWorldErrors.title" class="text-red-500 text-sm mt-1">
            {{ realWorldErrors.title }}
            </div>
            <div class="text-grey-normal text-xs mt-1">
            {{ realWorldFormData.title.length }}/100 {{ $t('createPredict.characters') }}
            </div>
        </div>

        <!-- 预测内容主体 -->
        <div>
            <label class="block text-sm font-medium text-black mb-2">
            {{ $t('createPredict.bodyLabel') }}
            <span class="text-red-500">*</span>
            </label>
            <textarea
            v-model="realWorldFormData.body"
            :placeholder="$t('createPredict.bodyPlaceholder')"
            rows="4"
            maxlength="300"
            class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            :class="{
                'border-red-500': realWorldErrors.body,
                'border-grey-light': !realWorldErrors.body
            }"
            ></textarea>
            <div v-if="realWorldErrors.body" class="text-red-500 text-sm mt-1">
            {{ realWorldErrors.body }}
            </div>
            <div class="text-grey-normal text-xs mt-1">
            {{ realWorldFormData.body.length }}/300 {{ $t('createPredict.characters') }}
            </div>
        </div>

        <!-- 事件公布日期 -->
        <div>
            <label class="flex items-center gap-1 text-sm font-medium text-black mb-2">
            {{ $t('createPredict.announceDateLabel') }}
            <span class="text-red-500">*</span>
            </label>
            <el-date-picker
                v-model="realWorldFormData.announceDate"
                type="datetime"
                :placeholder="$t('createPredict.announceDatePlaceholder')"
                class="w-full !w-full"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                :class="{
                    'border-red-500': realWorldErrors.announceDate
                }"
            />
            <div v-if="realWorldErrors.announceDate" class="text-red-500 text-sm mt-1">
            {{ realWorldErrors.announceDate }}
            </div>
        </div>

        <!-- Initial Ratio Slider -->
        <div>
            <div class="flex justify-between items-center mb-2">
            <label class="flex items-center gap-1 text-sm font-medium text-black">
                {{ $t('createPredict.initialRatio') }}
                <span class="text-red-500">*</span>
                <el-tooltip
                class="box-item"
                effect="dark"
                :content="$t('createPredict.initialRatioTipEvent')"
                placement="top"
                >
                <button class="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs hover:bg-gray-300 transition-colors">
                    ?
                </button>
                </el-tooltip>
            </label>
            <span class="text-sm font-medium">
                <span class="text-red-500">{{ realWorldFormData.distributionHint }}%</span> / <span class="text-blue-500">{{ 100 - realWorldFormData.distributionHint }}%</span>
            </span>
            </div>
            
            <div class="relative h-6 flex items-center">
            <input 
                type="range" 
                v-model.number="realWorldFormData.distributionHint" 
                min="1" 
                max="99"
                class="w-full h-2 rounded-lg appearance-none cursor-pointer slider-thumb"
                :style="{
                background: `linear-gradient(to right, #ef4444 ${realWorldFormData.distributionHint}%, #3b82f6 ${realWorldFormData.distributionHint}%)`
                }"
            />
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
                v-model="realWorldFormData.initAmount"
                type="number"
                step="0.0001"
                min="0"
                :placeholder="$t('createPredict.amountPlaceholder')"
                class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                :class="{
                'border-red-500': realWorldErrors.initAmount,
                'border-grey-light': !realWorldErrors.initAmount
                }"
            />
            <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-grey-normal text-sm font-medium">{{ comStore.currentSelectedCommunity?.tick }}</span>
            </div>
            <div class="flex justify-between items-start mt-1">
            <div class="text-red-500 text-sm">
                {{ realWorldErrors.initAmount }}
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
  position: relative;
  /* 移动端：限制最大高度，上下留白 */
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .create-predict-modal {
    max-height: calc(100vh - 3rem);
    padding: 20px;
  }
}

/* 文本截断样式 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 输入框聚焦样式 */
input:focus, textarea:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 错误状态样式 */
input.border-red-500:focus, textarea.border-red-500:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Slider Thumb Customization */
.slider-thumb::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.slider-thumb::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Element Plus DatePicker Customization if needed */
:deep(.el-input__wrapper) {
  padding: 11px 16px;
  border-radius: 0.75rem;
  box-shadow: 0 0 0 1px #e5e7eb inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset !important;
}
</style>