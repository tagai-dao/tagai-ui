<script setup lang="ts">
import {RouterView} from "vue-router";
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
import ModifyCoinModal from "@/components/common/ModifyCoinModal.vue";
import BindSolAddress from "@/components/login/BindSolAddress.vue";
import Sidebar from "@/layout/Sidebar.vue";
const modalStore = useModalStore()
</script>

<template>
  <main class="w-full h-full flex">
    <!-- <Sidebar class="hidden web:block"></Sidebar> -->
    <main class="w-full h-full flex flex-col max-w-[1200px] mx-auto">
      <TopBar v-show="$route.meta.topBar"/>
      <div class="flex-1 overflow-hidden">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" v-if="$route.meta.keepAlive" :key="$route.name"/>
          </keep-alive>
          <component :is="Component" v-if="!$route.meta.keepAlive"/>
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
        <BindSolAddress v-if="modalStore.modalType===GlobalModalType.BondSol"/>
        <ChoseWallet @chosedWallet="modalStore.setModalVisible(false)" v-if="modalStore.modalType === GlobalModalType.ChoseWallet" />
        <RegisterSteem v-if="modalStore.modalType === GlobalModalType.Register" />
        <CreateIPShareModal v-if="modalStore.modalType === GlobalModalType.CreateIPShare" />
        <ModifyCoinModal v-if="modalStore.modalType === GlobalModalType.ModifyCoin" />
      </el-dialog>
    </main>
  </main>
</template>

<style scoped>

</style>
