<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import TagListItem from "@/components/home/TagListItem.vue";
import { getCreatedList, getCapturedFee } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfo, getAIBalance } from "@/utils/pump";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { formatAmount } from "@/utils/helper";
import { redeemIxoReward } from '@/apis/api'
import { isAddress } from "viem";

const accStore = useAccountStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const scroller = document.querySelector('#profile-tab-scroller')
let aiBalance: any = {}
const capturedFee = ref(0)

const valueCaptured = computed(() => {
  return formatAmount(capturedFee.value);
})

async function loadCapturedFee(ethAddr: string) {
  try {
    const fee = await getCapturedFee(ethAddr);
    const feeValue = typeof fee === 'number' ? fee : (typeof fee === 'object' && fee !== null ? 0 : Number(fee) || 0);
    capturedFee.value = feeValue;
  } catch (error) {
    console.error('Load captured fee error:', error);
  }
}

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
    console.log('list', list)
    if (list && list.length > 0) {
      list = await getTokenInfo(list)
      aiBalance = await getAIBalance(list.map((item: any) => item.token))
      accStore.createdTokenList = list
      if (list.length < 30) finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

const claimReward = async (token: string) => {
  console.log('claimReward', token)
  try {
    const res = await redeemIxoReward(accStore.getAccountInfo.twitterId, token)
    console.log('res', res)
    onRefresh()
  } catch (e) {
    handleErrorTip(e)
  }
}

// 监听账户信息变化，加载 Value Captured 数据
watch(() => accStore.getAccountInfo?.ethAddr, (newAddr) => {
  if (newAddr && isAddress(newAddr)) {
    loadCapturedFee(newAddr);
  }
}, { immediate: true })

onMounted(() => {
  onRefresh()
  if (accStore.getAccountInfo?.ethAddr && isAddress(accStore.getAccountInfo.ethAddr)) {
    loadCapturedFee(accStore.getAccountInfo.ethAddr);
  }
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
        <!-- Value Captured -->
        <div class="px-3 mb-3">
          <div class="border-1 border-orange-normal rounded-xl px-4 py-3 bg-gray-50">
            <div class="text-sm text-grey-8d mb-1 flex items-center gap-2">
              <span>{{ $t('profileView.valueCaptured') || 'Value Captured' }}</span>
              <el-tooltip popper-class="c-arrow-popper">
                <template #content>
                  <div class="text-gray-700 p-2 max-w-200px text-xs">{{ $t('profileView.valueCapturedDesc') || 'Total value captured from IPShare trading fees.' }}</div>
                </template>
                <button>
                  <img class="w-4 h-4" src="~@/assets/icons/icon-tip.svg" alt="">
                </button>
              </el-tooltip>
            </div>
            <div class="text-center">
              <span class="text-orange-normal text-2xl font-bold">{{ valueCaptured }} BNB</span>
            </div>
          </div>
        </div>
        <div v-if="accStore.createdTokenList.length>0" class="px-3">
          <TagListItem v-for="(community, i) of accStore.createdTokenList" :key="i"
                       @click="$router.push(`/tag-detail/${community.tick}`)"
                       :community>
            <template #default-btn><div>
              <button v-if="aiBalance[community.token] > 0 && community.createdByAi && community.listed"
                class="h-8 bg-gradient-primary text-white font-medium px-4 rounded-full"
                @click.stop="claimReward(community.tick)">
                {{ formatAmount(aiBalance[community.token]) }} To Claim
              </button>
            </div></template>
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
