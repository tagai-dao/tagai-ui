<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getIPShareHoldingList } from '@/apis/api'
import { useAccountStore, useIpshareData } from "@/stores/web3";
import { handleErrorTip } from "@/utils/notify";
import { formatAmount } from "@/utils/helper";
import { useRouter } from "vue-router";
import { getIPshareSupplies, getIPshareBalances, getIPshareStaked } from "@/utils/ipshareAsset";
import IPShareTradeModal from "@/components/ipshare/IPShareTradeModal.vue";
import { isAddress } from "viem";
import emptyProfile from '@/assets/icons/icon-default-avatar.svg'

const router = useRouter()
const accStore = useAccountStore()
const ipshareStore = useIpshareData()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const list = ref<any[]>([])
const modalVisible = ref(false)
const selectedIP = ref<any>(null)

const ipshareSupplies = computed(() => ipshareStore.ipshareSupplies)
const ipshareBalances = computed(() => ipshareStore.ipshareBalances)
const stakeInfos = computed(() => ipshareStore.stakeInfos)

const profile = (ip: any) => {
  if (!ip.profile) return null
  if (ip.profile) {
    return ip.profile.replace('normal', '200x200')
  } else {
    return 'https://profile-images.heywallet.com/' + ip.twitterId
  }
}

const replaceEmptyProfile = (e: any) => {
  e.target.src = emptyProfile
}

