<script setup lang="ts">
import { onMounted, ref } from 'vue'
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { parseTimestamp } from '@/utils/helper';

const props = defineProps<{
    retweetInfo: string,
    isReply: boolean
}>()
const urls = ref([])
const imgurls = ref([])
const allurls = ref([])
const tweet = ref<any>({})

function replaceEmptyImg(e: any) {
    e.target.src = emptyAvatar;
}

onMounted(() => {
  tweet.value = JSON.parse(props.retweetInfo)
  if (!tweet.value.text) return;
  const urlreg = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g
  const reg = /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g
  const urlsTem = tweet.value.text.replace(' ', '').replace('\r', '').replace('\t', '').match(urlreg)
  allurls.value = urlsTem
  imgurls.value = tweet.value.images
  if (urls && imgurls.value) {
    // @ts-ignore
      urls.value = urlsTem.filter((u: string) => imgurls.value.indexOf(u) < 0)
  } else if (urls.value) {
      urls.value = urlsTem
  }
})

</script>

<template>
  <div v-if="tweet && tweet.author"
       class="border-[1px] border-grey-c9 bg-white rounded-2xl overflow-hidden md:max-w-[35rem]">
    <div class="p-3">
      <div class="flex gap-2 items-stretch">
        <img v-if="tweet && tweet.author && tweet.author.profile_image_url"
             class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             @error="replaceEmptyImg" :src="tweet.author.profile_image_url" alt="">
        <img class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             src="@/assets/icons/icon-default-avatar.svg" v-else alt="">
        <div class="flex-1">
          <div class="w-full flex items-center flex-wrap gap-x-2">
            <span class="font-bold text-lg">{{ tweet.author.name }}</span>
            <span class="text-sm">@{{tweet.author.username}}</span>
          </div>
          <div class="text-sm italic text-grey-bd flex flex-wrap gap-x-4 gap-y-1">
            <span>{{ parseTimestamp(tweet.createdAt) }}</span>
          </div>
        </div>
      </div>
      <div class="whitespace-pre-line break-words text-base mt-2 text-grey-3f/90 multi-content multi-content-2">
        {{ tweet.text }}
      </div>
    </div>
    <div class="grid mt-10px"
         :class="`img-` + (imgurls.length % 5)"
         v-if="imgurls && imgurls.length > 0" @click.stop>
      <el-image v-for="(url, index) of imgurls.slice(0, 4)" :key="url"
                :src="imgurls[index]"
                :zoom-rate="1.2"
                :max-scale="7"
                :min-scale="0.2"
                :preview-src-list="imgurls.slice(0, 4)"
                :initial-index="index"
                fit="cover"/>
    </div>
  </div>
</template>

<style scoped>
.img-1 {
    grid-template-columns: repeat(1, 1fr);
}

.img-2 {
    grid-template-columns: repeat(2, 1fr);
    gap: 2px;
}

.img-3 {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 2px;

    :nth-child(2) {
        grid-column: 2 / 2;
        grid-row: 1 / 3;
    }
}

.img-4 {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 2px;
}
</style>
