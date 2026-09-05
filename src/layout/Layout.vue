<script setup lang="ts">
import {RouterView, useRouter} from "vue-router";
import TopBar from "@/layout/TopBar.vue";
import TabBar from "@/layout/TabBar.vue";
import LeftSidebar from "@/layout/LeftSidebar.vue";
import CreateCoinModal from "@/components/common/CreateCoinModal.vue";
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import AuthTwitter from "@/components/login/AuthTwitter.vue";
import BondEthModal from "@/components/login/BondEthModal.vue";
import ChoseWallet from "@/components/login/ChoseWallet.vue";
import RegisterSteem from "@/components/login/RegisterSteem.vue";
import CreateIPShareModal from "@/components/common/CreateIPShareModal.vue";
import CreatePredictModal from "@/components/common/CreatePredictModal.vue";
import ModifyCoinModal from "@/components/common/ModifyCoinModal.vue";
import PredictTradeModal from "@/components/common/PredictTradeModal.vue";
import PredictLiquidityModal from "@/components/common/PredictLiquidityModal.vue";
import {onMounted, ref, watch} from "vue";
import emitter from "@/utils/emitter";
import {applyPureReactInVue} from "veaury";
import ReactApp from "@/react_app/App.jsx";
import {EthWalletState, useAccountStore} from "@/stores/web3";
import {handleErrorTip, notify} from "@/utils/notify";
import {usePrivyStore} from "@/stores/privy";
import {isAddress} from "viem";
import {useAccount} from "@/composables/useAccount";
import {sleep} from "@/utils/helper";
import CreateUserInfo from "@/components/login/CreateUserInfo.vue";
import {getUserProfile} from "@/apis/api";
import SearchBar from "@/components/common/SearchBar.vue";
import LanguageSwitcher from "@/components/common/LanguageSwitcher.vue";
import ChainSwitcher from "@/components/common/ChainSwitcher.vue";

const router = useRouter();
const accStore = useAccountStore();
const { updateVPOP } = useAccount();
const privyStore = usePrivyStore();
const newLogin = ref(false);
const walletReady = ref(false);
const modalStore = useModalStore()

const WrappedReactComponent = applyPureReactInVue(ReactApp);

const handleReactLoginSuccess = async (accInfo: any) => {
  console.log('accInfo', accInfo)
  accStore.setAccount(accInfo)
  console.log('login')
  emitter.emit('login', true);

  newLogin.value = true;
  console.log('login account info', accInfo);
  if (accInfo.accountType === 1 && accInfo.isNew === 1) {
    // api 获取用户信息，如果是新用户（username为空），则创建用户，弹出login/CreateUserInfo组件
    // 如果用户已创建，将用户信息accStore.setAccount，并调用setWallet
    modalStore.setModalVisible(true, GlobalModalType.CreateUserInfo)
    finishNewLoginIfNeeded()
    return;
  }

  // Application authentication must not wait for an embedded-wallet provider.
  // Wallet initialization continues reactively when Privy publishes it.
  finishNewLoginIfNeeded()
}

/** 用户已用 MetaMask 等插件连上（非 Privy） */
const isPluginWalletConnected = () => {
  const walletType = accStore.ethWalletType
  return (
    accStore.ethConnectState === EthWalletState.Connected &&
    !!accStore.ethConnectAddress &&
    !!walletType &&
    walletType !== 'privy' &&
    walletType !== 'none'
  )
}

/** 登录流程收尾：关登录窗 + 回跳；只应调用一次 */
const finishNewLoginIfNeeded = () => {
  if (!newLogin.value) return
  if (modalStore.modalType === GlobalModalType.Login) {
    modalStore.setModalVisible(false)
  }
  // 消费掉 newLogin，避免后续 walletProvider 再次走登录收尾跳转
  newLogin.value = false
  const guardRedirect = sessionStorage.getItem('login-redirect')
  sessionStorage.removeItem('login-redirect')
  router.replace(guardRedirect || localStorage.getItem('current-route') || '/')
}

