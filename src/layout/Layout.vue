<script setup lang="ts">
import {RouterView, useRouter} from "vue-router";
import TopBar from "@/layout/TopBar.vue";
import TabBar from "@/layout/TabBar.vue";
import Sidebar from "@/layout/Sidebar.vue";
import CreateCoinModal from "@/components/common/CreateCoinModal.vue";
import {useModalStore} from "@/stores/common";
import {type Account, GlobalModalType} from "@/types";
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import AuthTwitter from "@/components/login/AuthTwitter.vue";
import BondEthModal from "@/components/login/BondEthModal.vue";
import ChoseWallet from "@/components/login/ChoseWallet.vue";
import RegisterSteem from "@/components/login/RegisterSteem.vue";
import CreateIPShareModal from "@/components/common/CreateIPShareModal.vue";
import ModifyCoinModal from "@/components/common/ModifyCoinModal.vue";
import { onMounted, ref } from "vue";
import emitter from "@/utils/emitter";
import {applyPureReactInVue} from "veaury";
import ReactApp from "@/react_app/App.jsx";
import {useAccountStore} from "@/stores/web3";
import {handleErrorTip, notify} from "@/utils/notify";
import {usePrivyStore} from "@/stores/privy";
import { bondEth, twitterLogin } from "@/apis/api";
import { signMessage } from "@/utils/wallets";
import { BondEthMessage } from "@/config";
import { isAddress } from "viem";
import { useAccount } from "@/composables/useAccount";
import { sleep } from "@/utils/helper";

const router = useRouter();
const accStore = useAccountStore();
const { updateVPOP } = useAccount();
const privyStore = usePrivyStore();
const newLogin = ref(false);
const walletReady = ref(false);

const WrappedReactComponent = applyPureReactInVue(ReactApp);

const handleReactLoginSuccess = async (accInfo: any) => {
  console.log('accInfo', accInfo)
  accStore.setAccount(accInfo)
  
  updateVPOP().catch();
  newLogin.value = true;
  await setWallet()
}

// 只有当推特登录和钱包准备好了才需要设置钱包或者新绑定钱包
const setWallet = async () => {
  if (accStore.getAccountInfo?.twitterId && privyStore.ethersProvider && !walletReady.value) {
    try {
      const accounts = await privyStore.ethersProvider.request({
        method: 'eth_requestAccounts'
      });
      const connectedAddr = accounts[0]; 
      // check wallet type
      if (accStore.getAccountInfo.walletType === 0 && accStore.getAccountInfo.ethAddr && isAddress(accStore.getAccountInfo.ethAddr)) {
        return;
      } else if (accStore.getAccountInfo.walletType === 0 && !accStore.getAccountInfo.ethAddr) {
        await bondEthAddress()
      } else if (accStore.getAccountInfo.walletType === 1 && accStore.getAccountInfo.ethAddr !== connectedAddr) {
        // update ethAddr
        await bondEthAddress();
      } else {
        await privyStore.initWallet()
      }
    } catch (error) {
        handleErrorTip(error)
        await sleep(3)
    } finally {
      walletReady.value = true;
      if (newLogin.value) {
        router.replace(localStorage.getItem('current-route') || '/')
      }
    }
  }
}

const bondEthAddress = async () => {
    const accInfo = accStore.getAccountInfo;
    accInfo.ethAddr = accStore.ethConnectAddress
    accStore.setAccount({
      ...accInfo,
      ethAddr: accStore.ethConnectAddress,
      walletType: 1
    })

    await privyStore.initWallet()

    // bind ethAddr for new login user
    let signature = await signMessage(BondEthMessage);
    if (!signature) {
      throw new Error('Signature is null')
    }
    
    console.log('new bond address')
    await bondEth(accStore.ethConnectAddress, accInfo.twitterId, signature, BondEthMessage)
}
const handleReactLoginError = async () => {
  notify({
    title: 'Login failed',
    message: 'Please try again',
    type: 'error'
  });
  await sleep(3)
  router.replace(localStorage.getItem('current-route') || '/')
}

const handleWalletProvider = async (provider: any) => {
  usePrivyStore().ethersProvider = provider
  await setWallet()
}

const modalStore = useModalStore()

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
      <main class="w-full h-full flex flex-col max-w-[1000px] mx-auto">
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
                   :modal-class="['overlay-white', modalStore.modalType===GlobalModalType.Login?'modal-gradient-bg':'']"
                   class="max-w-[500px] rounded-[20px]"
                   width="90%" :show-close="false" align-center destroy-on-close>
          <CreateCoinModal v-if="modalStore.modalType===GlobalModalType.CreateCoin"/>
          <CreateTweetModal v-if="modalStore.modalType===GlobalModalType.CreateTweet"/>
          <CreateSpaceModal v-if="modalStore.modalType===GlobalModalType.CreateTweetSpace"/>
          <AuthTwitter v-if="modalStore.modalType===GlobalModalType.Login"/>
          <BondEthModal v-if="modalStore.modalType===GlobalModalType.BondEth"/>
          <ChoseWallet @chosedWallet="modalStore.setModalVisible(false)" v-if="modalStore.modalType === GlobalModalType.ChoseWallet" />
          <RegisterSteem v-if="modalStore.modalType === GlobalModalType.Register" />
          <CreateIPShareModal v-if="modalStore.modalType === GlobalModalType.CreateIPShare" />
          <ModifyCoinModal v-if="modalStore.modalType === GlobalModalType.ModifyCoin" />
        </el-dialog>
      </main>
    </main>
  </WrappedReactComponent>
</template>

<style scoped>

</style>
