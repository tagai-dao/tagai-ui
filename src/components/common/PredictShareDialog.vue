<script setup lang="ts">
import { watch } from 'vue'
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import { useCreateTweet } from '@/composables/useCreateTweet'
import {
  getCommerceShareTextMaxLength,
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

const {
  contentRef,
  showClear,
  contentEl,
  leftWordsLength,
  tweetLength,
  contentInput,
  getBlur,
  onPaste,
  selectEmoji,
  formatElToTextContent,
} = useCreateTweet(getCommerceShareTextMaxLength())

const resetEditor = () => {
  contentEl.value = ''
  showClear.value = false
  tweetLength.value = 0
  if (contentRef.value) {
    contentRef.value.innerHTML = ''
  }
}

watch(() => props.show, (visible) => {
  if (visible) resetEditor()
})

const close = () => emit('update:show', false)

const onConfirm = () => {
  if (leftWordsLength.value < 0 || props.sharing) return
  const text = contentRef.value ? formatElToTextContent(contentRef.value).trim() : ''
  emit('confirm', text)
}
</script>

<template>
  <el-dialog
    :model-value="show"
    modal-class="overlay-white"
    class="max-w-[500px] rounded-[20px]"
    width="90%"
    append-to-body
    :show-close="false"
    align-center
    destroy-on-close
    @update:model-value="emit('update:show', $event)"
  >
    <div class="flex flex-col gap-y-4 py-2">
      <h3 class="text-xl font-medium text-black text-center">Share to Twitter</h3>

      <div>
        <div class="flex justify-between items-center px-2 mb-1">
          <div class="text-sm text-gray-600">{{ $t('postView.typeTip') }}</div>
          <div class="text-sm" :class="leftWordsLength < 0 ? 'text-red-e6' : 'text-gray-400'">
            {{ leftWordsLength }}
          </div>
        </div>

        <div class="max-h-[176px] overflow-hidden relative flex flex-col bg-grey-f0/90 rounded-2xl">
          <div
            contenteditable
            class="outline-none flex-1 overflow-auto no-scroll-bar min-h-[56px] px-3 pt-2 whitespace-pre-line text-lg z-10 relative"
            ref="contentRef"
            @input="contentInput"
            @blur="getBlur"
            @paste="onPaste"
            v-html="contentEl"
          />
          <div v-if="!showClear" class="absolute top-3 left-3 text-14px leading-24px z-0 opacity-30 pointer-events-none">
            {{ $t('postView.pleaseInput') }}
          </div>
          <div class="flex justify-between items-center px-3 py-2">
            <el-popover trigger="click" width="300" :teleported="true" :persistent="false">
              <template #reference>
                <img
                  class="w-1.8rem h-1.8rem lg:w-1.4rem lg:h-1.4rem cursor-pointer"
                  src="~@/assets/icons/icon-emoji.svg"
                  alt=""
                />
              </template>
              <template #default>
                <div class="h-[310px] lg:h-[400px]">
                  <EmojiPicker
                    :options="{ imgSrc: '/emoji/', locals: 'en', hasSkinTones: false, hasGroupIcons: false }"
                    @select="(e: any) => selectEmoji(e)"
                  />
                </div>
              </template>
            </el-popover>
          </div>
        </div>
      </div>

      <div class="flex justify-center gap-3">
        <button
          class="h-10 px-5 rounded-full text-gray-600 font-medium border border-grey-e6"
          :disabled="sharing"
          @click="close"
        >
          {{ $t('cancel') }}
        </button>
        <button
          class="h-10 px-5 bg-gradient-primary rounded-full flex justify-center items-center gap-2 disabled:opacity-30"
          :disabled="sharing || leftWordsLength < 0"
          @click="onConfirm"
        >
          <span class="text-white font-bold text-lg">{{ sharing ? 'Posting...' : 'Post' }}</span>
          <i-ep-loading v-if="sharing" class="animate-spin text-white" />
        </button>
      </div>
    </div>
  </el-dialog>
</template>
