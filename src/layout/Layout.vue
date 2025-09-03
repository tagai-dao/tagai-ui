<script setup lang="ts">
import {RouterView} from "vue-router";
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
import {notify} from "@/utils/notify";
import {useUserStore} from "@/stores/privy";

const WrappedReactComponent = applyPureReactInVue(ReactApp);

const handleReactLoginSuccess = async (data: any) => {
  useAccountStore().setAccount(
      {
        ...data,
        authLike: true,
        authPost: true
      } as Account)
}
const handleReactLoginError = async () => {
  notify({
    title: 'Login failed',
    message: 'Please try again',
    type: 'error'
  });
}

const handleWalletProvider = async (provider: any) => {
  await useUserStore().initWallet(provider)
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
