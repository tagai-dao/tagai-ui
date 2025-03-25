<script setup lang="ts">
import {computed, onMounted, onUnmounted, type PropType, ref, watch} from 'vue'
import { formatAmount, formatPrice, parseTimestamp } from '@/utils/helper';
// import { buildAssetId } from '@/utils/eth/ipShare'
import UserAvatar from "@/components/common/UserAvatar.vue";
import LinkPreview from "@/components/tweets/LinkPreview.vue";
import QuoteTweet from "@/components/tweets/QuoteTweet.vue";
import {useTweet} from "@/composables/useTweet";
import {usePost} from "@/composables/usePost";
import type {Tweet} from "@/types";
import {tagBgColors, tagTextColors} from "@/composables/useTags";
import { useStateStore } from '@/stores/common';

const video = ref();
let observer: any = null

const props = defineProps({
  tweet: {type: Object as PropType<Tweet>, required: true,},
  multiline: {type: Boolean, required: false}
})

const {formatEmojiText} = useTweet()
const {
  blogRef,
  profileImg,
  imgurls,
  content,
  isIgnoreAccount,
  steemUrl,
  replaceEmptyImg,
  gotoTweet,
  clickContent,
  clickLinkView,
  clickRetweetView
} = usePost(props.tweet)

const showPageInfo = computed(() => {
  if (props.tweet.pageInfo && props.tweet.pageInfo.length > 10) {
    try {
      const page = JSON.parse(props.tweet.pageInfo)
      if (page && page.url && page.url.startsWith(`https://${window.document.location.host}`)) {
        return false
      }
    } catch (e) {

    }
    return true
  }
})

const onUserAvatar = () => {

}

onMounted(() => {
  if (props.tweet.videoLink){
    observer = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                      // @ts-ignore
                      entry.target.play();
                  }else {
                      // @ts-ignore
                      entry.target.pause();
                  }
              })
          }, {
              threshold: 0.75
          })

    observer.observe(video.value);
  }
})

onUnmounted(() => {
  observer?.disconnect();
})

</script>

