<script setup lang="ts">
import { onMounted, ref } from "vue";
import TagListItem from "@/components/home/TagListItem.vue";
import { getCreatedList } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfo } from "@/utils/pump";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";

const accStore = useAccountStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const scroller = document.querySelector('#profile-tab-scroller')

const onLoad = async () => {
  if(loading.value || finished.value || !accStore.getAccountInfo.ethAddr || accStore.createdTokenList.length == 0) return
  loading.value = false
};

const onRefresh = async () => {
  if (loading.value || !accStore.getAccountInfo.ethAddr) {
    return;
  }
  try{
    refreshing.value = true
    finished.value = false
    let list: any = await getCreatedList(accStore.getAccountInfo.twitterId, accStore.getAccountInfo.ethAddr!)
    if (list && list.length > 0) {
      list = await getTokenInfo(list)
      accStore.createdTokenList = list
      if (list.length < 30) finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

onMounted(() => {
  onRefresh()
})

</script>

<template>
  <div class="min-h-full h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full h-full overflow-auto"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div v-if="accStore.createdTokenList.length>0" class="px-3">
          <TagListItem v-for="(community, i) of accStore.createdTokenList" :key="i"
                       @click="$router.push(`/tag-detail/${community.tick}`)"
                       :community>
            <template #default-btn><div></div></template>
          </TagListItem>
        </div>
        <template v-else>
          <div class="p-3 bg-white rounded-2xl text-center mx-3">
            <button @click="useModalStore().setModalVisible(true, GlobalModalType.CreateCoin)" class="h-12 w-full rounded-full bg-gradient-primary text-h3 text-white web:max-w-[310px]">
              {{$t('profileView.createYourCoin')}}
            </button>
          </div>
          <div class="flex justify-center py-6 w-full">
            <img src="~@/assets/images/empty-data.svg" alt="">
          </div>
        </template>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
