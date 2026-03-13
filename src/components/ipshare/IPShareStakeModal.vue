<template>
  <el-dialog
    v-model="visible"
    :title="`Stake ${subjectInfo.name || 'IPShare'}`"
    width="500px"
    :before-close="handleClose"
  >
    <div class="stake-container">
      <!-- 操作类型选择 -->
      <div class="stake-tabs">
        <button
          :class="['tab-btn', { active: isStake }]"
          @click="switchToStake"
        >
          Stake
        </button>
        <button
          :class="['tab-btn', { active: !isStake }]"
          @click="switchToUnstake"
        >
          Unstake
        </button>
      </div>

      <!-- 质押信息概览 -->
      <div class="stake-overview">
        <div class="overview-item">
          <span class="label">Your Balance</span>
          <span class="value">{{ formatNumber(ipshareBalance) }} IP.Share</span>
        </div>
        <div class="overview-item">
          <span class="label">Staked Amount</span>
          <span class="value">{{ formatNumber(stakedAmount) }} IP.Share</span>
        </div>
        <div class="overview-item">
          <span class="label">Pending Rewards</span>
          <span class="value">{{ formatNumber(pendingRewards) }} IP.Share</span>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-section">
        <div class="input-label">
          <span>{{ isStake ? 'Stake' : 'Unstake' }} Amount</span>
          <span class="balance">
            Available: {{ formatNumber(isStake ? ipshareBalance : stakedAmount) }}
          </span>
        </div>
        <div class="input-wrapper">
          <input
            v-model="amount"
            type="number"
            placeholder="0.00"
            class="amount-input"
          />
          <span class="token-symbol">IP.Share</span>
          <button class="max-btn" @click="setMaxAmount">MAX</button>
        </div>
      </div>

      <!-- Unstake 信息提示 -->
      <div v-if="!isStake && stakeInfo" class="unstake-info">
        <el-alert type="warning" :closable="false">
          <template #title>
            <div class="alert-content">
              <div>Unlock Time: {{ formatUnlockTime(stakeInfo.unlockTime) }}</div>
              <div>Redeemable: {{ formatNumber(stakeInfo.redeemAmount) }} IP.Share</div>
            </div>
          </template>
        </el-alert>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <!-- Claim 按钮 -->
        <el-button
          v-if="pendingRewards > 0"
          type="success"
          :loading="claiming"
          @click="handleClaim"
        >
          Claim {{ formatNumber(pendingRewards) }} IP.Share
        </el-button>

        <!-- Redeem 按钮 -->
        <el-button
          v-if="!isStake && stakeInfo && stakeInfo.redeemAmount > 0"
          type="warning"
          :loading="redeeming"
          @click="handleRedeem"
        >
          Redeem {{ formatNumber(stakeInfo.redeemAmount) }}
        </el-button>

        <!-- 主操作按钮 -->
        <div class="main-actions">
          <el-button @click="handleClose">Cancel</el-button>
          <el-button
            type="primary"
            :loading="processing"
            :disabled="!canOperate"
            @click="handleConfirm"
          >
            {{ isStake ? 'Stake' : 'Unstake' }}
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAccountStore, useIpshareData } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { stake, unstake, claim, redeem } from '@/utils/ipshare'
import {
  getIPshareBalances,
  getIPshareStaked,
  getPendingIPshareProfits,
  type StakeInfo
} from '@/utils/ipshareAsset'
import { parseViemRevertReason } from '@/utils/notify'
import { readContract } from '@/utils/contract'
import { isAddress } from 'viem'

interface Props {
  modelValue: boolean
  subjectAddress?: string
  subjectInfo?: {
    name?: string
  }
  accountInfo?: any
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  subjectInfo: () => ({}),
  accountInfo: () => null
})