// 只有当推特登录和钱包准备好了才需要设置钱包或者新绑定钱包
const setWallet = async () => {
  if (!accStore.getAccountInfo?.twitterId || !privyStore.ethersProvider) return
  // The login coordinator creates and verifies the embedded wallet before
  // publishing its address. Do not start a competing signature-based bind.
  if (privyStore.walletBinding) return

  // 插件已连上：Privy walletProvider 回调绝不能改连接态，否则交易又弹 ChoseWallet
  if (isPluginWalletConnected()) {
    finishNewLoginIfNeeded()
    return
  }

  // 账户绑定的是插件钱包地址：只由 ChoseWallet 管理连接，不要 initWallet / 强制 Disconnect 已连状态
  const isManualPluginAccount =
    accStore.getAccountInfo.walletType === 0 &&
    !!accStore.getAccountInfo.ethAddr &&
    isAddress(accStore.getAccountInfo.ethAddr)

  if (isManualPluginAccount) {
    // 未连插件时标 Disconnect，便于 UI 提示去连；已连则上面已 return
    accStore.ethConnectState = EthWalletState.Disconnect
    finishNewLoginIfNeeded()
    return
  }

  try {
    accStore.ethConnectState = EthWalletState.Connecting;
    walletReady.value = true;
    const accounts = await privyStore.ethersProvider.request({
      method: 'eth_requestAccounts'
    });
    // await 期间用户可能已用插件连上，再次保护
    if (isPluginWalletConnected()) return

    const connectedAddr = accounts[0];
    if (privyStore.walletBinding) {
      // Email/Twitter login is binding through its Privy access token. Only
      // initialize the client here; the binding effect owns the backend write.
      await privyStore.initWallet()
    } else if (accStore.getAccountInfo.walletType === 0 && !accStore.getAccountInfo.ethAddr) {
      await useAccount().bondEthAddress()
    } else if (accStore.getAccountInfo.walletType === 1 && accStore.getAccountInfo.ethAddr?.toLowerCase() !== connectedAddr?.toLowerCase()) {
      await useAccount().bondEthAddress();
    } else {
      await privyStore.initWallet()
    }
  } catch (error) {
      console.error('Failed to set wallet:', error)
      handleErrorTip(error)
      await sleep(3)
  } finally {
    finishNewLoginIfNeeded()
  }
}

const handleReactLoginError = async (error?: any) => {
  // 透出后端真实错误（auth.js 各拒绝分支均返回 {error} + 业务码 301），
  // 否则只有写死的 Please try again，无法定位问题
  const serverMsg = typeof error === 'string'
    ? error
    : error?.data?.error || error?.data?.message || error?.message
  notify({
    title: 'Login failed',
    message: serverMsg ? String(serverMsg) : 'Please try again',
    type: 'error'
  });
  console.error('Failed to login tip', error)
  await sleep(1)
  accStore.clear();
  router.replace(localStorage.getItem('current-route') || '/')
}

const handleWalletProvider = async (provider: any) => {
  console.log('init privy provider', provider)
  usePrivyStore().ethersProvider = provider
}

const handleWalletError = (error?: any) => {
  console.error('Embedded wallet setup failed:', error)
  handleErrorTip(error)
}

// Account data and the embedded-wallet provider arrive independently. Drive
// initialization from their shared reactive state so neither event can be lost.
watch(
  () => [accStore.getAccountInfo?.twitterId, privyStore.ethersProvider, privyStore.walletBinding] as const,
  ([twitterId, provider]) => {
    if (twitterId && provider) void setWallet()
  },
  { immediate: true, flush: 'post' }
)

const cachedComponents = ref(['HomeView'])
onMounted( () => {
  emitter.on('authSuccess', handleReactLoginSuccess);
  emitter.on('authError', handleReactLoginError);
  emitter.on('walletError', handleWalletError);
  emitter.on('walletProvider', handleWalletProvider);
  emitter.on('setPageAliveState', async (params: any) => {
    if(params.isAlive) cachedComponents.value.push(params.pageName)
    else {
      const index = cachedComponents.value.indexOf(params.pageName)
      if(index > -1) cachedComponents.value.splice(index, 1)
    }
  })
})
</script>

