<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { handleErrorTip } from '@/utils/notify'
import { GlobalModalType } from '@/types'
import { getTweetCurations, createPredict as createPredictApi } from '@/apis/api'
import { OperateType, useTweet } from '@/composables/useTweet'
import { useCommunityStore } from '@/stores/community'

const { t } = useI18n()
const { preCheckCuration } = useTweet()
const accStore = useAccountStore()
const modalStore = useModalStore()
const comStore = useCommunityStore()
// 表单数据
const formData = reactive({
  title: '',
  predict1: '',
  predict2: '',
  tweetAId: '',
  tweetBId: ''
})

// 错误信息
const errors = reactive({
  title: '',
  predict1: '',
  predict2: ''
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
  let isValid = true
  
  // 重置错误信息
  errors.title = ''
  errors.predict1 = ''
  errors.predict2 = ''
  
  // 验证标题
  if (!formData.title.trim()) {
    errors.title = t('createPredict.titleRequired')
    isValid = false
  } else if (formData.title.trim().length < 3) {
    errors.title = t('createPredict.titleTooShort')
    isValid = false
  } else if (formData.title.trim().length > 100) {
    errors.title = t('createPredict.titleTooLong')
    isValid = false
  }
  
  // 验证预测1
  let predictA = validateTwitterUrl(formData.predict1)
  let predictB = validateTwitterUrl(formData.predict2)
  console.log(33, predictA, predictB)
  if (!formData.predict1.trim()) {
    errors.predict1 = t('createPredict.predict1Required')
    isValid = false
  } else if (!predictA) {
    errors.predict1 = t('createPredict.invalidTwitterUrl')
    isValid = false
  }
  
  // 验证预测2
  if (!formData.predict2.trim()) {
    errors.predict2 = t('createPredict.predict2Required')
    isValid = false
  } else if (!predictB) {
    errors.predict2 = t('createPredict.invalidTwitterUrl')
    isValid = false
  }

  // check tweetId
  const tweetIdA = predictA?.[3]
  const tweetIdB = predictB?.[3]
  if (!tweetIdA) {
    errors.predict1 = t('createPredict.invalidTwitterUrl')
    isValid = false
    return isValid
  }
  if (!tweetIdB) {
    errors.predict2 = t('createPredict.invalidTwitterUrl')
    isValid = false
    return isValid
  }
  if (tweetIdA === tweetIdB) {
    errors.predict2 = t('createPredict.predictsCannotBeSame')
    isValid = false
  }

  formData.tweetAId = tweetIdA
  formData.tweetBId = tweetIdB

  // check curation
  const currentCurations: any = await getTweetCurations(tweetIdA, tweetIdB)
  console.log(44, currentCurations)
  const tweetA = currentCurations.find((item: any) => item.tweetId === tweetIdA)
  const tweetB = currentCurations.find((item: any) => item.tweetId === tweetIdB)
  const currentTime = Date.now()
  if (tweetA) {
    if (tweetA.tick !== comStore.currentSelectedCommunity?.tick) {
      errors.predict1 = t('createPredict.predictsFromDifferentCommunities', { community: comStore.currentSelectedCommunity?.tick })
      isValid = false
      return isValid    
    }
    if ((tweetA.dayNumber + 3) * 86400000  - 8 * 3600000 < currentTime) {
      errors.predict1 = t('createPredict.predictsExpired')
      isValid = false
      return isValid
    }
  }
  
  if (tweetB) {
    if (tweetB.tick !== comStore.currentSelectedCommunity?.tick) {
      errors.predict2 = t('createPredict.predictsFromDifferentCommunities', { community: comStore.currentSelectedCommunity?.tick })
      isValid = false
      return isValid
    }
    if ((tweetB.dayNumber + 3) * 86400000  - 8 * 3600000 < currentTime) {
      errors.predict2 = t('createPredict.predictsExpired')
      isValid = false
      return isValid
    }
    formData.tweetBId = tweetB.tweetId
  }
  
  return isValid
}

// 创建预测
const createPredict = async () => {
  if (!validateForm()) {
    return
  }
  
  
  
  createLoading.value = true
  
  try {
    if(!await preCheckCuration(OperateType.CREATE_PREDICT)) {
        return;
    }
    console.log('创建预测:', formData)
    const res = await createPredictApi(accStore.getAccountInfo?.twitterId, comStore.currentSelectedCommunity?.tick ?? '', formData.title, formData.tweetAId, formData.tweetBId)

    console.log(55, res)
  } catch (error) {
    console.log(66, error)
    handleErrorTip(error)
  } finally {
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
  errors.title = ''
  errors.predict1 = ''
  errors.predict2 = ''
}
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
    </div>

    <!-- 按钮区域 -->
    <div class="flex gap-3 mt-8">
      <button
        @click="createPredict"
        :disabled="createLoading"
        class="flex-1 h-12 bg-gradient-primary text-white font-bold rounded-full text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i-ep-loading v-if="createLoading" class="animate-spin" />
        <span>{{ $t('createPredict.create') }}</span>
      </button>
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
