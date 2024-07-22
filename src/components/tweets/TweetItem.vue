<script setup lang="ts">
import {computed, defineProps, onMounted, type PropType, ref, withDefaults} from 'vue'
import { IgnoreAuthor } from '@/config'
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { formatPrice, parseTimestamp } from '@/utils/helper';
import { useRouter } from 'vue-router';
// import { buildAssetId } from '@/utils/eth/ipShare'
import UserAvatar from "@/components/common/UserAvatar.vue";
import LinkPreview from "@/components/tweets/LinkPreview.vue";
import QuoteTweet from "@/components/tweets/QuoteTweet.vue";
import {useTweet} from "@/composables/useTweet";
import TweetSpaceCard from "@/components/tweets/TweetSpaceCard.vue";
import {usePost} from "@/composables/usePost";
import type {Tweet} from "@/types";
import {tagBgColors, tagTextColors} from "@/composables/useTags";

const props = defineProps({
  tweet: {type: Object as PropType<Tweet>, required: true,}
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

</script>

<template>
  <div ref="blogRef">
    <div class="bg-gray-fc rounded-2xl py-4 px-3">
      <div class="flex gap-2 items-stretch">
        <UserAvatar :profile-img="profileImg" :name="tweet.twitterName" :username="tweet.twitterUsername"
                    :eth-addr="tweet.ethAddr"
                    :steem-id="tweet.steemId" :teleported="true">
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
          </div>
          <div class="text-sm italic text-grey-bd flex flex-wrap gap-x-4 gap-y-1">
            <span>@{{tweet.twitterUsername}}</span>
            <span>{{ parseTimestamp(tweet.tweetTime) }}</span>
          </div>
        </div>
        <button v-if="tweet.amount" class="h-6 rounded-full px-3 text-white text-sm font-semibold"
        :class="tweet.isSettled?'bg-grey-light-active':'bg-gradient-primary'">
          {{ formatPrice((tweet.price ?? 0) * (tweet.amount ?? 0)) }}
        </button>
      </div>
      <div class="flex-1 overflow-hidden flex flex-col gap-3 mt-3">
        <div class="pl-12">
          <div @click.stop="clickContent"
               class="cursor-pointer text-base tracking-0.2">
            <a v-if="isIgnoreAccount" :href="steemUrl" class="text-blue-500 break-all" target="_blank">{{''}}</a>
            <div class="whitespace-pre-line break-words multi-content multi-content-2"
                 v-else v-html="formatEmojiText(content)"></div>
          </div>
          <div class="flex flex-wrap gap-4 mt-1" v-if="tweet.tags">
            <button v-for="(tag, index) of JSON.parse(tweet.tags!)" :key="tag"
                    :style="{backgroundColor: tagBgColors[index], color: tagTextColors[index]}"
                    class="px-2 text-base rounded-md">#{{ tag }}</button>
          </div>
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