<template>
  <WrappedReactComponent>
    <main class="w-full h-full">
      <!-- PC 端布局：左侧边栏 + 主内容区 -->
      <div class="hidden web:flex h-full">
        <!-- 左侧边栏 - 根据路由 meta 控制显示 -->
        <LeftSidebar v-if="$route.meta.tabBar !== false" />
        
        <!-- 主内容区 -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <!-- PC 端不显示 TopBar，移动端显示 -->
          <div class="web:hidden">
            <TopBar v-show="$route.meta.topBar"/>
          </div>
          <!-- PC 端顶部栏：搜索框和语言切换 - 根据路由 meta 控制显示 -->
          <div v-if="$route.meta.topBar !== false" class="hidden web:flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-surface">
            <div class="flex-1 max-w-[360px] focus-within:max-w-[480px] transition-all duration-200">
              <SearchBar />
            </div>
            <div class="ml-4 flex items-center gap-2">
              <ChainSwitcher variant="compact" />
              <LanguageSwitcher />
            </div>
          </div>
          <div class="flex-1 overflow-hidden">
            <router-view v-slot="{ Component }">
              <keep-alive :include="cachedComponents">
                <component :is="Component" :key="$route.name"/>
              </keep-alive>
            </router-view>
          </div>
        </div>
      </div>

      <!-- 移动端布局：保持原有布局 -->
      <main class="web:hidden w-full h-full flex flex-col max-w-[1200px] mx-auto relative">
        <TopBar v-show="$route.meta.topBar"/>
        <div class="flex-1 min-h-0 overflow-hidden">
          <router-view v-slot="{ Component }">
            <keep-alive :include="cachedComponents">
              <component :is="Component" :key="$route.name"/>
            </keep-alive>
          </router-view>
        </div>
        <TabBar v-if="$route.meta.tabBar"/>
      </main>

      <!-- 全局只挂载一个 Dialog。Element Plus 默认 teleport 到 body，重复实例会争用同一个 v-model。 -->
      <el-dialog v-model="modalStore.modalVisible"
                 :close-on-click-modal="modalStore.modalCloseEnable"
                 :close-on-press-escape="modalStore.modalCloseEnable"
                 :modal-class="`overlay-white ${modalStore.modalType===GlobalModalType.Login?'modal-gradient-bg':''}`"
                 :class="modalStore.modalType===GlobalModalType.PredictTrade
                   ? 'max-w-[900px] rounded-[20px]'
                   : modalStore.modalType===GlobalModalType.CreateCoin
                     ? 'max-w-[720px] rounded-[24px] create-token-dialog'
                     : 'max-w-[500px] rounded-[20px]'"
                 width="90%" :show-close="false" align-center destroy-on-close>
        <CreateCoinModal v-if="modalStore.modalType===GlobalModalType.CreateCoin"/>
        <CreateTweetModal v-if="modalStore.modalType===GlobalModalType.CreateTweet" :default-tick="false"/>
        <CreateSpaceModal v-if="modalStore.modalType===GlobalModalType.CreateTweetSpace" :default-tick="false"/>
        <AuthTwitter v-if="modalStore.modalType===GlobalModalType.Login"/>
        <BondEthModal v-if="modalStore.modalType===GlobalModalType.BondEth"/>
        <ChoseWallet @chosedWallet="modalStore.setModalVisible(false)" v-if="modalStore.modalType === GlobalModalType.ChoseWallet" />
        <RegisterSteem v-if="modalStore.modalType === GlobalModalType.Register" />
        <CreateIPShareModal v-if="modalStore.modalType === GlobalModalType.CreateIPShare" />
        <CreatePredictModal v-if="modalStore.modalType === GlobalModalType.CreatePredict" />
        <ModifyCoinModal v-if="modalStore.modalType === GlobalModalType.ModifyCoin" />
        <CreateUserInfo v-if="modalStore.modalType === GlobalModalType.CreateUserInfo"/>
        <PredictTradeModal v-if="modalStore.modalType === GlobalModalType.PredictTrade"/>
        <PredictLiquidityModal v-if="modalStore.modalType === GlobalModalType.PredictLiquidity"/>
      </el-dialog>
    </main>
  </WrappedReactComponent>
</template>

<style scoped>

</style>
