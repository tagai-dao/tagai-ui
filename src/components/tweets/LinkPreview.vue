<script setup lang="ts">
import { onMounted, ref } from 'vue'
const props = withDefaults(defineProps<{
  pageInfo: string
}>(), {
  pageInfo: '{}'
})

const linkPreviewInfo = ref<any>({})
const imgPosition = ref('top')
const loading = ref(true)

function getImgSize(imgUrl: string) {
  const img = new Image()
  img.src = imgUrl
  img.onload = () => {
    if (img.height/ img.width > 0.8) {
      imgPosition.value = 'left'
    }
  }
}

function getUrlHost(link: string) {
  try {
    const url = new URL(link)
    return url.host.toLowerCase() || ''
  } catch (e) {
    return link
  }
}

onMounted(() => {
  linkPreviewInfo.value = JSON.parse(props.pageInfo)
  if (linkPreviewInfo.value.images) {
    getImgSize(linkPreviewInfo.value.images[0])
  }
})
</script>

<template>
  <div class="border-[1px] border-grey-c9 bg-white rounded-2xl overflow-hidden md:max-w-[35rem]"
       :class="imgPosition==='left'?'flex':''">
    <template v-if="imgPosition==='left'">
      <div class="flex-0.3 img-left-box">
        <img :src="linkPreviewInfo.images && linkPreviewInfo.images[0]" alt="">
      </div>
      <div class=" w-1px bg-colorA6/30"></div>
    </template>
    <img v-else class="w-full object-cover max-h-[140px] md:max-h-[240px]"
         :src="linkPreviewInfo.images && linkPreviewInfo.images[0]" alt="">
    <div class="p-3">
      <div class="h-full flex flex-col justify-center gap-1">
        <div class="text-grey-normal">{{getUrlHost(linkPreviewInfo.url)}}</div>
        <div class="truncate text-h3">
          {{linkPreviewInfo.title}}
        </div>
        <div class="multi-content multi-content-2 text-h4">{{linkPreviewInfo.description}}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
</style>
