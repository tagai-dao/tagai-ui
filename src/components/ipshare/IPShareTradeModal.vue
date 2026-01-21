<template>
  <el-dialog
    v-model="visible"
    :title="`Trade ${subjectInfo.name || 'IPShare'}`"
    width="500px"
    :before-close="handleClose"
  >
    <div class="trade-container">
      <!-- 交易类型选择 -->
      <div class="trade-tabs">
        <button
          :class="['tab-btn', { active: isBuy }]"
          @click="switchToBuy"
        >
          Buy
        </button>
        <button
          :class="['tab-btn', { active: !isBuy }]"
          @click="switchToSell"
        >
          Sell
        </button>
      </div>

      <!-- 输入区域 -->
      <div class="input-section">
        <!-- IPShare 输入 -->
        <div class="input-group">
          <div class="input-label">
            <span>{{ isBuy ? 'Buy' : 'Sell' }}</span>
            <span class="balance">
              Balance: {{ formatNumber(ipshareBalance) }}
            </span>
          </div>
          <div class="input-wrapper">
            <input
              v-model="amount"
              type="number"
              placeholder="0.00"
              class="amount-input"
              @input="updateReceive"
            />
            <span class="token-symbol">IP.Share</span>
            <button
              v-if="!isBuy"
              class="max-btn"
              @click="setMaxAmount"
            >
              MAX
            </button>
          </div>
        </div>

        <!-- 转换图标 -->
        <div class="convert-icon" @click="switchMode">
          <el-icon><RefreshRight /></el-icon>
        </div>

        <!-- ETH 显示 -->
        <div class="input-group">
          <div class="input-label">
            <span>{{ isBuy ? 'Cost' : 'Receive' }}</span>
            <span class="balance">
              Balance: {{ formatNumber(ethBalance) }} BNB
            </span>
          </div>
          <div class="output-wrapper">
            <span class="amount-output">{{ formatNumber(receive) }}</span>
            <span class="token-symbol">BNB</span>
          </div>
        </div>
      </div>

      <!-- 交易信息 -->
      <div class="trade-info">
        <div class="info-row">
          <span>Supply</span>
          <span>{{ formatNumber(supply) }}</span>
        </div>
        <div class="info-row">
          <span>Price</span>
          <span>{{ formatNumber(price) }} BNB</span>
        </div>
        <div class="info-row">
          <span>Slippage</span>
          <span>{{ isBuy ? '2%' : '2%' }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button
          type="primary"
          :loading="trading"
          :disabled="!canTrade"
          @click="handleConfirm"
        >
          {{ isBuy ? 'Buy' : 'Sell' }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'
import { useAccountStore, useIpshareData } from '@/stores/web3'
import {
  buyShares,
  sellShares,
  calculateEthNeedToBuyIPshares,
  calculateEthReceivedWhenSellIPshare,
  calculateIPsharePriceLocal,
  getIPShareSupply
} from '@/utils/ipshare'
import {
  getIPshareBalances,
  getIPshareSupplies,
  getBuyPriceAfterFee,
  getSellPriceAfterFee
} from '@/utils/ipshareAsset'
import { getReadOnlyClient } from '@/utils/wallets'

interface Props {
  modelValue: boolean
  subjectAddress: string
  subjectInfo?: {
    name?: string
    supply?: number
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
const isBuy = ref(true)
const amount = ref('')
const receive = ref(0)
const trading = ref(false)
const ethBalance = ref(0)
const ipshareBalance = ref(0)
const supply = ref(0)

// 计算属性
const price = computed(() => {
  return calculateIPsharePriceLocal(supply.value)
})

const canTrade = computed(() => {
  const amountNum = parseFloat(amount.value || '0')
  if (amountNum <= 0) return false

  if (isBuy.value) {
    return ethBalance.value >= receive.value
  } else {
    return ipshareBalance.value >= amountNum
  }
})

// 方法
const formatNumber = (num: number, decimals = 4): string => {
  if (!num) return '0'
  return parseFloat(num.toString()).toFixed(decimals)
}

const switchToBuy = () => {
  isBuy.value = true
  amount.value = ''
  receive.value = 0
}

const switchToSell = () => {
  isBuy.value = false
  amount.value = ''
  receive.value = 0
}

const switchMode = () => {
  isBuy.value = !isBuy.value
  amount.value = ''
  receive.value = 0
}

const setMaxAmount = () => {
  amount.value = ipshareBalance.value.toString()
  updateReceive()
}

let updateTimer: any = null
const updateReceive = () => {
  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    const amountNum = parseFloat(amount.value || '0')
    if (amountNum <= 0) {
      receive.value = 0
      return
    }

    if (isBuy.value) {
      receive.value = calculateEthNeedToBuyIPshares(supply.value, amountNum)
    } else {
      receive.value = calculateEthReceivedWhenSellIPshare(supply.value, amountNum)
    }
  }, 300)
}

const loadBalances = async () => {
  try {
    const address = accountStore.ethConnectAddress
    if (!address) return

    // 获取 ETH 余额
    const client = getReadOnlyClient()
    const balance = await client.getBalance({ address: address as `0x${string}` })
    ethBalance.value = parseFloat(balance.toString()) / 1e18

    // 获取 IPShare 余额
    const balances = await getIPshareBalances([props.subjectAddress])
    ipshareBalance.value = balances[props.subjectAddress] || 0

    // 获取供应量
    const supplies = await getIPshareSupplies([props.subjectAddress])
    supply.value = supplies[props.subjectAddress] || props.subjectInfo.supply || 0

    // 保存到 store
    ipshareStore.saveIPshareBalances(balances)
    ipshareStore.saveIPshareSupplies(supplies)
  } catch (e) {
    console.error('Load balances failed:', e)
  }
}

const handleConfirm = async () => {
  if (!canTrade.value) return

  const amountNum = parseFloat(amount.value || '0')
  if (amountNum <= 0) {
    ElMessage.warning('Please input amount')
    return
  }

  // 检查卖出时的最小供应量限制
  if (!isBuy.value && supply.value - amountNum < 10) {
    ElMessage.warning('Cannot sell the last shares (minimum 10 required)')
    return
  }

  try {
    trading.value = true
    let hash: string

    if (isBuy.value) {
      // 买入
      hash = await buyShares(
        props.subjectAddress,
        accountStore.ethConnectAddress,
        amountNum,
        receive.value
      )
      ElMessage.success('Buy IPShare successfully!')
    } else {
      // 卖出 (应用 2% 滑点保护)
      hash = await sellShares(
        props.subjectAddress,
        amountNum,
        receive.value * 0.98
      )
      ElMessage.success('Sell IPShare successfully!')
    }

    console.log('Transaction hash:', hash)

    // 刷新余额
    await loadBalances()

    // 通知父组件
    emit('success')

    // 关闭弹窗
    handleClose()
  } catch (e: any) {
    console.error('Trade failed:', e)
    ElMessage.error(e.message || 'Trade failed')
  } finally {
    trading.value = false
  }
}

const handleClose = () => {
  if (!trading.value) {
    visible.value = false
    amount.value = ''
    receive.value = 0
  }
}

// 监听弹窗打开
watch(visible, (val) => {
  if (val) {
    loadBalances()
  }
})

// 初始化
onMounted(() => {
  if (visible.value) {
    loadBalances()
  }
})
</script>

<style scoped lang="scss">
.trade-container {
  padding: 20px 0;
}

.trade-tabs {
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

.input-section {
  margin-bottom: 24px;
}

.input-group {
  margin-bottom: 12px;
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

.input-wrapper,
.output-wrapper {
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

  /* 移除数字输入框的箭头 */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  -moz-appearance: textfield;
}

.amount-output {
  flex: 1;
  font-size: 20px;
  color: white;
  font-weight: 500;
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

.convert-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 8px 0;
  cursor: pointer;
  font-size: 24px;
  color: #666;
  transition: all 0.3s;

  &:hover {
    color: #999;
    transform: rotate(180deg);
  }
}

.trade-info {
  padding: 16px;
  background: #1a1a1a;
  border-radius: 12px;
  margin-bottom: 24px;

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    color: #999;

    &:not(:last-child) {
      border-bottom: 1px solid #2a2a2a;
    }

    span:last-child {
      color: white;
      font-weight: 500;
    }
  }
}

.action-buttons {
  display: flex;
  gap: 12px;

  :deep(.el-button) {
    flex: 1;
    height: 48px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
  }
}
</style>
