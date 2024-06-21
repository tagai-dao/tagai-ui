<script setup lang="ts">
import { computed, defineProps, onMounted, ref, withDefaults } from 'vue'
import { IgnoreAuthor } from '@/config'
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { parseTimestamp } from '@/utils/helper';
import { useRouter } from 'vue-router';
// import { buildAssetId } from '@/utils/eth/ipShare'
import UserAvatar from "@/components/common/UserAvatar.vue";
import LinkPreview from "@/components/tweets/LinkPreview.vue";
import QuoteTweet from "@/components/tweets/QuoteTweet.vue";
import {useTweet} from "@/composables/useTweet";

const props = withDefaults(defineProps<{
  tweet: any
}>(), {
  tweet: () => {}
})

const {formatEmojiText} = useTweet()

const blogRef = ref()
const imgurls = ref([])
const links = ref([])
const imgViewDialog = ref(false)
const imgIndex = ref(0)
const urlreg = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g
const reg = /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g
const router = useRouter()

const profileImg = computed(() => {
  if (!props.tweet.profile) return null
  return props.tweet.profile?.replace('nomal', '200x200')
})

const isIgnoreAccount = computed(() => {
  return IgnoreAuthor.indexOf(props.tweet.twitterId) > 0
})

const content = computed(() => {
  let content = props.tweet.content?.replace(reg, '');
  for (let url of links.value) {
    content = content.replace(url, `<span data-url="${url}" class="underline text-14px break-words px-2px">${url}</span>`)
  }
  return content;
})

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

const steemUrl = computed(() => {
  return `https://steemit.com/wormhole3/@${props.tweet.steemId}/${props.tweet.tweetId}`
})

function gotoBitip() {
  // router.push('/ipshare/' + buildAssetId(2n, BigInt(props.tweet.bitip)).toString())
}

function replaceEmptyImg(e: any) {
  e.target.src = emptyAvatar
}

function gotoTweet(e: any) {
  e.stopPropagation();
  window.open(`https://twitter.com/${props.tweet.twitterUsername}/status/${props.tweet.tweetId}`)
}

function clickContent(e: any) {
  if (e.target.dataset.url) {
    window.open(e.target.dataset.url, '_blank')
  } else {
    blogRef.value.click()
  }
}

function clickLinkView() {
  try {
    const info = JSON.parse(props.tweet.pageInfo)
    window.open(info.url, '__blank')
  } catch (e) {

  }
}

function clickRetweetView() {
  try {
    const info = JSON.parse(props.tweet.retweetInfo);
    window.open(`https://twitter.com/${info.author.username}/status/${info.id}`)
  } catch (e) {

  }
}

onMounted(() => {
  if (!props.tweet.content) return;
  const urls = props.tweet.content.replace(' ', '').replace('\r', '').replace('\t', '').match(urlreg)
  imgurls.value = props.tweet.content.replace(' ', '').replace('\r', '').replace('\t', '').match(reg)
  if (urls && imgurls.value) {
    // @ts-ignore
    links.value = urls.filter(u => imgurls.value.indexOf(u) < 0)
  } else if (urls) {
    links.value = urls
  }
  // @ts-ignore
  imgurls.value = imgurls.value?.map(u => 'https://steemitimages.com/0x0/' + u)
})
</script>

<template>
  <div ref="blogRef">
    <div class="bg-gray-fc rounded-2xl p-3">
      <div class="flex gap-2 items-stretch">
        <UserAvatar :profile-img="profileImg" :name="tweet.twitterName" :username="tweet.twitterUsername"
                    :btc-address="tweet.btcAddress" :eth-address="tweet.ethAddress" :bitip="tweet.bitip"
                    :steem-id="tweet.steemId" :teleported="true" @gotoBitip="gotoBitip">
          <template #avatar-img>
            <img v-if="profileImg"
                 class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
                 @click.stop="gotoBitip" @error="replaceEmptyImg" :src="profileImg"
                 alt="">
            <img v-else
                 class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
                 @click.stop="gotoBitip" src="~@/assets/icons/icon-default-avatar.svg" alt="">
          </template>
        </UserAvatar>
        <div class="flex-1">
          <div class="w-full flex items-center flex-wrap gap-x-2">
            <a class="font-bold text-lg"
               @click.stop="gotoBitip()">{{ tweet.twitterUsername }}</a>
            <span class="mx-4px"> · </span>
            <button @click="gotoTweet($event)">
              <img class="w-4 h-4" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
          <div class="text-sm text-gray-8C flex gap-4">
            <span>@{{tweet.twitterName}}</span>
            <span>{{ parseTimestamp(tweet.postTime) }}</span>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-hidden flex flex-col gap-2">
        <div @click.stop="clickContent"
             class="cursor-pointer text-base xl:text-lg tracking-0.2 pl-12">
          <a v-if="isIgnoreAccount" :href="steemUrl" class="text-blue-500 break-all" target="_blank">{{''}}</a>
          <div class="whitespace-pre-line break-words multi-content multi-content-2"
               v-else v-html="formatEmojiText(content)"></div>
        </div>
        <!--       foreign page -->
        <LinkPreview @click.stop="clickLinkView()" class="cursor-pointer"
                     v-if="showPageInfo && !isIgnoreAccount" :pageInfo="tweet.pageInfo" />
        <!--       retweet  -->
        <QuoteTweet class="mt-10px" @click.stop="clickRetweetView()"
                    v-if="tweet.retweetInfo && tweet.retweetInfo.length > 10 && !isIgnoreAccount"
                    :retweetInfo="tweet.retweetInfo"  is-reply/>

        <!--img-1, img-2, img-3, img-4 -->
        <div class="grid md:max-w-[35rem] overflow-hidden border-[1px] border-gray-e5 rounded-3xl "
             :class="`img-` + (imgurls.length % 5)" v-if="!isIgnoreAccount && imgurls && imgurls.length > 0">
          <div class="img-box" v-for="(url, index) of imgurls.slice(0, 4)" :key="url">
            <img :src="url" alt="">
          </div>
        </div>
        <slot name="tweet-mint"></slot>
        <slot name="tweet-action-bar"></slot>
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
