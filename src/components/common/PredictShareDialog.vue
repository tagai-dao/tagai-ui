<script setup lang="ts">
import { watch } from 'vue'
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import { useCreateTweet } from '@/composables/useCreateTweet'
import { useUploadImg } from '@/composables/useUploadImg'
import { notify } from '@/utils/notify'
import {
  getCommerceShareTextMaxLength,
  type PredictShareType,
} from '@/utils/predictShare'

const props = withDefaults(defineProps<{
  show: boolean
  type: PredictShareType
  marketAddress: string
  sharing?: boolean
  /** 是否展示 Blink 封面图上传（世界杯事件预测走硬编码图标，无需上传） */
  allowBlinkLogo?: boolean
}>(), { allowBlinkLogo: true })

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [text: string, blinkLogo: string]
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

const { uploading, completedImgUrl, addUploadImg, compressImage } = useUploadImg()

const resetEditor = () => {
  contentEl.value = ''
  showClear.value = false
  tweetLength.value = 0
  completedImgUrl.value = ''
  if (contentRef.value) {
    contentRef.value.innerHTML = ''
  }
}

watch(() => props.show, (visible) => {
  if (visible) resetEditor()
})

const close = () => emit('update:show', false)

// 上传用户选择的图片（不裁剪，仅等比压缩以控制体积），复用创建代币的上传服务
const onUpload = async (options: any) => {
  const file = options.file as File
  if (!file.type.startsWith('image/')) {
    notify({ message: 'Please select an image', type: 'error' })
    return
  }
  uploading.value = true
  try {
    const compressed = await compressImage(file, 0.5, 600)
    completedImgUrl.value = await addUploadImg(compressed)
  } catch (e) {
    notify({ message: 'Upload fail, please retry', type: 'error' })
  } finally {
    uploading.value = false
  }
}

const removeImg = () => {
  completedImgUrl.value = ''
}

const onConfirm = () => {
  if (leftWordsLength.value < 0 || props.sharing) return
  const text = contentRef.value ? formatElToTextContent(contentRef.value).trim() : ''
  emit('confirm', text, completedImgUrl.value)
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

      <!-- Blink 封面图（可选） -->
      <div v-if="allowBlinkLogo" class="px-2">
        <div class="text-sm text-gray-600 mb-1">Blink cover image (optional)</div>
        <div class="flex items-center gap-3">
          <el-upload
            action="#"
            :http-request="onUpload"
            :show-file-list="false"
            accept="image/*"
          >
            <div
              class="w-16 h-16 rounded-xl border border-dashed border-grey-e6 flex items-center justify-center cursor-pointer hover:border-orange-normal transition-colors overflow-hidden"
            >
              <img v-if="completedImgUrl" :src="completedImgUrl" class="w-full h-full object-cover" alt="" />
              <i-ep-loading v-else-if="uploading" class="animate-spin text-gray-400 text-xl" />
              <i-ep-plus v-else class="text-gray-400 text-xl" />
            </div>
          </el-upload>
          <div v-if="completedImgUrl" class="flex flex-col gap-1">
            <span class="text-xs text-gray-500">Cover uploaded</span>
            <button class="text-xs text-red-e6 w-fit" @click="removeImg">Remove</button>
          </div>
          <span v-else-if="!uploading" class="text-xs text-gray-400">Defaults to the community logo</span>
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
          :disabled="sharing || uploading || leftWordsLength < 0"
          @click="onConfirm"
        >
          <span class="text-white font-bold text-lg">{{ sharing ? 'Posting...' : 'Post' }}</span>
          <i-ep-loading v-if="sharing" class="animate-spin text-white" />
        </button>
      </div>
    </div>
  </el-dialog>
</template>
