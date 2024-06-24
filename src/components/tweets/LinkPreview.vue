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
  <div class="text-left border-[1px] border-grey-light-hover rounded-xl overflow-hidden md:max-w-[35rem]"
       :class="imgPosition==='left'?'flex':''">
    <template v-if="imgPosition==='left'">
      <div class="flex-0.3 img-left-box">
        <img :src="linkPreviewInfo.images && linkPreviewInfo.images[0]" alt="">
      </div>
      <div class=" w-1px bg-colorA6/30"></div>
    </template>
    <img v-else class="w-full object-cover" :src="linkPreviewInfo.images && linkPreviewInfo.images[0]" alt="">
    <div class="flex-1 px-1rem py-0.5rem text-14px leading-24px 2xl:text-0.9rem 2xl:leading-1.8rem text-colorA6 light:text-blueDark overflow-hidden">
      <div class="h-full flex flex-col justify-center">
        <div class="">{{getUrlHost(linkPreviewInfo.url)}}</div>
        <div class="c-text-black text-white light:text-black overflow-hidden overflow-ellipsis whitespace-nowrap">
          {{linkPreviewInfo.title}}
        </div>
        <div class="text-line-3">{{linkPreviewInfo.description}}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.text-line-3 {
  word-break: break-word;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}
.img-left-box {
  overflow: hidden;
  width: 30%;
  padding-top: 30%;
  position: relative;
  img {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
