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
              Balance: {{ formatNumber(ethBalance, 3) }} BNB
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
        <div class="info-row slippage-row">
          <span>Slippage</span>
          <div class="slippage-input-wrapper">
            <input
              v-model.number="slippage"
              type="number"
              min="0"
              max="50"
              step="0.1"
              class="slippage-input"
              @input="validateSlippage"
            />
            <span class="slippage-percent">%</span>
            <div class="slippage-buttons">
              <button
                type="button"
                class="slippage-btn"
                @click="adjustSlippage(1)"
                :disabled="slippage >= 50"
                title="增加滑点"
              >
                <span class="slippage-icon">+</span>
              </button>
              <button
                type="button"
                class="slippage-btn"
                @click="adjustSlippage(-1)"
                :disabled="slippage <= 0"
                title="减少滑点"
              >
                <span class="slippage-icon">−</span>
              </button>
            </div>
          </div>
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
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
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
import { isAddress } from 'viem'
import { parseViemRevertReason } from '@/utils/notify'

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
const slippage = ref(15) // 默认滑点 15%

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
const formatNumber = (num: number | string | null | undefined, decimals = 4): string => {
  if (num === null || num === undefined) {
    return '0.' + '0'.repeat(decimals)
  }
  const numValue = typeof num === 'number' ? num : parseFloat(String(num))
  if (isNaN(numValue)) {
    return '0.' + '0'.repeat(decimals)
  }
  return numValue.toFixed(decimals)
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

// 滑点相关方法
const validateSlippage = () => {
  if (slippage.value < 0) {
    slippage.value = 0
  } else if (slippage.value > 50) {
    slippage.value = 50
  }
}

const adjustSlippage = (delta: number) => {
  slippage.value = Math.max(0, Math.min(50, slippage.value + delta))
}

let updateTimer: any = null
const updateReceive = async () => {
  clearTimeout(updateTimer)
  updateTimer = setTimeout(async () => {
    const amountNum = parseFloat(amount.value || '0')
    if (amountNum <= 0) {
      receive.value = 0
      return
    }

    if (isBuy.value) {
      receive.value = calculateEthNeedToBuyIPshares(supply.value, amountNum)
    } else {
      // 卖出时，优先使用链上查询的实际价格（含手续费）
      try {
        const chainPrice = await getSellPriceAfterFee(props.subjectAddress, amountNum)
        if (chainPrice > 0) {
          receive.value = chainPrice
        } else {
          // 如果链上查询失败，使用本地计算
          receive.value = calculateEthReceivedWhenSellIPshare(supply.value, amountNum)
        }
      } catch (e) {
        console.error('Get sell price after fee failed:', e)
        // 使用本地计算作为后备
        receive.value = calculateEthReceivedWhenSellIPshare(supply.value, amountNum)
      }
    }
  }, 300)
}

const loadBalances = async () => {
  try {
    // 优先使用连接的钱包地址，如果没有则使用账户绑定的地址
    let address: string | undefined = accountStore.ethConnectAddress
    if (!address || !isAddress(address)) {
      const ethAddr = accountStore.getAccountInfo?.ethAddr
      address = (ethAddr && typeof ethAddr === 'string') ? ethAddr : undefined
    }
    
    if (!address || !isAddress(address)) {
      // 如果都没有地址，使用 store 中已有的余额值
      ethBalance.value = accountStore.ethBalance || 0
      return
    }

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
    // 如果获取失败，尝试使用 store 中已有的余额值
    if (accountStore.ethBalance > 0) {
      ethBalance.value = accountStore.ethBalance
    }
  }
}

const handleConfirm = async () => {
  if (!canTrade.value) return

  // 检查是否连接钱包
  const connectAddress = accountStore.ethConnectAddress
  if (!connectAddress || !isAddress(connectAddress)) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  }

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
      // 卖出时，在提交交易前再次查询最新的链上价格并应用滑点保护
      let amountOutMin = 0
      try {
        // 在提交交易前再次获取最新的链上实际价格（含手续费）
        // 这样可以确保使用最新的价格，减少价格变化导致的滑点错误
        const chainPrice = await getSellPriceAfterFee(props.subjectAddress, amountNum)
        console.log('Sell - Chain price after fee:', chainPrice, 'Estimated receive:', receive.value)
        
        if (chainPrice > 0) {
          // 使用链上价格和本地估算价格中的较小值，应用用户设置的滑点保护
          const minPrice = Math.min(chainPrice, receive.value)
          const slippageMultiplier = (100 - slippage.value) / 100
          amountOutMin = minPrice * slippageMultiplier
          console.log('Sell - Chain price:', chainPrice, 'Local estimate:', receive.value, 'Min price:', minPrice, `Min receive (${slippage.value}% slippage):`, amountOutMin)
        } else {
          // 如果链上查询失败，使用本地计算的价格，应用用户设置的滑点
          const slippageMultiplier = (100 - slippage.value) / 100
          amountOutMin = receive.value * slippageMultiplier
          console.log(`Sell - Using local price with ${slippage.value}% slippage:`, amountOutMin)
        }
      } catch (e) {
        console.error('Get sell price after fee failed:', e)
        // 使用本地计算作为后备，应用用户设置的滑点
        const slippageMultiplier = (100 - slippage.value) / 100
        amountOutMin = receive.value * slippageMultiplier
      }
      
      // 确保 amountOutMin 不为 0 且合理
      if (amountOutMin <= 0) {
        ElMessage.error('无法计算最小接收金额，请重试。')
        return
      }
      
      // 确保 amountOutMin 不会太小（至少是估算价格的 50%）
      if (receive.value > 0 && amountOutMin < receive.value * 0.5) {
        console.warn('amountOutMin seems too small, using 50% of estimated price')
        amountOutMin = receive.value * 0.5
      }
      
      // 如果用户设置的滑点过大（>50%），限制为 50%
      if (slippage.value > 50) {
        console.warn('Slippage too high, limiting to 50%')
        amountOutMin = receive.value * 0.5
      }
      
      console.log('Sell - Final amountOutMin:', amountOutMin, 'for amount:', amountNum, 'Estimated receive:', receive.value)
      
      hash = await sellShares(
        props.subjectAddress,
        amountNum,
        amountOutMin
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
    
    // 检查错误数据中是否包含 0x619f5d2e 签名
    const errorData = e?.cause?.data || e?.cause?.cause?.data || e?.data
    const errorMsgStr = e?.message || e?.shortMessage || ''
    const errorString = String(errorMsgStr)
    
    // 检查是否是滑点错误（错误签名 0x619f5d2e）
    if (errorData === '0x619f5d2e' || 
        (typeof errorData === 'string' && errorData.includes('0x619f5d2e')) ||
        errorString.includes('0x619f5d2e')) {
      ElMessage.error('交易失败：滑点保护触发。实际价格可能已变化，请尝试减少卖出数量或稍后重试。')
      return
    }
    
    // 使用统一的错误解析函数
    try {
      const parsedErrorMsg = parseViemRevertReason(e)
      if (parsedErrorMsg) {
        ElMessage.error(parsedErrorMsg)
        return
      }
    } catch (parseError) {
      console.error('Parse error failed:', parseError)
    }
    
    // 解析错误信息
    let finalErrorMessage = '交易失败'
    if (e?.message) {
      finalErrorMessage = e.message
    } else if (e?.shortMessage) {
      finalErrorMessage = e.shortMessage
    } else if (typeof e === 'string') {
      finalErrorMessage = e
    }
    
    // 检查是否是滑点错误（包括未知的错误签名）
    if (finalErrorMessage.includes('0x619f5d2e') || 
        finalErrorMessage.includes('OutOfSlippage') || 
        finalErrorMessage.includes('slippage') ||
        finalErrorMessage.includes('amountOutMin') ||
        finalErrorMessage.includes('Unable to decode signature')) {
      finalErrorMessage = '交易失败：滑点保护触发。实际价格可能已变化，请尝试减少卖出数量或稍后重试。'
    }
    
    ElMessage.error(finalErrorMessage)
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
  color: #333;
  font-weight: 500;
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
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  margin-bottom: 24px;

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    font-size: 14px;
    color: #999;

    &:not(:last-child) {
      border-bottom: 1px solid #e0e0e0;
    }

    span:last-child {
      color: #333;
      font-weight: 500;
    }
  }

  .slippage-row {
    .slippage-input-wrapper {
      display: flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 4px 8px;
      background: #fff;
      min-width: 100px;
    }

    .slippage-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #333;
      font-size: 14px;
      font-weight: 500;
      text-align: right;
      width: 50px;
      padding: 0 4px;

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      -moz-appearance: textfield;
    }

    .slippage-percent {
      color: #ff6b35;
      font-size: 14px;
      font-weight: 500;
    }

    .slippage-buttons {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-left: 4px;
    }

    .slippage-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: #999;
      padding: 0;
      transition: color 0.2s;
      line-height: 1;

      &:hover:not(:disabled) {
        color: #ff6b35;
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .slippage-icon {
        font-size: 12px;
        font-weight: bold;
        line-height: 1;
      }
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
