<script setup lang="ts">
import { useAccount } from "@/composables/useAccount";
import { useAccountStore } from "@/stores/web3";
import type { SocialMessage } from "@/types";
import { parseTimestamp, formatDate } from "@/utils/helper";
import { onMounted, onUnmounted, ref, computed } from "vue";

const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);
const { getMessages, setMessageReaded } = useAccount();
const onLoad = () => {
  loading.value = false;
  finished.value = true;
};

const onRefresh = () => {
  finished.value = true;
  refreshing.value = false;
};

function unread(message: SocialMessage) {
  return formatDate(message.operateTime) > (useAccountStore().getAccountInfo.lastReadMessageTime as string)
}

function updatedProfile(profile: string) {
  return profile?.replace("normal", "200x200");
}

onMounted(() => {
  getMessages();
});

onUnmounted(() => {
  setMessageReaded().catch(console.error)
  useAccountStore().unreadMessageCount = 0
})
</script>

<template>
  <van-pull-refresh
    v-model="refreshing"
    @refresh="onRefresh"
    :loading-text="$t('loading')"
    :lpulling-text="$t('pullToRefreshData')"
    :loosing-text="$t('releaseToRefresh')"
  >
    <van-list
      :loading="loading"
      :finished="finished"
      :immediate-check="false"
      :finished-text="$t('noMore')"
      :offset="50"
      @load="onLoad"
    >
      <div v-if="useAccountStore().socialMessages.length == 0"
           class="text-grey-light-active text-center">{{$t('notificationView.noMsg')}}</div>
      <!-- 1quote 2like 3retweet 4reply -->
      <div class="relative" @click="$router.push('/post-detail/' + message.tweetId)" v-else
           v-for="(message, i) of useAccountStore().socialMessages" :key="i">
<!--        unread-->
        <div v-if="unread(message)" class="w-3 min-w-3 h-3 min-h-3 rounded-full absolute right-4 top-4 bg-red-normal"></div>
        <!-- quote -->
        <div v-if="message.type === 1" class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
          <img
            class="h-6 w-6 min-h-6 rounded-full"
            :src="updatedProfile(message.profile)"
            alt=""
          />
          <div class="flex-1 flex-col gap-1.5">
            <div class="flex items-center gap-1 text-grey-8d leading-5 text-lg">
              <span>@{{ message.twitterUsername }}</span>
              <span> · </span>
              <span>{{ parseTimestamp(message.operateTime) }}</span>
            </div>
            <div class="text-base">{{$t('notificationView.quoteTweet')}}</div>
            <div class="text-base">{{ message.content }}</div>
          </div>
        </div>
        <!--reply-->
        <div v-if="message.type === 4" class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
          <img
            class="h-6 w-6 min-h-6 rounded-full"
            :src="updatedProfile(message.profile)"
            alt=""
          />
          <div class="flex-1 flex-col gap-1.5">
            <div class="flex items-center gap-1 leading-5 text-lg">
              <span>{{ message.twitterName }}</span>
              <span class="text-grey-bd">@{{ message.twitterUsername }}</span>
              <span> · </span>
              <span>{{ parseTimestamp(message.operateTime) }}</span>
            </div>
            <div class="text-base text-grey-bd">{{$t('notificationView.replyTweet')}}</div>
            <div class="text-base mt-2">{{ message.content }}</div>
          </div>
        </div>
        <!--like-->
        <div v-if="message.type === 2" class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
          <div class="px-1 opacity-70">
            <img
              class="h-4 w-4 min-h-4 rounded-full"
              src="~@/assets/icons/btn-like-active.svg"
              alt=""
            />
          </div>
          <div class="flex-1 flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <img
                class="h-10 w-10 min-h-10 rounded-full"
                :src="updatedProfile(message.profile)"
                alt=""
              />
            </div>
            <div class="text-base">@{{ message.twitterName }} {{$t('notificationView.likeTweet')}}</div>
            <div class="text-grey-bd mt-2">
              {{ message.content }}
            </div>
          </div>
        </div>
        <!--retweet-->
        <div v-if="message.type === 3" class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
          <div class="px-1 opacity-70">
            <img
              class="h-4 w-4 min-h-4 rounded-full"
              src="~@/assets/icons/btn-retweet-active.svg"
              alt=""
            />
          </div>
          <div class="flex-1 flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <img
                class="h-10 w-10 min-h-10 rounded-full"
                :src="updatedProfile(message.profile)"
                alt=""
              />
            </div>
            <div class="text-base">@{{ message.twitterUsername }} {{$t('notificationView.retweetTweet')}}</div>
            <div class="text-gray">
              {{ message.content }}
            </div>
          </div>
        </div>
      </div>
    </van-list>
  </van-pull-refresh>
</template>

<style scoped></style>
