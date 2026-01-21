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
          <span class="value">{{ formatNumber(pendingRewards) }} BNB</span>
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
          Claim {{ formatNumber(pendingRewards) }} BNB
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
import { stake, unstake, claim, redeem } from '@/utils/ipshare'
import {
  getIPshareBalances,
  getIPshareStaked,
  getPendingIPshareProfits,
  type StakeInfo
} from '@/utils/ipshareAsset'

interface Props {
  modelValue: boolean
  subjectAddress: string
  subjectInfo?: {
    name?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  subjectInfo: () => ({})
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
    const address = accountStore.ethConnectAddress
    if (!address) return

    // 获取 IPShare 余额
    const balances = await getIPshareBalances([props.subjectAddress])
    ipshareBalance.value = balances[props.subjectAddress] || 0

    // 获取质押信息
    const stakeInfos = await getIPshareStaked([props.subjectAddress])
    const info = stakeInfos[props.subjectAddress]
    if (info) {
      stakeInfo.value = info
      stakedAmount.value = info.amount || 0
    }

    // 获取待领取收益
    const profits = await getPendingIPshareProfits([props.subjectAddress])
    pendingRewards.value = profits[props.subjectAddress] || 0

    // 保存到 store
    ipshareStore.saveIPshareBalances(balances)
    ipshareStore.saveStakeInfos(stakeInfos)
    ipshareStore.savePendingIPshareProfits(profits)
  } catch (e) {
    console.error('Load stake data failed:', e)
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
    let hash: string

    if (isStake.value) {
      // 质押
      hash = await stake(props.subjectAddress, amountNum)
      ElMessage.success('Stake successfully!')
    } else {
      // 解除质押
      hash = await unstake(props.subjectAddress, amountNum)
      ElMessage.success('Unstake successfully! Please wait for unlock time to redeem.')
    }

    console.log('Transaction hash:', hash)

    // 刷新数据
    await loadData()

    // 通知父组件
    emit('success')

    // 清空输入
    amount.value = ''
  } catch (e: any) {
    console.error('Operation failed:', e)
    ElMessage.error(e.message || 'Operation failed')
  } finally {
    processing.value = false
  }
}

const handleClaim = async () => {
  try {
    claiming.value = true
    const hash = await claim(props.subjectAddress)
    ElMessage.success('Claim rewards successfully!')
    console.log('Claim hash:', hash)

    // 刷新数据
    await loadData()
    emit('success')
  } catch (e: any) {
    console.error('Claim failed:', e)
    ElMessage.error(e.message || 'Claim failed')
  } finally {
    claiming.value = false
  }
}

const handleRedeem = async () => {
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
    const hash = await redeem(props.subjectAddress)
    ElMessage.success('Redeem successfully!')
    console.log('Redeem hash:', hash)

    // 刷新数据
    await loadData()
    emit('success')
  } catch (e: any) {
    console.error('Redeem failed:', e)
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

// 监听弹窗打开
watch(visible, (val) => {
  if (val) {
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
    border: 1px solid #333;
    background: transparent;
    color: #999;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      border-color: #666;
    }

    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: transparent;
      color: white;
    }
  }
}

.stake-overview {
  padding: 16px;
  background: #1a1a1a;
  border-radius: 12px;
  margin-bottom: 24px;

  .overview-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    font-size: 14px;

    &:not(:last-child) {
      border-bottom: 1px solid #2a2a2a;
    }

    .label {
      color: #999;
    }

    .value {
      color: white;
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
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  gap: 12px;
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 20px;
  color: white;

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
  background: #333;
  border: none;
  border-radius: 6px;
  color: #999;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    background: #444;
    color: white;
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
}
</style>
