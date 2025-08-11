<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useModalStore } from '@/stores/common'
import { useAccountStore } from '@/stores/web3'
import { GlobalModalType } from '@/types'
import { formatAmount } from '@/utils/helper'
import { useTools } from '@/composables/useTools'
import { useAccount } from '@/composables/useAccount'
import { isAddress } from 'viem'
import { transferEthTo } from '@/utils/wallets'
import { parseEther } from 'viem'
import { notify } from '@/utils/notify'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { privy } from '@/utils/privy'
import { PrivyConfig } from '@/config'
import { generateAuthorizationSignature } from "@privy-io/server-auth/wallet-api" 

const authHeader = 'Basic ' + Buffer.from(`${PrivyConfig.appId}:${PrivyConfig.appSecret}`).toString('base64')

const { profile, replaceEmptyProfile, gotoTwitter, updateBalance } = useAccount();
const { onCopy } = useTools()

// 状态管理
const modalStore = useModalStore()
const accStore = useAccountStore()
const router = useRouter()

// 响应式数据
const isLoading = ref(false)
const currentPage = ref('wallet') // 'wallet', 'recharge', 'withdraw'
const withdrawAddress = ref('')
const withdrawAmount = ref('')
const loading = ref(false)

let updateInterval: any;

watch(currentPage, (newVal) => {
  if (newVal === 'recharge') {
    updateInterval = setInterval(() => {
      updateBalance();
    }, 1000)
  } else {
    clearInterval(updateInterval);
  }
}, { immediate: true })

// 计算属性
const walletAddress = computed(() => {
  return accStore?.getAccountInfo?.ethAddr || '未连接钱包'
})

const displayAddress = computed(() => {
  if (!walletAddress.value || walletAddress.value === '未连接钱包') {
    return walletAddress.value
  }
  return `${walletAddress.value.slice(0, 6)}...${walletAddress.value.slice(-4)}`
})

const isWrongAddress = computed(() => {
  if (!withdrawAddress.value) {
    return false;
  }
  return !isAddress(withdrawAddress.value);
})

const isInsufficientBalance = computed(() => {
  if (!withdrawAmount.value) {
    return false;
  }
  return Number(withdrawAmount.value) > Number(accStore?.ethBalance);
})

// 方法
const closeModal = () => {
  modalStore.setModalVisible(false)
  // 重置页面状态
  currentPage.value = 'wallet'
  withdrawAddress.value = ''
  withdrawAmount.value = ''
}

const goBack = () => {
  currentPage.value = 'wallet'
  withdrawAddress.value = ''
  withdrawAmount.value = ''
}

const copyAddress = async () => {
  if (walletAddress.value && walletAddress.value !== '未连接钱包') {
    try {
      onCopy(walletAddress.value)
      // 可以添加复制成功的提示
    } catch (err) {
      console.error('复制失败:', err)
    }
  }
}

const handleRecharge = () => {
  currentPage.value = 'recharge'
}

const handleWithdraw = () => {
  currentPage.value = 'withdraw'
}

const handleBackupWallet = async () => {
  // 处理备份钱包逻辑
  console.log('备份钱包')
  // generate keypair
  const keypair: any = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  )
  console.log(1, keypair)
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey("spki", keypair.publicKey),
    crypto.subtle.exportKey("pkcs8", keypair.privateKey)
  ])
  console.log(2,publicKey, privateKey)
  const [publicKeyBase64, privateKeyBase64] = [
    Buffer.from(publicKey).toString("base64"),
    Buffer.from(privateKey).toString("base64")
  ]
  const id = await getUserId();
  if (!id) {
    notify({
      type: 'info',
      message: 'Login expired'
    })
    setTimeout(() => {
      useAccount().logout();
      closeModal();
      router.replace('/');  
    }, 3000);
    return;
  }
  console.log(3, publicKeyBase64, privateKeyBase64)
  
  const input: any = {
    headers: {
      "privy-app-id": PrivyConfig.appId,
    },
    method: "POST",
    url: `https://api.privy.io/v1/wallets/${id}/export`,
    version: 1 as const,
    body: {
      encryption_type: 'HPKE',
      recipient_public_key: publicKeyBase64,
    },
  }

  const signature = generateAuthorizationSignature({
    input,
    authorizationPrivateKey: PrivyConfig.authorizationPrivateKey,
  })
  console.log(4, signature)
  const res = await fetch(`https://api.privy.io/v1/wallets/${id}/export`,{
    method: input.method,
    headers: {
      ...input.headers,
      "Content-Type": "application/json",
      "privy-authorization-signature": signature as string,
      Authorization: authHeader,
      body: JSON.stringify(input.body),
    }
  })
  
  console.log(5, res);
}

const getUserId = async () => {
  const user = await privy.user.get();
  console.log(user);
  if (user && user.user && user.user.linked_accounts.length > 0) {
    const currentUser = user.user.linked_accounts.find((user: any) => user.address == accStore.getAccountInfo?.ethAddr);
    if (currentUser && 'id' in currentUser) {
      return currentUser.id;
    }
  }
  return null;
}

