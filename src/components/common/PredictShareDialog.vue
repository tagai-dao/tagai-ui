<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { stringLength } from '@/utils/helper'
import {
  getCommerceShareTextMaxLength,
  truncateToMaxStringLength,
  type PredictShareType,
} from '@/utils/predictShare'

const props = defineProps<{
  show: boolean
  type: PredictShareType
  marketAddress: string
  sharing?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [text: string]
}>()

const shareText = ref('')
const maxLength = computed(() => getCommerceShareTextMaxLength())
const shareTextLength = computed(() => stringLength(shareText.value))
const leftWordsLength = computed(() => maxLength.value - shareTextLength.value)

watch(() => props.show, (visible) => {
  if (visible) shareText.value = ''
})

watch(shareText, (val) => {
  const truncated = truncateToMaxStringLength(val, maxLength.value)
  if (truncated !== val) shareText.value = truncated
})

const close = () => emit('update:show', false)

const onConfirm = () => {
  if (leftWordsLength.value < 0 || props.sharing) return
  emit('confirm', shareText.value.trim())
}
</script>

<template>
  <van-dialog
    :show="show"
    :show-confirm-button="false"
    :show-cancel-button="false"
    class="share-blink-dialog"
    close-on-click-overlay
    @update:show="emit('update:show', $event)"
  >
    <div class="py-6 px-6 relative">
      <button
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        @click="close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <h3 class="text-lg font-bold text-center mb-4 text-gray-800">Share to Twitter</h3>

      <div class="flex justify-between items-center mb-1">
        <div class="text-sm text-gray-600">{{ $t('postView.typeTip') }}</div>
        <div class="text-sm" :class="leftWordsLength < 0 ? 'text-red-e6' : 'text-gray-400'">
          {{ leftWordsLength }}
        </div>
      </div>

      <textarea
        v-model="shareText"
        class="w-full border border-gray-200 rounded-lg p-3 text-base resize-none focus:outline-none focus:border-orange-normal"
        rows="4"
        :placeholder="$t('postView.pleaseInput')"
      />

      <button
        class="w-full py-3 mt-4 rounded-full text-white font-bold text-lg shadow-md transition-all duration-200 flex items-center justify-center"
        :class="sharing ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-primary hover:shadow-lg'"
        :disabled="sharing || leftWordsLength < 0"
        @click="onConfirm"
      >
        {{ sharing ? 'Posting...' : 'Post' }}
        <i-ep-loading v-if="sharing" class="animate-spin mr-2" />
      </button>
    </div>
  </van-dialog>
</template>
