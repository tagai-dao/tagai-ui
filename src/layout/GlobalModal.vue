<script setup lang="ts">
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import CreateCoinModal from '@/components/common/CreateCoinModal.vue'
import CreateTweetModal from '@/components/common/CreateTweetModal.vue'
import CreateSpaceModal from '@/components/common/CreateSpaceModal.vue'
import AuthTwitter from '@/components/login/AuthTwitter.vue'
import BondEthModal from '@/components/login/BondEthModal.vue'
import ChoseWallet from '@/components/login/ChoseWallet.vue'
import RegisterSteem from '@/components/login/RegisterSteem.vue'
import CreateIPShareModal from '@/components/common/CreateIPShareModal.vue'
import CreatePredictModal from '@/components/common/CreatePredictModal.vue'
import ModifyCoinModal from '@/components/common/ModifyCoinModal.vue'
import CreateUserInfo from '@/components/login/CreateUserInfo.vue'
import PredictTradeModal from '@/components/common/PredictTradeModal.vue'
import PredictLiquidityModal from '@/components/common/PredictLiquidityModal.vue'

const modalStore = useModalStore()
</script>

<template>
  <!-- Keep modal reactivity in this Vue component, not the outer React slot
       containing the route outlet. Opening/closing it must not rebuild pages. -->
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
    <ChoseWallet @chosedWallet="modalStore.setModalVisible(false)" v-if="modalStore.modalType === GlobalModalType.ChoseWallet"/>
    <RegisterSteem v-if="modalStore.modalType === GlobalModalType.Register"/>
    <CreateIPShareModal v-if="modalStore.modalType === GlobalModalType.CreateIPShare"/>
    <CreatePredictModal v-if="modalStore.modalType === GlobalModalType.CreatePredict"/>
    <ModifyCoinModal v-if="modalStore.modalType === GlobalModalType.ModifyCoin"/>
    <CreateUserInfo v-if="modalStore.modalType === GlobalModalType.CreateUserInfo"/>
    <PredictTradeModal v-if="modalStore.modalType === GlobalModalType.PredictTrade"/>
    <PredictLiquidityModal v-if="modalStore.modalType === GlobalModalType.PredictLiquidity"/>
  </el-dialog>
</template>