async function onRefresh() {
  try {
    refreshing.value = true
    finished.value = false
    
    const ethAddr = accStore.getAccountInfo?.ethAddr
    if (!ethAddr || !isAddress(ethAddr)) {
      list.value = []
      finished.value = true
      return
    }

    // 获取用户持有的 IPShare 列表
    let holdingList: any[] = []
    
    // 如果用户自己创建了 IPShare，先添加到列表
    if (accStore.getAccountInfo?.ipShare) {
      holdingList = [{
        twitterId: accStore.getAccountInfo.twitterId,
        twitterName: accStore.getAccountInfo.twitterName,
        twitterUsername: accStore.getAccountInfo.twitterUsername,
        ethAddr: accStore.getAccountInfo.ethAddr,
        profile: accStore.getAccountInfo.profile,
        ipShare: accStore.getAccountInfo.ipShare
      }]
    }
    
    // 获取用户持有的其他 IPShare
    const tem = await getIPShareHoldingList(ethAddr, 0) as any[]
    if (tem && tem.length > 0) {
      // 过滤掉自己的 IPShare
      const filtered = tem.filter((t: any) => t.ipShare !== accStore.getAccountInfo?.ipShare)
      holdingList = holdingList.concat(filtered)
    }
    
    list.value = holdingList || []
    
    // 批量获取供应量、持有量和质押信息（数据会自动保存到 store）
    if (list.value.length > 0) {
      // 使用 ipShare 作为 subject 地址，如果没有则使用 ethAddr（如果 ethAddr 就是 IPShare 地址）
      const subjectAddrs = list.value.map(ip => ip.ipShare || ip.ethAddr).filter((addr): addr is string => isAddress(addr))
      if (subjectAddrs.length > 0) {
        // 这些函数会自动将数据保存到 store（参考 Donut 实现）
        await Promise.all([
          getIPshareSupplies(subjectAddrs),
          getIPshareBalances(subjectAddrs),
          getIPshareStaked(subjectAddrs)
        ])
      }
    }
    
    if (!holdingList || holdingList.length === 0) {
      finished.value = true
    }
  } catch (e) {
    console.error('Refresh IPShare holding list error:', e)
    handleErrorTip(e)
    finished.value = true
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  try {
    if (refreshing.value || finished.value || loading.value) return
    loading.value = true
    
    const ethAddr = accStore.getAccountInfo?.ethAddr
    if (!ethAddr || !isAddress(ethAddr)) {
      finished.value = true
      return
    }
    
    const pageIndex = Math.floor((list.value.length - 1) / 30) + 1
    const holdingList = await getIPShareHoldingList(ethAddr, pageIndex) as any[]
    
    if (!holdingList || holdingList.length === 0) {
      finished.value = true
      return
    }
    
    if (holdingList.length < 30) {
      finished.value = true
    }
    
    list.value = [...list.value, ...holdingList]
    
    // 批量获取新加载的数据（数据会自动保存到 store）
    if (holdingList.length > 0) {
      // 使用 ipShare 作为 subject 地址，如果没有则使用 ethAddr（如果 ethAddr 就是 IPShare 地址）
      const subjectAddrs = holdingList.map(ip => ip.ipShare || ip.ethAddr).filter((addr): addr is string => isAddress(addr))
      if (subjectAddrs.length > 0) {
        // 这些函数会自动将数据保存到 store（参考 Donut 实现）
        await Promise.all([
          getIPshareSupplies(subjectAddrs),
          getIPshareBalances(subjectAddrs),
          getIPshareStaked(subjectAddrs)
        ])
      }
    }
  } catch (e) {
    console.error('Load more IPShare holding list error:', e)
    handleErrorTip(e)
    finished.value = true
  } finally {
    loading.value = false
  }
}

function gotoUserPage(ip: any) {
  if (ip.twitterUsername) {
    router.push('/user/' + ip.twitterUsername)
  }
}

function onTrade(ip: any) {
  selectedIP.value = ip
  modalVisible.value = true
}

function onModalClose() {
  modalVisible.value = false
  selectedIP.value = null
  // 刷新数据
  onRefresh()
}

onMounted(() => {
  onRefresh()
})
</script>

<template>
  <div class="h-full overflow-auto">
    <van-pull-refresh 
      v-model="refreshing" 
      @refresh="onRefresh"
      class="min-h-full"
      :loading-text="$t('loading')"
      :pulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')">
      <van-list 
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        :finished-text="list.length !== 0 ? $t('noMore') : ''"
        :offset="50"
        @load="onLoad">
        <div v-if="list.length === 0 && !refreshing" class="flex justify-center py-6 w-full">
          <img src="~@/assets/images/empty-data.svg" alt="">
        </div>
        <div
          v-for="ip in list"
          :key="ip.twitterId || ip.ethAddr"
          class="bg-white py-3 px-3 rounded-2xl mb-2 mx-3 flex items-center gap-3"
          @click="gotoUserPage(ip)"
        >
          <div class="flex-1 flex items-center gap-3">
            <img
              class="w-10 h-10 min-w-10 min-h-10 rounded-full border-2 border-white cursor-pointer"
              :src="profile(ip)"
              @error="replaceEmptyProfile"
              alt=""
            >
            <div class="flex-1 flex flex-col gap-1">
              <div class="text-black font-bold text-h3 leading-5 truncate">{{ ip.twitterName || 'Unknown' }}</div>
              <div class="text-12px leading-4 text-grey-8d">
                IP.Share {{ $t('walletView.totalAmount') || '总供应量' }} {{ formatAmount(ipshareSupplies[ip.ipShare || ip.ethAddr] || 0) }}
              </div>
            </div>
          </div>
          <div class="flex-1 flex flex-col gap-1 text-right">
            <div class="font-bold text-black text-12px leading-5">
              {{ formatAmount(ipshareBalances[ip.ipShare || ip.ethAddr] || 0) }} / {{ formatAmount(stakeInfos[ip.ipShare || ip.ethAddr]?.amount || 0) }}
            </div>
            <div class="text-10px leading-4 text-grey-8d">
              {{ $t('walletView.holdAmount') || '持有量' }}/{{ $t('walletView.stakedAmount') || '质押量' }}
            </div>
          </div>
          <div class="flex gap-2">
            <button
              class="border-1 border-orange-normal rounded-full px-4 h-8 text-orange-normal text-h5 whitespace-nowrap hover:bg-orange-normal hover:text-white transition-all"
              @click.stop="onTrade(ip)"
            >
              {{ $t('trade') || '交易' }}
            </button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
    
    <IPShareTradeModal
      v-if="selectedIP"
      v-model="modalVisible"
      :subject-address="selectedIP.ipShare || selectedIP.ethAddr"
      :subject-info="{
        name: selectedIP.twitterName,
        supply: ipshareSupplies[selectedIP.ipShare || selectedIP.ethAddr] || 0
      }"
      @success="onModalClose"
    />
  </div>
</template>

<style scoped>

</style>
