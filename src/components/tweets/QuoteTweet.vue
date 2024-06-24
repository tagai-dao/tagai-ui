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
let reg = /a/
const tweet = ref<any>({})
let urlreg = /a/;

function replaceEmptyImg(e: any) {
    e.target.src = emptyAvatar;
}

onMounted(() => {
    tweet.value = JSON.parse(props.retweetInfo)
    urlreg = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g
    reg = /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g
    // @ts-ignore
    const urlsTem = tweet.text.replace(' ', '').replace('\r', '').replace('\t', '').match(urlreg)
    allurls.value = urlsTem
    // @ts-ignore
    imgurls.value = tweet.text.replace(' ', '').replace('\r', '').replace('\t', '').match(reg)

    if (urls && imgurls.value) {
        // @ts-ignore
        urls.value = urlsTem.filter((u: string) => imgurls.value.indexOf(u) < 0)
    } else if (urls.value) {
        urls.value = urlsTem
    }
})

</script>

<template>
  <div class="border-1 border-color2A bg-color12 rounded-12px overflow-hidden md:max-w-35rem">
    <div v-if="tweet && tweet.author">
      <div class="p-0.6rem">
        <div class="flex items-center">
          <img v-if="tweet && tweet.author && tweet.author.profile_image_url"
               class="w-2rem h-2rem md:mr-1rem mr-0.8rem rounded-full gradient-border border-2px cursor-pointer"
               @error="replaceEmptyImg" :src="tweet.author.profile_image_url" alt="">
          <img class="w-2rem h-2rem md:mr-1rem mr-0.8rem rounded-full gradient-border border-2px"
               src="@/assets/icons/icon-default-avatar.svg" v-else alt="">
          <div class="flex-1 flex flex-col items-start">
            <div class="flex items-center flex-wrap  text-0.8rem">
              <a class="c-text-black text-left leading-1.1rem mr-3 light:text-blueDark">{{
                  tweet.author.name }}</a>
              <!-- <img class="w-1rem h-1rem mx-0.5rem" src="~@/assets/icon-checked.svg" alt=""> -->
              <span class="text-grey-bd">@{{ tweet.author.username }}</span>
            </div>
            <span
                class="whitespace-nowrap overflow-ellipsis overflow-x-hidden text-grey-bd text-0.7rem leading-1.5rem">
                            {{ parseTimestamp(tweet.createdAt) }}
                        </span>
          </div>
        </div>
        <div class="overflow-x-hidden">
          <div class="text-left font-400 mt-0.5rem">
            <p class="cursor-pointer text-12px leading-16px 2xl:text-14px 2xl:leading-18px
                      text-colorA6 light:text-blueDark whitespace-pre-line">
              {{ tweet.text }}
            </p>
          </div>
        </div>
      </div>
      <div class="grid mt-10px" :class="`img-` + (imgurls.length % 5)" v-if="imgurls && imgurls.length > 0">
        <div class="img-box" v-for="(url, index) of imgurls.slice(0, 4)" :key="url">
          <img :src="url" alt="">
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.img-box {
    overflow: hidden;
    width: 100%;
    padding-top: 57%;
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

.blog-tag {
    border-radius: 0.4rem;
    padding: .2rem .5rem 0.2rem 0.8rem;
    border: 1px solid #434343;
    background-color: rgba(white, .1);
    background-image: linear-gradient(to bottom, var(--gradient-primary-color1), var(--gradient-primary-color2));
    background-size: 0.3rem 100%;
    background-repeat: no-repeat;
}

@media (max-width: 500px) {
    .img-3 {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);

        :nth-child(2) {
            grid-column: 2 / 2;
            grid-row: 1 / 3;
        }
    }
}
</style>