const handleDisconnectWallet = async () => {
  // 处理断开钱包逻辑
  console.log('断开钱包')
  useAccount().logout();
  router.replace('/');
  closeModal()
}

const handleConfirmWithdraw = async () => {
  try {
    loading.value = true;
    await transferEthTo(withdrawAddress.value, parseEther(withdrawAmount.value.toString()));
    updateBalance();
    notify({
      type: 'success',
      message: 'Withdrawal successful'
    })
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  clearInterval(updateInterval);
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
    <!-- 弹窗容器 -->
    <div class="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-popper-tip overflow-hidden">
      <!-- 顶部关闭按钮 -->
      <div class="absolute top-4 right-4 z-10">
        <button 
          @click="closeModal"
          class="w-8 h-8 flex items-center justify-center rounded-full bg-grey-f0 hover:bg-grey-e6 transition-colors"
        >
          <img class="w-4 h-4" src="~@/assets/icons/icon-modal-close.svg" alt="关闭">
        </button>
      </div>

      <!-- 弹窗内容 -->
      <div class="p-6">
        <!-- 钱包主页面 -->
        <div v-if="currentPage === 'wallet'">
          <!-- 标题 -->
          <h2 class="text-h2 text-grey-normal-hover text-center mb-6">{{ $t('wallet') }}</h2>

          <!-- 钱包身份区域 -->
          <div class="flex flex-col items-center mb-6">
            <!-- 头像 -->
            <img class="w-16 h-16 min-w-16 rounded-full cursor-pointer bg-color2A"
                :src="profile" @error="replaceEmptyProfile" alt="">
              <div class="h-full flex-1 my-2 text-md">
                @{{ accStore?.getAccountInfo?.twitterName }}
              </div>

            <!-- 钱包地址 -->
            <div class="flex items-center gap-2 text-md">
              <span class="text-grey-normal font-mono">{{ displayAddress }}</span>
              <button 
                @click="copyAddress"
                class="w-5 h-5 bg-grey-f0 rounded flex items-center justify-center hover:bg-grey-e6 transition-colors"
              >
                <svg class="w-3 h-3 text-grey-3f" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 余额显示 -->
          <div class="bg-grey-fa border border-white rounded-xl p-4 mb-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-grey-normal text-md">{{ $t('balance') }}:</span>
              </div>
              <span class="text-grey-normal-hover font-semibold">{{ formatAmount(accStore?.ethBalance ?? 0) }} BNB</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="space-y-3 mb-6">
            <!-- 充值按钮 -->
            <button 
              @click="handleRecharge"
              class="w-full h-12 bg-gradient-primary rounded-full text-white font-medium hover:opacity-90 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {{ $t('web3.recharge') }}
            </button>

            <!-- 提取按钮 -->
            <button 
              @click="handleWithdraw"
              class="w-full h-12 bg-gradient-primary rounded-full text-white font-medium hover:opacity-90 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {{ $t('web3.withdraw') }}
            </button>

            <!-- 备份钱包按钮 -->
            <button 
              @click="handleBackupWallet"
              class="w-full h-12 bg-gradient-primary rounded-full text-white font-medium hover:opacity-90 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {{ $t('web3.backUp') }}
            </button>

            <!-- 断开钱包按钮 -->
            <button 
              @click="handleDisconnectWallet"
              class="w-full h-12 bg-grey-f0 rounded-full text-grey-normal font-medium hover:bg-grey-e6 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {{ $t('web3.disconnect') }}
            </button>
          </div>

          <!-- 安全信息 -->
          <div class="bg-grey-fa border border-white rounded-xl p-4">
            <div class="flex items-start gap-3">
              <div class="w-5 h-5 bg-orange-normal rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
              </div>
              <div class="text-xs text-grey-8d leading-relaxed">
                {{ $t('web3.privyTip') }}
              </div>
            </div>
          </div>
        </div>

        <!-- 充值页面 -->
        <div v-if="currentPage === 'recharge'">
          <!-- 头部 -->
          <div class="flex items-center justify-between mb-6">
            <button 
              @click="goBack"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-grey-f0 hover:bg-grey-e6 transition-colors"
            >
              <svg class="w-4 h-4 text-grey-3f" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="text-h2 text-grey-normal-hover">{{ $t('web3.recharge') }} BNB</h2>
            <div class="w-8"></div>
          </div>

          <!-- 可支配余额 -->
          <div class="flex items-center gap-2 mb-6">
            <div class="w-5 h-5 bg-orange-normal rounded-full flex items-center justify-center">
              <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span class="text-grey-normal text-sm">{{ $t('web3.availableBalance') }}: {{ formatAmount(accStore.ethBalance) }} BNB</span>
          </div>

          <!-- 二维码区域 -->
          <!-- <div class="relative mb-6">
            <div class="w-48 h-48 mx-auto bg-white rounded-xl p-4 border border-grey-e6">
              <div class="w-full h-full bg-grey-f0 rounded-lg flex items-center justify-center">
                <div class="text-center">
                  <div class="w-16 h-16 bg-grey-3f rounded mx-auto mb-2"></div>
                  <span class="text-xs text-grey-8d">二维码占位符</span>
                </div>
              </div>
            </div>
            <div class="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-pink-500 rounded-tl-xl"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-purple-500 rounded-br-xl"></div>
          </div> -->

          <!-- 钱包地址 -->
          <div class="bg-grey-fa border border-white rounded-xl p-4 mb-6">
            <div class="flex items-center justify-between">
              <span class="text-grey-normal text-sm">{{ $t('address') }}</span>
              <div class="flex items-center gap-2">
                <span class="text-grey-normal-hover text-sm font-mono">{{ displayAddress }}</span>
                <button 
                  @click="copyAddress"
                  class="w-5 h-5 bg-grey-f0 rounded flex items-center justify-center hover:bg-grey-e6 transition-colors"
                >
                  <svg class="w-3 h-3 text-grey-3f" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 网络信息 -->
          <div class="bg-grey-fa border border-white rounded-xl p-4 mb-6">
            <div class="flex items-center justify-between">
              <span class="text-grey-normal text-sm">{{ $t('web3.network') }}</span>
              <div class="flex items-center gap-2">
                <span class="text-grey-normal-hover text-sm">BSC Mainnet</span>
                <div class="w-5 h-5 bg-orange-normal rounded-full flex items-center justify-center">
                  <img src="~@/assets/bnb-logo.svg" alt="">
                </div>
              </div>
            </div>
          </div>

          <!-- 警告信息 -->
          <div class="bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="text-ls text-red-600 leading-relaxed">
              {{ $t('web3.rechargeTip') }}
            </div>
          </div>
        </div>

        <!-- 提取页面 -->
        <div v-if="currentPage === 'withdraw'">
          <!-- 头部 -->
          <div class="flex items-center justify-between mb-6">
            <button 
              @click="goBack"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-grey-f0 hover:bg-grey-e6 transition-colors"
            >
              <svg class="w-4 h-4 text-grey-3f" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="text-h2 text-grey-normal-hover">{{ $t('web3.withdraw') }} BNB</h2>
            <div class="w-8"></div>
          </div>

          <!-- 可支配余额 -->
          <div class="flex items-center gap-2 mb-6">
            <div class="w-5 h-5 bg-orange-normal rounded-full flex items-center justify-center">
              <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span class="text-grey-normal text-sm">{{ $t('web3.availableBalance') }}: {{ formatAmount(accStore.ethBalance) }} BNB</span>
          </div>

          <!-- 目标地址输入 -->
          <div class="mb-4">
            <label class="block text-grey-normal text-sm mb-2">To:</label>
            <input
              v-model="withdrawAddress"
              type="text"
              :placeholder="$t('web3.inputAddress')"
              class="w-full h-12 px-4 bg-grey-fa border border-grey-e6 rounded-xl text-grey-normal-hover placeholder-grey-8d focus:border-orange-normal focus:outline-none transition-colors"
            />
            <p v-if="isWrongAddress" class="text-xs text-red-500 mt-1">
              {{ $t('web3.wrongAddress') }}
            </p>
          </div>

          <!-- 数量输入 -->
          <div class="mb-6">
            <label class="block text-grey-normal text-sm mb-2">Amount(BNB):</label>
              <input
                v-model="withdrawAmount"
                type="number"
                :placeholder="$t('web3.inputAmount')"
                class="w-full h-12 px-4 bg-grey-fa border border-grey-e6 rounded-xl text-grey-normal-hover placeholder-grey-8d focus:border-orange-normal focus:outline-none transition-colors"
              />

            <p v-if="isInsufficientBalance" class="text-xs text-red-500 mt-1">
              {{ $t('profileView.tipError4') }}
            </p>
          </div>

          <!-- 警告信息 -->
          <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div class="text-ls text-red-600 leading-relaxed">
              {{ $t('web3.withdrawTip') }}
            </div>
          </div>

          <!-- 确认提取按钮 -->
          <button 
            @click="handleConfirmWithdraw"
            :disabled="!withdrawAddress || !withdrawAmount || isWrongAddress || isInsufficientBalance"
            class="flex justify-center items-center gap-2 w-full h-12 bg-gradient-primary rounded-full text-white font-medium hover:opacity-90 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
          <span class="text-h5 text-white">{{$t('confirm')}}</span>
          <i-ep-loading v-if="loading" class="animate-spin text-white"/>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 按钮悬停效果 */
button:active {
  transform: scale(0.98);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .max-w-sm {
    max-width: calc(100vw - 2rem);
  }
}

/* 输入框聚焦效果 */
input:focus {
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
}
</style>
