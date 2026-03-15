<template>
  <div class="h-full flex flex-col overflow-auto bg-gray-50">
    <!-- Back Header -->
    <BackHeader class="sticky top-0 bg-white border-b border-gray-200 z-10">
      <template #title>
        <div class="text-center font-medium text-lg">{{ accountInfo?.twitterName || 'Staking' }}</div>
      </template>
    </BackHeader>
    
    <div class="container mx-auto px-4 py-4 max-w-2xl flex-1 overflow-auto">
      <van-pull-refresh 
        v-model="refreshing"
        @refresh="onRefresh"
        :loading-text="$t('common.loading') || 'Loading...'"
        :pulling-text="$t('common.pullRefresh') || 'Pull to refresh'"
        :loosing-text="$t('common.loosingRefresh') || 'Release to refresh'"
        class="min-h-full">
        
        <!-- Description -->
        <div class="text-xs leading-5 pt-3 pb-6 text-gray-600">
          {{ $t('stakingView.stakingDesc') || 'Stake your IPShare to earn rewards. Unstaking requires a waiting period before you can redeem.' }}
        </div>
        
        <!-- Total Supply and Total Staked -->
        <div class="text-xs flex justify-between items-center mb-4 px-3">
          <span>{{ $t('stakingView.totalSupply') || 'Total Supply' }} {{ formatAmount(ipshareStore.ipshareSupplies[donutAddress] || 0) }}</span>
          <span>{{ $t('stakingView.stakeAmount') || 'Total Staked' }} {{ formatAmount(ipshareStore.totalStakedIPshares[donutAddress] || 0) }}</span>
        </div>
        
        <!-- Staking Overview Card -->
        <div class="py-6 rounded-xl border border-orange-normal bg-white shadow-sm text-center grid grid-cols-2 mb-4">
          <div class="col-span-1 text-center flex flex-col justify-center items-center gap-1">
            <div class="text-sm text-gray-600">{{ $t('stakingView.staking') || 'Staking' }}</div>
            <div class="text-3xl text-orange-normal font-bold">{{ formatAmount(stakeInfo?.amount || 0) }}</div>
          </div>
          <div class="col-span-1 text-center flex flex-col justify-center items-center gap-1">
            <div class="text-sm text-gray-600">{{ $t('stakingView.estReward') || 'Est. Reward' }}</div>
            <div class="text-3xl text-orange-normal font-bold">{{ formatAmount(ipshareStore.pendingIPshareProfits[donutAddress] || 0) }} IP.Share</div>
          </div>
          <div class="col-span-2 text-center pt-4 flex justify-center">
            <el-button
              type="primary"
              :disabled="(ipshareStore.pendingIPshareProfits[donutAddress] || 0) === 0 || claiming"
              :loading="claiming"
              @click="onClaim"
              class="w-48 h-10 rounded-full">
              {{ $t('stakingView.getReward') || 'Claim Rewards' }}
            </el-button>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between items-center gap-4 mb-4">
          <button 
            class="flex-1 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="(ipshareStore.ipshareBalances[donutAddress] || 0) === 0"
            @click="onStaking">
            <span class="font-bold text-orange-normal">{{ $t('stakingView.addStaking') || 'Add Staking' }}</span>
          </button>
          <button 
            class="flex-1 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="((stakeInfo?.amount || 0) === 0) || ((stakeInfo?.redeemAmount || 0) > 0)"
            @click="onWithdraw">
            <span class="font-bold text-orange-normal">{{ $t('stakingView.cancelStaking') || 'Cancel Staking' }}</span>
          </button>
        </div>
        
        <!-- Balance Display -->
        <div class="text-xs my-2 px-3 text-gray-600">
          IP.Share {{ $t('common.balance') || 'Balance' }}: {{ formatAmount(ipshareStore.ipshareBalances[donutAddress] || 0) }}
        </div>
        
        <!-- Redeeming Info -->
        <div v-if="isRedeeming" class="border border-orange-normal rounded-xl py-5 px-6 flex flex-col gap-3 mt-5 bg-white">
          <div class="flex justify-between items-center">
            <div class="text-center flex items-center justify-center text-xs">
              <span class="text-orange-normal font-bold mr-2">{{ $t('stakingView.redeeming') || 'Redeeming' }}</span>
              <el-tooltip popper-class="c-arrow-popper">
                <template #content>
                  <div class="text-white p-2 max-w-xs text-xs">{{ $t('stakingView.unstakeTip') || 'After unstaking, you need to wait for the unlock period before you can redeem your IPShare.' }}</div>
                </template>
                <button>
                  <img class="w-4 h-4" src="~@/assets/icons/icon-tip.svg" alt="">
                </button>
              </el-tooltip>
            </div>
            <span class="text-orange-normal font-bold">{{ formatAmount(stakeInfo?.redeemAmount || 0) }}</span>
          </div>
          <div v-if="countDown > 0" class="border border-orange-normal rounded-full h-10 flex justify-center items-center bg-gray-50">
            <div class="text-orange-normal text-lg font-bold">
              {{ formatCountDown(countDown) }}
            </div>
          </div>
          <el-button
            v-else
            type="primary"
            :disabled="redeeming"
            :loading="redeeming"
            @click="onRedeem"
            class="w-full h-10 rounded-full">
            {{ $t('stakingView.redeem') || 'Redeem' }}
          </el-button>
        </div>
      </van-pull-refresh>
    </div>
    
    <!-- Modals -->
    <IPShareStakeModal
      v-if="donutAddress"
      v-model="modalVisible"
      :account-info="accountInfo"
      :subject-address="donutAddress"
      :subject-info="{
        name: accountInfo?.twitterName || ''
      }"
      @success="onModalSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAccountStore, useIpshareData } from '@/stores/web3'
