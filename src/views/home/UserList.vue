<script setup lang="ts">
import type {IpShareUser, Tweet} from "@/types";
import {getIPShareList} from "@/apis/api";
import {handleErrorTip} from "@/utils/notify";
import {onMounted, ref} from "vue";
import {formatAmount} from "@/utils/helper";
import UserAvatar from "@/components/common/UserAvatar.vue";

const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);
const list = ref<IpShareUser[]>([])

async function onRefresh() {
  try {
    refreshing.value = true;
    finished.value = false;
    list.value = await getIPShareList() as IpShareUser[]
    if (list.value.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

async function onLoad() {
  try{
    if (refreshing.value || finished.value) return
    loading.value = true
    const tempList = await getIPShareList(Math.floor((list.value.length - 1) / 30) + 1) as IpShareUser[]
    list.value = list.value.concat(tempList)
    if (tempList && tempList.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}

function profile(ips) {
  if (!ips.profile) return null
  if (ips.profile) {
    return ips.profile.replace('normal', '200x200')
  }else {
    return 'https://profile-images.heywallet.com/' + ips.twitterId
  }
}

function  gotoUserPage(ips) {
  console.log('ips', ips)
  this.$router.push({path : '/account-info/@' + ips.twitterUsername})
}

onMounted(async () => {
  await onRefresh();
});

</script>

<template>
  <van-pull-refresh v-model="refreshing"
                    @refresh="onRefresh"
                    :loading-text="$t('loading')"
                    :lpulling-text="$t('pullToRefreshData')"
                    :loosing-text="$t('releaseToRefresh')">
      <div v-if="!refreshing && list.length === 0"
           class="flex justify-center py-5 w-full bg-white rounded-2xl">
        <img class="my-8" src="~@/assets/images/empty-data.svg" alt="">
      </div>
      <div v-else class="flex flex-col">
        <div class="flex items-stretch gap-2 py-3 px-4 border-t-[0.5px] border-grey-light"
             v-for="following of list" :key="following.twitterId">
          <UserAvatar :profile-img="profile(following)"
                      :credit="null"
                      :name="following.twitterName"
                      :username="following.twitterUsername"
                      :followers="following.followers"
                      :followings="following.followings"
                      :eth-addr="following.ethAddr"
                      :steem-id="following.steemId"
                      :twitter-id="following.twitterId" teleported>
            <template #avatar-img>
              <img v-if="profile(following)" class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
                   :src="profile(following)" alt="">
              <img v-else
                   class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
                   src="~@/assets/icons/icon-default-avatar.svg" alt="">
            </template>
          </UserAvatar>
          <div class="flex-1 max-w-[2/3] truncate">
            <div class="flex flex-col gap-4px truncate text-12px xs:text-14px">
              <div class="font-bold text-h4 truncate">{{ following.twitterName }}</div>
              <div class="text-sm italic text-grey-bd flex flex-wrap gap-x-4 gap-y-1 truncate">
                @{{ following.twitterUsername }}</div>
            </div>
          </div>
          <div class="flex-1 text-center flex justify-end items-center gap-x-10px">
            <div class="text-right flex flex-col gap-4px">
              <div class="font-bold text-h4">
                -- / {{ formatAmount(following.supply) }}
              </div>
              <div class="text-sm italic text-grey-bd flex flex-wrap gap-x-4 gap-y-1">
                Price / Supply
              </div>
            </div>
          </div>
        </div>
        <template v-if="!loading && !refreshing">
          <div v-if="!finished" class="px-4 py-2 text-center">
            <button class="py-2 text-sm text-orange-normal" @click="onLoad">{{$t('showMore')}}</button>
          </div>
          <div v-else class="text-center text-sm text-grey-light-active pb-3">{{$t('noMore')}}</div>
        </template>
      </div>
  </van-pull-refresh>
</template>

<style scoped>

</style>