<template>
  <div ref="blogRef">
    <div class="bg-gray-fc rounded-2xl py-4 px-3">
      <div class="flex gap-2 items-stretch">
        <UserAvatar :profile-img="profileImg" :name="tweet.twitterName" :username="tweet.twitterUsername"
                    :followers="tweet.followers" :followings="tweet.followings"
                    :eth-addr="tweet.ethAddr" :twitter-id="tweet.twitterId"
                    :steem-id="tweet.steemId" :teleported="true" :credit="tweet.credit">
          <template #avatar-img>
            <img v-if="profileImg"
                 class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
                 @click.stop="onUserAvatar" @error="replaceEmptyImg" :src="profileImg"
                 alt="">
            <img v-else
                 class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
                 @click.stop="onUserAvatar" src="~@/assets/icons/icon-default-avatar.svg" alt="">
          </template>
        </UserAvatar>
        <div class="flex-1">
          <div class="w-full flex items-center flex-wrap gap-x-2">
            <a class="font-bold text-lg"
               @click.stop="onUserAvatar()">{{ tweet.twitterName }}</a>
            <span class="mx-4px"> · </span>
            <button @click="gotoTweet($event)">
              <img class="w-4 h-4" src="~@/assets/icons/icon-x.svg" alt="">
            </button>

            <img v-if="tweet.twitterId == '1846600810719072256'" class="w-12 h-12 -ml-2" src="~@/assets/icons/icon-ai.svg" alt="">
          </div>
          <div class="text-sm italic text-grey-bd flex flex-wrap gap-x-4 gap-y-1">
            <span>@{{tweet.twitterUsername}}</span>
            <span>{{ parseTimestamp(tweet.tweetTime) }}</span>
          </div>
        </div>
        <el-popover v-if="tweet.amount" popper-class="c-arrow-popper rounded-sm" position="end"
                    trigger="click" :teleported="true" :persistent="false">
          <template #reference>
            <button @click.stop class="h-6 rounded-full px-3 text-white text-sm font-semibold"
                    :class="tweet.isSettled?'bg-grey-light-active':'bg-gradient-primary'">
              {{ formatPrice((tweet.price ?? 0) * useStateStore().ethPrice * (tweet.amount ?? 0)) }}
            </button>
          </template>
          <template #default>
            <div class="text-grey-normal text-sm px-2">
              <div class="flex justify-between items-center h-7 gap-3">
                <span class="whitespace-nowrap">{{ $t('postView.author') }}</span>
                <span class="font-semibold whitespace-nowrap">{{ formatAmount(tweet.authorAmount) }}({{ formatPrice((tweet.authorAmount ?? 0) * (tweet.price ?? 0) * useStateStore().ethPrice) }})</span>
              </div>
              <div class="flex justify-between items-center h-7 border-t-[0.5px] border-b-[0.5px] border-grey-6f/10 gap-3">
                <span class="whitespace-nowrap">{{$t('postView.curator')}}</span>
                <span class="font-semibold whitespace-nowrap">{{ formatAmount(tweet.curateAmount) }} ({{ formatPrice(((tweet.curateAmount ?? 0)) * (tweet.price ?? 0) * useStateStore().ethPrice) }})</span>
              </div>
              <div v-if="!tweet.listed" class="flex justify-between items-center h-7 gap-3">
                {{ $t('postView.pendingList') }}
              </div>
              <div v-else class="flex justify-between items-center h-7">
                <span class="whitespace-nowrap">{{ $t('postView.endTime') }}:</span>
                <span class="font-semibold whitespace-nowrap">{{ parseTimestamp(new Date((tweet.dayNumber + 3) * 86400000)) }}</span>
              </div>
            </div>
          </template>
        </el-popover>

      </div>
      <div class="flex-1 overflow-hidden flex flex-col gap-3 mt-3">
        <div class="pl-12">
          <div @click.stop="clickContent"
               class="cursor-pointer text-base tracking-0.2">
            <a v-if="isIgnoreAccount" :href="steemUrl" class="text-blue-500 break-all" target="_blank">{{''}}</a>
            <div class="whitespace-pre-line break-words content" :class="multiline ? '' : 'multi-content-3'"
                 v-else v-html="formatEmojiText(content)"></div>
          </div>
          <div class="flex flex-wrap gap-4 mt-1" v-if="tweet.tags">
            <button v-for="(tag, index) of JSON.parse(tweet.tags!)" :key="tag"
                    :style="{backgroundColor: tagBgColors[index], color: tagTextColors[index]}"
                    class="px-2 text-base rounded-md">#{{ tag }}</button>
          </div>
        </div>
        <div v-if="tweet.videoLink" class="pl-12">
            <video ref="video" controls loop playsinline webkit-playsinline muted :src="tweet.videoLink"></video>
        </div>
        <div class="px-3 md:pl-12">
          <!--       foreign page -->
          <LinkPreview @click.stop="clickLinkView()" class="cursor-pointer"
                       v-if="showPageInfo && !isIgnoreAccount" :pageInfo="tweet.pageInfo ?? ''" />
          <!--       retweet  -->
          <QuoteTweet class="mt-10px" @click.stop="clickRetweetView()"
                      v-if="tweet.retweetInfo && tweet.retweetInfo.length > 10 && !isIgnoreAccount"
                      :retweetInfo="tweet.retweetInfo"  is-reply/>
          <!--img-1, img-2, img-3, img-4 -->
          <div class="grid md:max-w-[35rem] h-[132px] md:h-auto overflow-hidden border-[1px] border-grey-light-hover rounded-2xl "
               :class="`img-` + (imgurls.length % 5)" v-if="!isIgnoreAccount && imgurls && imgurls.length > 0">
            <el-image v-for="(url, index) of imgurls.slice(0, 4)" :key="url"
                      class="max-h-[300px]"
                      @click.stop
                      :src="imgurls[index]"
                      :zoom-rate="1.2"
                      :max-scale="7"
                      :min-scale="0.2"
                      :preview-src-list="imgurls.slice(0, 4)"
                      :initial-index="index"
                      fit="cover"/>
          </div>
          <slot name="tweet-trade"></slot>
          <slot name="tweet-mint"></slot>
          <slot name="tweet-action-bar"></slot>
        </div>
      </div>
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
