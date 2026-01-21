<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getIPShareList } from '@/apis/api'
import { formatPrice, formatAmount } from '@/utils/helper'
import { calculateIPsharePriceLocal } from '@/utils/ipshare'
import { getIPshareSupplies } from '@/utils/ipshareAsset'
import { useAccountStore } from '@/stores/web3'
import { useStateStore } from '@/stores/common'
import { useRouter } from 'vue-router'
import { handleErrorTip } from '@/utils/notify'
import IPShareTradeModal from '@/components/ipshare/IPShareTradeModal.vue'
import { isAddress } from 'viem'
import emptyProfile from '@/assets/icons/icon-default-avatar.svg'

const router = useRouter()
const accStore = useAccountStore()
const stateStore = useStateStore()

const refreshing = ref(false)
const listLoading = ref(false)
const listFinished = ref(false)
const list = ref<any[]>([])
const modalVisible = ref(false)
const selectedIP = ref<any>(null)

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
    listFinished.value = false
    const ips = await getIPShareList(0)
    if (ips && Array.isArray(ips)) {
      list.value = ips
      // 批量获取所有 IPShare 的供应量
      const ethAddrs = ips.filter(ip => isAddress(ip.ethAddr)).map(ip => ip.ethAddr)
      if (ethAddrs.length > 0) {
        getIPshareSupplies(ethAddrs)
          .then(supplies => {
            list.value.forEach((ip, index) => {
              if (ip.ethAddr && supplies[ip.ethAddr] !== undefined) {
                ip.supply = supplies[ip.ethAddr]
              }
            })
          })
          .catch(() => {})
      }
    } else {
      list.value = []
    }
  } catch (e) {
    console.error('Refresh IP list error:', e)
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  try {
    if (refreshing.value || listFinished.value || listLoading.value || list.value.length === 0) return
    listLoading.value = true
    const pageIndex = Math.floor((list.value.length - 1) / 30) + 1
    const ips = await getIPShareList(pageIndex)
    if (!ips || ips.length < 30) {
      listFinished.value = true
    }
    if (ips && Array.isArray(ips) && ips.length > 0) {
      list.value = list.value.concat(ips)
      // 批量获取新加载的 IPShare 的供应量
      const ethAddrs = ips.filter(ip => isAddress(ip.ethAddr)).map(ip => ip.ethAddr)
      if (ethAddrs.length > 0) {
        getIPshareSupplies(ethAddrs)
          .then(supplies => {
            ips.forEach((ip, index) => {
              if (ip.ethAddr && supplies[ip.ethAddr] !== undefined) {
                const listIndex = list.value.length - ips.length + index
                if (list.value[listIndex]) {
                  list.value[listIndex].supply = supplies[ip.ethAddr]
                }
              }
            })
          })
          .catch(() => {})
      }
    }
  } catch (e) {
    console.error('Load more IP list error:', e)
    handleErrorTip(e)
  } finally {
    listLoading.value = false
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
  // 刷新列表以更新供应量
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
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="listLoading"
        :finished="listFinished"
        :immediate-check="false"
        :loading-text="$t('loading')"
        :finished-text="list.length !== 0 ? $t('noMore') : ''"
        @load="onLoad"
      >
        <div class="px-3">
          <div v-if="list.length === 0 && !refreshing" class="flex justify-center py-6 w-full">
            <img src="~@/assets/images/empty-data.svg" alt="">
          </div>
          <div
            v-for="ip in list"
            :key="ip.twitterId || ip.ethAddr"
            class="bg-white py-3 px-3 rounded-2xl mb-2 flex items-center gap-3"
            @click="gotoUserPage(ip)"
          >
            <div class="flex-1 max-w-1/2 md:max-w-2/3 flex items-center gap-3">
              <img
                class="w-10 h-10 min-w-10 min-h-10 rounded-full border-2 border-white cursor-pointer"
                :src="profile(ip)"
                @error="replaceEmptyProfile"
                alt=""
              >
              <div class="flex flex-col gap-1 truncate">
                <div class="text-white font-bold text-h3 leading-5 truncate">{{ ip.twitterName }}</div>
                <div class="text-12px leading-4 text-grey-8d">@{{ ip.twitterUsername }}</div>
              </div>
            </div>
            <div class="flex-1 text-center flex justify-end items-center gap-3">
              <div class="text-right flex flex-col gap-1">
                <div class="text-white font-bold leading-5 text-h4">
                  {{ formatPrice(stateStore.ethPrice * calculateIPsharePriceLocal(ip.supply)) }} / {{ formatAmount(ip.supply || 0) }}
                </div>
                <div class="whitespace-nowrap text-12px leading-4 text-grey-8d">{{ $t('ip.priceSupply') }}</div>
              </div>
              <button
                class="border-1 border-orange-normal rounded-full px-4 h-8 text-orange-normal text-h5 whitespace-nowrap hover:bg-orange-normal hover:text-white transition-all"
                @click.stop="onTrade(ip)"
              >
                {{ $t('trade') }}
              </button>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
    
    <IPShareTradeModal
      v-if="selectedIP"
      v-model="modalVisible"
      :subject-address="selectedIP.ethAddr"
      :subject-info="{
        name: selectedIP.twitterName,
        supply: selectedIP.supply
      }"
      @success="onModalClose"
    />
  </div>
</template>

<style scoped>
</style>
