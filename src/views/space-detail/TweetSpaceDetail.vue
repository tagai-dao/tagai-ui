<script setup lang="ts">

import BackHeader from "@/layout/BackHeader.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import Comments from "@/components/tweets/Comments.vue";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import SpaceCurateList from "@/components/tweets/SpaceCurateList.vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCurationStore } from "@/stores/curation";
import { useAccountStore } from "@/stores/web3";
import { getTweetById } from "@/apis/api";
import { getTokenInfoOfTweets } from "@/utils/pump";
import { formatAmount, formatPrice } from "@/utils/helper";
import SpaceSpeaker from "@/components/tweets/SpaceSpeaker.vue";
import { useStateStore } from "@/stores/common";

enum CurationType {
  Curate,
  Host,
  CoHost,
  Speaker
}
const curatorsModalVisible = ref(false)
const curationType = ref(CurationType.Curate)
const router = useRouter()
const route = useRoute()


const curationStore = useCurationStore()
const accStore = useAccountStore()

const everyCurationAmount = computed(() => {
  return(curationStore.currentSelectedTweet?.amount ?? 0) / 4
})

const tag = computed(() => {
  return curationStore.currentSelectedTweet?.tick
})

onMounted(async () => {
  const tweetId = route.params.id;
    if (typeof(tweetId) !== 'string') {
      router.replace('/')
      return;
    }
    if (curationStore.currentSelectedTweet?.tweetId != tweetId){
      curationStore.currentSelectedTweet = null
    }
    curationStore.currentSelectedTweet = await getTweetById(tweetId, accStore.getAccountInfo?.twitterId) as any
    if (!curationStore.currentSelectedTweet) return
  if (!curationStore.currentSelectedTweet.spaceId) {
    router.replace('/post-detail/' + tweetId)
  }
  let ts = await getTokenInfoOfTweets([curationStore.currentSelectedTweet!])
  curationStore.currentSelectedTweet = ts[0]
})

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">
          {{ curationStore?.currentSelectedTweet?.tick }}
        </div>
      </template>
    </BackHeader>
    <div class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2" id="comment-list-scroller">
      <!-- <div class="flex items-center gap-2">
        <div class="w-4 h-4 bg-green-normal rounded-full"></div>
        <div class="text-base flex-1">
          #{{ tweet.tick }} • Market cap
        </div>
        <button class="bg-yellow-fa h-8 px-3 rounded-full text-sm">
          Buy $trump
        </button>
      </div> -->
      <div v-if="curationStore.currentSelectedTweet" class="bg-white rounded-2xl py-2">
        <SpaceItem :tweet="curationStore.currentSelectedTweet" :multiline="true">
          <template #tweet-action-bar>
            <PostButtonGroup :tweet="curationStore.currentSelectedTweet"/>
          </template>
        </SpaceItem>
      </div>
      <div v-if="curationStore.currentSelectedTweet?.state != 4" class="bg-white rounded-2xl py-4 px-3 flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <div class="text-base flex-1 text-h5">
            {{$t('postView.rewards')}}
          </div>
          <button class="h-6 px-3 text-sm rounded-lg"
                  :class="curationStore.currentSelectedTweet?.isSettled?'bg-grey-light-hover':'bg-yellow-fa'">
            {{ curationStore.currentSelectedTweet?.isSettled ? $t('postView.settled') : $t('postView.onCuration') }}
          </button>
        </div>
        <div class="h-12 rounded-xl bg-grey-normal px-3 text-white font-medium flex justify-center items-center">
          {{ curationStore.currentSelectedTweet?.amount }} #{{ tag }} ({{ formatPrice((curationStore.currentSelectedTweet?.amount ?? 0) * (curationStore.currentSelectedTweet?.price ?? 0) * useStateStore().ethPrice) }})
        </div>
        <div class="grid grid-cols-2 gap-y-2 gap-x-1">
          <div class="col-span-1 bg-yellow-fa rounded-xl px-3 py-3 flex gap-2"
            @click="curationType = CurationType.Curate; curatorsModalVisible = true">
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">{{$t('curation.curation')}}</div>
                <span>{{ curationStore.currentSelectedTweet?.spaceCurateCount ?? 0 }}</span>
              </div>
              <div class="flex justify-between items-center gap-1">
                <div class="text-h5 flex-1 truncate">{{ formatAmount(everyCurationAmount) }} #{{ tag }}</div>
                <button>
                  <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
                </button>
              </div>
            </div>
          </div>
          <div class="col-span-1 bg-green-b6 rounded-xl px-3 py-3 flex gap-2"
              @click="curationType = CurationType.Host; curatorsModalVisible = true">
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">{{ $t('postView.host') }}</div>
                <span>{{ curationStore.currentSelectedTweet?.hostIds ? 1 : 0 }}</span>
              </div>
              <div class="flex justify-between items-center gap-1">
                <div class="text-h5 flex-1 truncate">{{ formatAmount(everyCurationAmount) }} #{{ tag }}</div>
                <button>
                  <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
                </button>
              </div>
            </div>
          </div>
          <div class="col-span-1 bg-purple-c1 rounded-xl px-3 py-3 flex gap-2"
          @click="curationType = CurationType.CoHost; curatorsModalVisible = true">
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">{{ $t('postView.co-host') }}</div>
                <span>{{ curationStore.currentSelectedTweet?.hostIds ? JSON.parse(curationStore.currentSelectedTweet?.hostIds).length - 1 : 0 }}</span>
              </div>
              <div class="flex justify-between items-center gap-1">
                <div class="text-h5 flex-1 truncate">{{ formatAmount(everyCurationAmount) }} #{{ tag }}</div>
                <button>
                  <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
                </button>
              </div>
            </div>
          </div>
          <div class="col-span-1 cursor-pointer bg-red-ff rounded-xl px-3 py-3 flex gap-2"
          @click="curationType = CurationType.Speaker; curatorsModalVisible = true">
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">{{ $t('postView.speaker') }}</div>
                <span>{{ curationStore.currentSelectedTweet?.speakerIds ? JSON.parse(curationStore.currentSelectedTweet?.speakerIds).length : 0 }}</span>
              </div>
              <div class="flex justify-between items-center gap-1">
                <div class="text-h5 flex-1 truncate">{{ formatAmount(everyCurationAmount) }} #{{ tag }}</div>
                <button>
                  <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- <div class="flex justify-center gap-10">
          <button class="bg-green-normal h-9 rounded-full px-3 flex items-center justify-center gap-2">
            <span class="text-h5">Curator</span>
            <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
          </button>
          <button class="bg-yellow-fa h-9 rounded-full px-3 flex items-center justify-center gap-2">
            <span class="text-h5">Space</span>
            <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
          </button>
        </div> -->
      </div>
      <div class="text-h5 mt-2 px-3">{{ $t('postView.spaceComments') }}</div>
      <Comments/>
    </div>
    <el-dialog v-model="curatorsModalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px] bg-grey-f4"
               width="90%" :show-close="false" align-center destroy-on-close>
      <SpaceCurateList v-if="curationType === CurationType.Curate"
                       :tweet="curationStore.currentSelectedTweet!"/>
      <SpaceSpeaker v-else :tweet="curationStore.currentSelectedTweet!" :curation-type="curationType as number"/>
    </el-dialog>
</div>
</template>

<style scoped>

</style>
