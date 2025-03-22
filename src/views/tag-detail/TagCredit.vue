<script setup lang="ts">
import { getHolderList, getCommunityCredits } from '@/apis/api'
import { useTools } from '@/composables/useTools';
import { useCommunityStore } from '@/stores/community';
import { type CommunityCredit } from '@/types';
import { formatAddress, formatAmount, sleep } from '@/utils/helper';
import { handleErrorTip } from '@/utils/notify';
import { onMounted, ref } from 'vue';

const comStore = useCommunityStore()
const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);

const holdingList = ref<CommunityCredit[]>([]);
const { onCopy } = useTools()

async function onRefresh() {
  if (loading.value) return;
  refreshing.value = true;
  finished.value = false;
  try{
    let list: any = await getCommunityCredits(comStore.currentSelectedCommunity!.tick)
    if (list && list.length > 0) {
      holdingList.value = list as CommunityCredit[];
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  if (refreshing.value || finished.value || holdingList.value.length == 0) return;
  loading.value = true;
  try{
    let list: any = await getCommunityCredits(comStore.currentSelectedCommunity!.tick, Math.floor((holdingList.value.length - 1) / 30) + 1);

    if (list && list.length > 0) {
      holdingList.value = holdingList.value.concat(list as CommunityCredit[]);
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

const onUserAvatar = () => {

}

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.3)
  }
  onRefresh()
})
</script>

<template>
  <div class="bg-white rounded-2xl p-3" v-if="comStore.currentSelectedCommunity?.tick">
    <div class="grid grid-cols-8 gap-x-2 web:grid-cols-9 text-h5 h-10 items-center">
      <span class="col-span-3 web:col-span-3 pl-8">{{ $t('account') }}</span>
      <span class="col-span-3 web:col-span-3">{{ $t('address') }}</span>
      <span class="col-span-2 web:col-span-3 text-right">{{ $t('credit') }}</span>
    </div>
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
        <div
          class="grid grid-cols-8 web:grid-cols-9 gap-x-2 h-8 items-center text-h4"
          v-for="(holder, i) of holdingList"
          :key="i"
        >
          <div class="col-span-3 truncate flex items-center gap-1">
            <span class="min-w-4">{{ i + 1 }}</span>
            <UserAvatar
              :profile-img="holder.profile"
              :name="holder.twitterName"
              :username="holder.twitterUsername"
              :followers="holder.followers"
              :followings="holder.followings"
              :eth-addr="holder.ethAddr"
              :credit="holder.credit"
          :teleported="true"
        >
          <template #avatar-img>
            <img
              v-if="holder.profile"
              class="w-5 h-5 min-w-5 rounded-full cursor-pointer bg-color2A"
              @click.stop="onUserAvatar"
              :src="holder.profile"
              alt=""
            />
            <img
              v-else
              class="w-5 h-5 min-w-5 rounded-full cursor-pointer bg-color2A"
              @click.stop="onUserAvatar"
              src="~@/assets/icons/icon-default-avatar.svg"
              alt=""
            />
          </template>
        </UserAvatar>
            <span class="truncate font-mono cursor-pointer">{{ holder.twitterName }}</span>
          </div>
          <span @click.stop="onCopy(holder.ethAddr ?? '')" class="col-span-3 cursor-pointer">{{ formatAddress(holder.ethAddr) }}</span>
          <span class="col-span-2 web:col-span-3 text-right">{{ formatAmount(holder.credit) }}</span>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped></style>