import { formatAmount } from '@/utils/helper'
import {
  getIPshareBalances,
  getIPshareSupplies,
  getIPshareStaked,
  getTotalStakedIPshares,
  getPendingIPshareProfits,
  type StakeInfo
} from '@/utils/ipshareAsset'
import { claim, redeem } from '@/utils/ipshare'
import { getUserProfile } from '@/apis/api'
import { isAddress } from 'viem'
import BackHeader from '@/layout/BackHeader.vue'
import IPShareStakeModal from '@/components/ipshare/IPShareStakeModal.vue'
import { parseViemRevertReason } from '@/utils/notify'

const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const ipshareStore = useIpshareData()

// 状态
const refreshing = ref(false)
const modalVisible = ref(false)
const claiming = ref(false)
const redeeming = ref(false)
const countDown = ref(0)
const accountInfo = ref<any>(null)

// 计算属性
const donutAddress = computed(() => {
  if (accountInfo.value?.ethAddr) {
    return accountInfo.value.ethAddr
  }
  // 如果是查看自己的质押页面，使用当前账户地址
  const currentAccount = accountStore.getAccountInfo
  if (currentAccount?.ethAddr && isAddress(currentAccount.ethAddr)) {
    return currentAccount.ethAddr
  }
  return ''
})

const stakeInfo = computed<StakeInfo | null>(() => {
  if (!donutAddress.value) return null
  return ipshareStore.stakeInfos[donutAddress.value] || null
})

const isRedeeming = computed(() => {
  return stakeInfo.value && (stakeInfo.value.redeemAmount || 0) > 0
})


// 方法
const formatCountDown = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

const loadAccountInfo = async () => {
  const username = route.params.user as string
  if (!username) {
    // 如果没有用户名参数，使用当前登录用户
    accountInfo.value = accountStore.getAccountInfo
    return
  }
  
  try {
    const user = await getUserProfile(username.replace('@', ''))
    accountInfo.value = user
  } catch (error) {
    console.error('Load account info failed:', error)
    // 如果加载失败，使用当前登录用户
    accountInfo.value = accountStore.getAccountInfo
  }
}

const onRefresh = async () => {
  if (!donutAddress.value) return
  
  try {
    refreshing.value = true
    await Promise.all([
      getIPshareBalances([donutAddress.value]),
      getIPshareSupplies([donutAddress.value]),
      getIPshareStaked([donutAddress.value]),
      getTotalStakedIPshares([donutAddress.value]),
      getPendingIPshareProfits([donutAddress.value])
    ])
  } catch (e) {
    console.error('Refresh failed:', e)
  } finally {
    refreshing.value = false
  }
}

const onStaking = () => {
  modalVisible.value = true
}

const onWithdraw = () => {
  modalVisible.value = true
}

const onClaim = async () => {
  if (!donutAddress.value) return
  
  try {
    claiming.value = true
    await claim(donutAddress.value)
    ElMessage.success('Claim rewards successfully!')
    
    // 刷新数据
    await Promise.all([
      getIPshareSupplies([donutAddress.value]),
      getIPshareBalances([donutAddress.value]),
      getPendingIPshareProfits([donutAddress.value])
    ])
  } catch (e: any) {
    console.error('Claim failed:', e)
    
    // 使用统一的错误解析函数
    try {
      const parsedErrorMsg = parseViemRevertReason(e)
      if (parsedErrorMsg) {
        return
      }
    } catch (parseError) {
      console.error('Parse error failed:', parseError)
    }
    
    ElMessage.error(e.message || 'Claim failed')
  } finally {
    claiming.value = false
  }
}

const onRedeem = async () => {
  if (!donutAddress.value) return
  
  try {
    redeeming.value = true
    await redeem(donutAddress.value)
    ElMessage.success('Redeem successfully!')
    
    // 刷新数据
    await onRefresh()
  } catch (e: any) {
    console.error('Redeem failed:', e)
    
    // 使用统一的错误解析函数
    try {
      const parsedErrorMsg = parseViemRevertReason(e)
      if (parsedErrorMsg) {
        return
      }
    } catch (parseError) {
      console.error('Parse error failed:', parseError)
    }
    
    ElMessage.error(e.message || 'Redeem failed')
  } finally {
    redeeming.value = false
  }
}


const onModalSuccess = () => {
  modalVisible.value = false
  onRefresh()
}

// 监听质押信息变化，更新倒计时
watch(stakeInfo, (val) => {
  if (val && val.unlockTime > 0) {
    const now = Date.now()
    const unlockTime = val.unlockTime * 1000
    if (unlockTime <= now) {
      countDown.value = 0
    } else {
      countDown.value = unlockTime - now
      // 每秒更新倒计时
      const interval = setInterval(() => {
        const remaining = unlockTime - Date.now()
        if (remaining <= 0) {
          countDown.value = 0
          clearInterval(interval)
        } else {
          countDown.value = remaining
        }
      }, 1000)
    }
  } else {
    countDown.value = 0
  }
}, { immediate: true })

// 监听路由参数变化
watch(() => route.params.user, () => {
  loadAccountInfo()
  onRefresh()
}, { immediate: true })

// 初始化
onMounted(async () => {
  await loadAccountInfo()
  if (donutAddress.value) {
    await onRefresh()
  }
})
</script>

<style scoped>
.container {
  max-width: 48rem;
}
</style>
