<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
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
    const ips = await getIPShareList(0) as any[]
    console.log('📥 IPShare 列表 - 从后端获取的原始数据:', ips)
    
    if (ips && Array.isArray(ips)) {
      console.log(`📊 IPShare 列表 - 共 ${ips.length} 条数据`)
      
      // 初始只显示前30个，只处理这30个的供应量
      const initialIPs = ips.slice(0, 30)
      
      // 确保前30个 IPShare 都有基本数据
      initialIPs.forEach((ip, index) => {
        console.log(`\n👤 IPShare #${index + 1}:`, {
          twitterId: ip.twitterId,
          twitterName: ip.twitterName,
          twitterUsername: ip.twitterUsername,
          ethAddr: ip.ethAddr,
          supply: ip.supply,
          profile: ip.profile,
          followers: ip.followers,
          followings: ip.followings
        })
        
        // 如果后端没有返回 supply，尝试从链上获取
        if (!ip.supply && ip.ethAddr && isAddress(ip.ethAddr)) {
          // 先设置为 0，避免显示 -- / --
          ip.supply = 0
        }
      })
      
      // 批量获取前30个 IPShare 的供应量（仅更新那些后端没有返回 supply 的）
      const ethAddrs = initialIPs
        .filter(ip => isAddress(ip.ethAddr) && (!ip.supply || ip.supply === 0))
        .map(ip => ip.ethAddr)
      
      if (ethAddrs.length > 0) {
        console.log(`🔗 需要从链上获取供应量的地址 (${ethAddrs.length} 个):`, ethAddrs)
        try {
          const supplies = await getIPshareSupplies(ethAddrs)
          console.log('📦 从链上获取的供应量:', supplies)
          // 更新供应量到列表中（只更新那些没有 supply 的）
          initialIPs.forEach((ip) => {
            if (ip.ethAddr && supplies[ip.ethAddr] !== undefined) {
              const oldSupply = ip.supply
              ip.supply = supplies[ip.ethAddr]
              console.log(`✅ 更新供应量: ${ip.ethAddr} - ${oldSupply} → ${ip.supply}`)
            }
          })
        } catch (e) {
          console.error('Get IPShare supplies error:', e)
        }
      }
      
      // 使用展开运算符创建新数组以触发响应式更新，初始只显示前30个
      list.value = [...initialIPs]
      console.log('✅ IPShare 列表 - 最终数据已更新到列表:', list.value)
      console.log(`📋 IPShare 列表 - 初始显示 ${list.value.length} 条数据（共 ${ips.length} 条）`)
      
      // 如果后端返回的数据少于30条，标记为已完成
      if (ips.length < 30) {
        listFinished.value = true
      }
    } else {
      list.value = []
      console.warn('⚠️ IPShare 列表 - 后端返回的数据格式不正确:', ips)
    }
  } catch (e) {
    console.error('❌ Refresh IP list error:', e)
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
    console.log(`📄 加载更多 IPShare - 页码: ${pageIndex}`)
    const ips = await getIPShareList(pageIndex) as any[]
    console.log('📥 IPShare 列表 - 加载更多数据:', ips)
    
    if (!ips || ips.length < 30) {
      listFinished.value = true
    }
    if (ips && Array.isArray(ips) && ips.length > 0) {
      console.log(`📊 IPShare 列表 - 新增 ${ips.length} 条数据`)
      
      // 确保每个 IPShare 都有基本数据
      ips.forEach((ip, index) => {
        console.log(`\n👤 新增 IPShare #${index + 1}:`, {
          twitterId: ip.twitterId,
          twitterName: ip.twitterName,
          twitterUsername: ip.twitterUsername,
          ethAddr: ip.ethAddr,
          supply: ip.supply,
          profile: ip.profile,
          followers: ip.followers,
          followings: ip.followings
        })
        
        // 如果后端没有返回 supply，尝试从链上获取
        if (!ip.supply && ip.ethAddr && isAddress(ip.ethAddr)) {
          // 先设置为 0，避免显示 -- / --
          ip.supply = 0
        }
      })
      
      // 批量获取新加载的 IPShare 的供应量（仅更新那些后端没有返回 supply 的）
      const ethAddrs = ips
        .filter(ip => isAddress(ip.ethAddr) && (!ip.supply || ip.supply === 0))
        .map(ip => ip.ethAddr)
      
      if (ethAddrs.length > 0) {
        console.log(`🔗 需要从链上获取供应量的地址 (${ethAddrs.length} 个):`, ethAddrs)
        try {
          const supplies = await getIPshareSupplies(ethAddrs)
          console.log('📦 从链上获取的供应量:', supplies)
          // 更新供应量到新加载的列表中（只更新那些没有 supply 的）
          ips.forEach((ip) => {
            if (ip.ethAddr && supplies[ip.ethAddr] !== undefined) {
              const oldSupply = ip.supply
              ip.supply = supplies[ip.ethAddr]
              console.log(`✅ 更新供应量: ${ip.ethAddr} - ${oldSupply} → ${ip.supply}`)
            }
          })
        } catch (e) {
          console.error('Get IPShare supplies error:', e)
        }
      }
      // 使用展开运算符创建新数组以触发响应式更新
      list.value = [...list.value, ...ips]
      console.log(`✅ IPShare 列表 - 总数据量: ${list.value.length} 条`)
    }
  } catch (e) {
    console.error('❌ Load more IP list error:', e)
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
                <div class="text-black font-bold text-h3 leading-5 truncate">{{ ip.twitterName || 'Unknown' }}</div>
                <div class="text-12px leading-4 text-grey-8d">@{{ ip.twitterUsername || 'unknown' }}</div>
              </div>
            </div>
            <div class="flex-1 text-center flex justify-end items-center gap-3">
              <div class="text-right flex flex-col gap-1">
                <div class="text-black font-bold leading-5 text-h4">
                  <template v-if="ip.supply !== undefined && ip.supply !== null && ip.supply > 0">
                    {{ formatPrice(stateStore.ethPrice * calculateIPsharePriceLocal(ip.supply)) }} / {{ formatAmount(ip.supply) }}
                  </template>
                  <template v-else>
                    <span class="text-grey-8d">-- / --</span>
                  </template>
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
