<script setup lang="ts">
import {RouterView, useRouter} from "vue-router";
import TopBar from "@/layout/TopBar.vue";
import TabBar from "@/layout/TabBar.vue";
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
import {onMounted, ref} from "vue";
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
  await setWallet()
  console.log('login account info', accInfo);
  if (accInfo.accountType === 1 && accInfo.isNew === 1) {
    // api 获取用户信息，如果是新用户（username为空），则创建用户，弹出login/CreateUserInfo组件
    // 如果用户已创建，将用户信息accStore.setAccount，并调用setWallet
    modalStore.setModalVisible(true, GlobalModalType.CreateUserInfo)
    return;
  }
  
}

// 只有当推特登录和钱包准备好了才需要设置钱包或者新绑定钱包
const setWallet = async () => {
  if (accStore.getAccountInfo?.twitterId && privyStore.ethersProvider) {
    try {
      accStore.ethConnectState = EthWalletState.Connecting;
      walletReady.value = true;
      const accounts = await privyStore.ethersProvider.request({
        method: 'eth_requestAccounts'
      });
      const connectedAddr = accounts[0]; 
      console.log('connected wallet', connectedAddr)
      console.log('accStore.getAccountInfo', accStore.getAccountInfo)
      // check wallet type
      if (accStore.getAccountInfo.walletType === 0 && accStore.getAccountInfo.ethAddr && isAddress(accStore.getAccountInfo.ethAddr)) {
        // user connect wallet plugin by manual
        accStore.ethConnectState = EthWalletState.Disconnect;
      } else if (accStore.getAccountInfo.walletType === 0 && !accStore.getAccountInfo.ethAddr) {
        await useAccount().bondEthAddress()
      } else if (accStore.getAccountInfo.walletType === 1 && accStore.getAccountInfo.ethAddr !== connectedAddr) {
        // update ethAddr
        await useAccount().bondEthAddress();
      } else {
        await privyStore.initWallet()
      }

      if (modalStore.modalType !== GlobalModalType.CreateUserInfo) {
        modalStore.setModalVisible(false);
      }
    } catch (error) {
        console.error('Failed to set wallet:', error)
        handleErrorTip(error)
        await sleep(3)
    } finally {
      if (newLogin.value) {
        router.replace(localStorage.getItem('current-route') || '/')
      }
    }
  }
}

const handleReactLoginError = async () => {
  notify({
    title: 'Login failed',
    message: 'Please try again',
    type: 'error'
  });
  console.error('Failed to login tip')
  await sleep(1)
  accStore.clear();
  router.replace(localStorage.getItem('current-route') || '/')
}

const handleWalletProvider = async (provider: any) => {
  console.log('init privy provider', provider)
  usePrivyStore().ethersProvider = provider
  await setWallet()
}

const cachedComponents = ref(['HomeView'])
onMounted( () => {
  emitter.on('authSuccess', handleReactLoginSuccess);
  emitter.on('authError', handleReactLoginError);
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
    <main class="w-full h-full ">
      <main class="w-full h-full flex flex-col max-w-[1000px] mx-auto relative">
        <TopBar v-show="$route.meta.topBar"/>
        <div class="flex-1 overflow-hidden">
          <router-view v-slot="{ Component }">
            <keep-alive :include="cachedComponents">
              <component :is="Component" :key="$route.name"/>
            </keep-alive>
          </router-view>
        </div>
        <TabBar class="web:hidden" v-if="$route.meta.tabBar"/>
        <el-dialog v-model="modalStore.modalVisible"
                   :close-on-click-modal="modalStore.modalCloseEnable"
                   :close-on-press-escape="modalStore.modalCloseEnable"
                   :modal-class="`overlay-white ${modalStore.modalType===GlobalModalType.Login?'modal-gradient-bg':''}`"
                   class="max-w-[500px] rounded-[20px]"
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
        </el-dialog>
      </main>
    </main>
  </WrappedReactComponent>
</template>

<style scoped>

</style>