// 如果通过 accountInfo 传入，使用 accountInfo 的地址
const subjectAddress = computed(() => {
  if (props.subjectAddress) {
    return props.subjectAddress
  }
  if (props.accountInfo?.ethAddr) {
    return props.accountInfo.ethAddr
  }
  if (props.accountInfo?.ipShare) {
    return props.accountInfo.ipShare
  }
  return accountStore.getAccountInfo?.ethAddr || ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const accountStore = useAccountStore()
const ipshareStore = useIpshareData()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 状态
const isStake = ref(true)
const amount = ref('')
const processing = ref(false)
const claiming = ref(false)
const redeeming = ref(false)
const ipshareBalance = ref(0)
const stakedAmount = ref(0)
const pendingRewards = ref(0)
const stakeInfo = ref<StakeInfo | null>(null)

// 计算属性
const canOperate = computed(() => {
  const amountNum = parseFloat(amount.value || '0')
  if (amountNum <= 0) return false

  if (isStake.value) {
    return ipshareBalance.value >= amountNum
  } else {
    return stakedAmount.value >= amountNum
  }
})

// 方法
const formatNumber = (num: number, decimals = 4): string => {
  if (!num) return '0'
  return parseFloat(num.toString()).toFixed(decimals)
}

const formatUnlockTime = (timestamp: number): string => {
  if (!timestamp) return 'N/A'
  const now = Math.floor(Date.now() / 1000)
  if (timestamp <= now) return 'Now'

  const diff = timestamp - now
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  return `${hours}h`
}

const switchToStake = () => {
  isStake.value = true
  amount.value = ''
}

const switchToUnstake = () => {
  isStake.value = false
  amount.value = ''
}

const setMaxAmount = () => {
  if (isStake.value) {
    amount.value = ipshareBalance.value.toString()
  } else {
    amount.value = stakedAmount.value.toString()
  }
}

const loadData = async () => {
  try {
    // 先尝试从 store 读取已有数据（如果有的话）
    const storeBalances = ipshareStore.ipshareBalances
    const storeStakeInfos = ipshareStore.stakeInfos
    const storeProfits = ipshareStore.pendingIPshareProfits
    
    // 如果 store 中有数据，先显示
    const address = subjectAddress.value
    if (!address) return
    
    if (storeBalances[address] !== undefined) {
      ipshareBalance.value = storeBalances[address] || 0
    }
    if (storeStakeInfos[address]) {
      const info = storeStakeInfos[address]
      stakeInfo.value = info
      stakedAmount.value = info.amount || 0
    }
    if (storeProfits[address] !== undefined) {
      pendingRewards.value = storeProfits[address] || 0
    }

    // 获取 IPShare 余额（函数内部会处理地址获取）
    const balances = await getIPshareBalances([address])
    if (balances[address] !== undefined) {
      ipshareBalance.value = balances[address] || 0
    }

    // 获取质押信息
    const stakeInfos = await getIPshareStaked([address])
    const info = stakeInfos[address]
    if (info) {
      stakeInfo.value = info
      stakedAmount.value = info.amount || 0
    }

    // 获取待领取收益
    const profits = await getPendingIPshareProfits([address])
    if (profits[address] !== undefined) {
      pendingRewards.value = profits[address] || 0
    }

    // 保存到 store（函数内部已经保存，这里确保数据同步）
    ipshareStore.saveIPshareBalances(balances)
    ipshareStore.saveStakeInfos(stakeInfos)
    ipshareStore.savePendingIPshareProfits(profits)
  } catch (e) {
    console.error('Load stake data failed:', e)
    // 如果获取失败，尝试从 store 读取
    const storeBalances = ipshareStore.ipshareBalances
    const storeStakeInfos = ipshareStore.stakeInfos
    const storeProfits = ipshareStore.pendingIPshareProfits
    
    const address = subjectAddress.value
    if (!address) return
    
    if (storeBalances[address] !== undefined) {
      ipshareBalance.value = storeBalances[address] || 0
    }
    if (storeStakeInfos[address]) {
      const info = storeStakeInfos[address]
      stakeInfo.value = info
      stakedAmount.value = info.amount || 0
    }
    if (storeProfits[address] !== undefined) {
      pendingRewards.value = storeProfits[address] || 0
    }
  }
}

const handleConfirm = async () => {
  if (!canOperate.value) return

  const amountNum = parseFloat(amount.value || '0')
  if (amountNum <= 0) {
    ElMessage.warning('Please input amount')
    return
  }

  try {
    processing.value = true
    
    // 检查是否连接钱包（适用于质押和解除质押）
    const stakeAddress = accountStore.ethConnectAddress
    if (!stakeAddress || !isAddress(stakeAddress)) {
      processing.value = false
      // 弹出连接钱包模态框
      const modalStore = useModalStore()
      modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
      return
    }
    
    if (isStake.value) {
      // 质押前重新获取最新余额并验证
      // 确保使用与 writeContract 中 simulateContract 相同的地址（ethConnectAddress）
      const address = subjectAddress.value
      
      if (!address || !isAddress(address)) {
        ElMessage.error('Invalid IPShare address')
        processing.value = false
        return
      }
      
      console.log('Stake - ethConnectAddress:', stakeAddress)
      console.log('Stake - getAccountInfo?.ethAddr:', accountStore.getAccountInfo?.ethAddr)
      console.log('Stake - Subject address:', address)
      console.log('Stake - Current balance:', ipshareBalance.value, 'Amount to stake:', amountNum)
      
      // 直接从链上查询余额，使用与 writeContract 相同的地址
      try {
        const balanceBigInt = await readContract('IPShare3', 'ipshareBalance', [
          address,
          stakeAddress
        ]) as bigint
        const latestBalance = parseFloat(balanceBigInt.toString()) / 1e18
        console.log('Stake - Latest balance from chain (direct query):', latestBalance, 'for address:', stakeAddress)
        console.log('Stake - Balance in BigInt:', balanceBigInt.toString())
        console.log('Stake - Amount to stake in BigInt:', BigInt(Math.floor(amountNum * 1e18)).toString())
        
        // 更新本地余额
        ipshareBalance.value = latestBalance
        
        // 使用 BigInt 进行精确比较，避免浮点数精度问题
        const amountBigInt = BigInt(Math.floor(amountNum * 1e18))
        if (balanceBigInt < amountBigInt) {
          ElMessage.error(`余额不足。当前余额: ${formatNumber(latestBalance)} IP.Share，尝试质押: ${formatNumber(amountNum)} IP.Share`)
          processing.value = false
          return
        }
      } catch (e) {
        console.error('Failed to query balance directly:', e)
        // 如果直接查询失败，使用批量查询
        const latestBalances = await getIPshareBalances([address])
        const latestBalance = latestBalances[address] || 0
        console.log('Stake - Latest balance from batch query:', latestBalance)
        
        // 使用浮点数比较（批量查询返回的是浮点数）
        if (latestBalance < amountNum - 0.0001) {
          ElMessage.error(`余额不足。当前余额: ${formatNumber(latestBalance)} IP.Share，尝试质押: ${formatNumber(amountNum)} IP.Share`)
          processing.value = false
          return
        }
      }
      
      // 质押
      const hash = await stake(address, amountNum)
      ElMessage.success('Stake successfully!')
      console.log('Transaction hash:', hash)

      // 刷新数据
      await loadData()

      // 通知父组件
      emit('success')

      // 清空输入
      amount.value = ''
      return
    } else {
      // 解除质押前重新获取最新质押信息并验证
      const address = subjectAddress.value
      console.log('Unstake - Current staked amount:', stakedAmount.value, 'Amount to unstake:', amountNum)
      const latestStakeInfos = await getIPshareStaked([address])
      const latestStakeInfo = latestStakeInfos[address]
      const latestStaked = latestStakeInfo?.amount || 0
      console.log('Unstake - Latest staked amount from chain:', latestStaked)
      
      // 更新本地质押数量
      if (latestStakeInfo) {
        stakeInfo.value = latestStakeInfo
        stakedAmount.value = latestStaked
      }
      
      // 再次验证质押数量是否足够
      if (latestStaked < amountNum) {
        ElMessage.error(`质押数量不足。当前质押: ${formatNumber(latestStaked)} IP.Share，尝试解除质押: ${formatNumber(amountNum)} IP.Share`)
        return
      }
      
      // 解除质押
      const hash = await unstake(address, amountNum)
      ElMessage.success('Unstake successfully! Please wait for unlock time to redeem.')
      console.log('Transaction hash:', hash)

      // 刷新数据
      await loadData()

      // 通知父组件
      emit('success')

      // 清空输入
      amount.value = ''
      return
    }

  } catch (e: any) {
    console.error('Operation failed:', e)
    
    // 使用统一的错误解析函数
    try {
      const parsedErrorMsg = parseViemRevertReason(e)
      if (parsedErrorMsg) {
        // parseViemRevertReason 已经显示了通知，这里不需要再显示
        return
      }
    } catch (parseError) {
      console.error('Parse error failed:', parseError)
    }
    
    // 如果解析失败，显示原始错误信息
    ElMessage.error(e.message || 'Operation failed')
  } finally {
    processing.value = false
  }
}

const handleClaim = async () => {
  const address = subjectAddress.value
  if (!address) {
    ElMessage.error('Invalid IPShare address')
    return
  }
  
  // 检查是否连接钱包
  const stakeAddress = accountStore.ethConnectAddress
  if (!stakeAddress || !isAddress(stakeAddress)) {
    // 弹出连接钱包模态框
    const modalStore = useModalStore()
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  }
  
  try {
    claiming.value = true
    const hash = await claim(address)
    ElMessage.success('Claim rewards successfully!')
    console.log('Claim hash:', hash)

    // 刷新数据
    await loadData()
    emit('success')
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

const handleRedeem = async () => {
  const address = subjectAddress.value
  if (!address) {
    ElMessage.error('Invalid IPShare address')
    return
  }
  
  // 检查是否连接钱包
  const stakeAddress = accountStore.ethConnectAddress
  if (!stakeAddress || !isAddress(stakeAddress)) {
    // 弹出连接钱包模态框
    const modalStore = useModalStore()
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  }
  
  if (!stakeInfo.value || stakeInfo.value.redeemAmount <= 0) {
    ElMessage.warning('No redeemable amount')
    return
  }

  const now = Math.floor(Date.now() / 1000)
  if (stakeInfo.value.unlockTime > now) {
    ElMessage.warning('Not yet unlocked')
    return
  }

  try {
    redeeming.value = true
    const hash = await redeem(address)
    ElMessage.success('Redeem successfully!')
    console.log('Redeem hash:', hash)

    // 刷新数据
    await loadData()
    emit('success')
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

const handleClose = () => {
  if (!processing.value && !claiming.value && !redeeming.value) {
    visible.value = false
    amount.value = ''
  }
}

// 监听弹窗打开或 subjectAddress 变化
watch([visible, subjectAddress], ([val, address]) => {
  if (val && address) {
    loadData()
  }
})

// 初始化
onMounted(() => {
  if (visible.value) {
    loadData()
  }
})
</script>

<style scoped lang="scss">
.stake-container {
  padding: 20px 0;
}

.stake-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;

  .tab-btn {
    flex: 1;
    height: 40px;
    border: 1px solid #e0e0e0;
    background: transparent;
    color: #999;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      border-color: #FF7A00;
    }

    &.active {
      background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
      border-color: transparent;
      color: white;
    }
  }
}

.stake-overview {
  padding: 16px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  margin-bottom: 24px;

  .overview-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    font-size: 14px;

    &:not(:last-child) {
      border-bottom: 1px solid #e0e0e0;
    }

    .label {
      color: #999;
    }

    .value {
      color: #333;
      font-weight: 500;
    }
  }
}

.input-section {
  margin-bottom: 16px;
}

.input-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #999;

  .balance {
    color: #666;
  }
}

.input-wrapper {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  gap: 12px;
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 20px;
  color: #333;

  &::placeholder {
    color: #666;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  -moz-appearance: textfield;
}

.token-symbol {
  font-size: 16px;
  font-weight: 600;
  color: #999;
}

.max-btn {
  padding: 6px 12px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  color: #666;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    background: #e0e0e0;
    color: #333;
  }
}

.unstake-info {
  margin-bottom: 24px;

  .alert-content {
    font-size: 13px;
    line-height: 1.6;
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .main-actions {
    display: flex;
    gap: 12px;
  }

  :deep(.el-button) {
    flex: 1;
    height: 48px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
  }

  :deep(.el-button--primary) {
    background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
    border-color: transparent;
    color: white;

    &:hover,
    &:focus {
      background: linear-gradient(213.44deg, #FDB76E -14.77%, #FF8C1A 116.22%);
      border-color: transparent;
    }

    &.is-disabled {
      opacity: 0.5;
    }
  }
}
</style>
