<script setup lang="ts">
import {ref} from "vue";
import {EthWalletState, useAccountStore, useIpshareData} from "@/stores/web3";
import ChoseWallet from "../login/ChoseWallet.vue";
import BondEthModal from '../login/BondEthModal.vue';
import {useModalStore} from "@/stores/common";
import { useAccount } from "@/composables/useAccount";
import { create } from "@/utils/ipshare";
import { getIPshareSupplies, getIPshareBalances } from "@/utils/ipshareAsset";
import { handleErrorTip } from "@/utils/notify";
import errCode from "@/errCode";

const acc = useAccountStore().getAccountInfo;
const modalStore = useModalStore();
const ipshareStore = useIpshareData();
const { accountMismatch } = useAccount();

const step = ref(1)
const creating = ref(false)

async function createIPShare() {
  try{
    creating.value = true;
    const hash = await create(acc.ethAddr!);
    if (!hash) {
      handleErrorTip(errCode.PARAMS_ERROR)
      return;
    }

    // 立即更新 store，让 UI 响应式刷新
    const ethAddr = acc.ethAddr!;
    useAccountStore().ipshare = {
      ethAddr,
      shareSupply: 10,
      created: true
    };
    ipshareStore.saveIPshareSupplies({ [ethAddr]: 10 });

    modalStore.setModalVisible(false)

    // 异步从链上拉取最新数据，无需阻塞 UI
    Promise.all([
      getIPshareSupplies([ethAddr]),
      getIPshareBalances([ethAddr])
    ]).catch(e => console.error('Refresh IPShare data after creation failed:', e));
  } catch (e) {
    handleErrorTip(e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <chose-wallet v-if="useAccountStore().ethConnectState == EthWalletState.Disconnect" />
  <BondEthModal v-else-if="!useAccountStore().getAccountInfo.ethAddr" />
  <div v-else class="flex flex-col gap-y-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('ipshare.createIpShare') }}</span>
      <img class="cursor-pointer" src="~@/assets/icons/icon-modal-close.svg" alt=""
           @click="modalStore.setModalVisible(false)"/>
    </div>
    <div v-if="step===1" class="pb-4 flex flex-col gap-4">
      <div class="min-h-20 text-center flex flex-col justify-center items-center gap-4">
        <div class="break-words text-sm text-center text-grey-normal">
          {{ $t('ipshare.desc') }}
        </div>
      </div>
      <!-- <div class="flex justify-center gap-10">
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-orange-normal">
          <span class="text-gradient bg-gradient-primary font-bold text-lg">1</span>
        </button>
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-grey-light">
          <span class="text-grey-light-active font-bold text-lg">2</span>
        </button>
      </div> -->
      <div class="flex justify-center">
        <button class="h-12 w-[80%] bg-gradient-primary text-white font-bold rounded-full text-lg
                      flex items-center justify-center gap-2 disabled:opacity-30"
                @click="createIPShare" :disabled="creating || accountMismatch">
          <span>{{ (useAccountStore().ethConnectState == EthWalletState.Disconnect && acc?.walletType != 1) ? $t('connect') : $t('create') }}</span>
          <i-ep-loading v-if="creating || useAccountStore().ethConnectState == EthWalletState.Connecting" class="animate-spin" />
        </button>
      </div>
      <div v-if="useAccountStore().ethConnectState === EthWalletState.Connected && accountMismatch" class="text-sm text-center text-grey-normal">
          {{ $t('web3.addressMismatch', {address: useAccountStore().getAccountInfo.ethAddr}) }}
        </div>
    </div>
    <!-- <div v-if="step===2" class="pb-6 flex flex-col gap-4">
      <div class="min-h-20 text-center flex flex-col justify-center items-center">
        <span class="text-3xl font-extrabold text-gradient bg-gradient-primary">
          创建成功！
        </span>
      </div>
      <div class="flex justify-center gap-10">
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-grey-light">
          <span class="text-grey-light-active font-bold text-lg">1</span>
        </button>
        <button class="w-10 min-w-10 h-10 min-h-10 rounded-full border-[1px] border-orange-normal">
          <span class="text-gradient bg-gradient-primary font-bold text-lg">2</span>
        </button>
      </div>
      <div class="flex justify-center">
        <button class="h-12 w-[80%] bg-gradient-primary text-white font-bold rounded-full text-lg
                      flex items-center justify-center gap-2 disabled:opacity-30"
                @click="step=1">
          <span>Tweet</span>
          <i-ep-loading class="animate-spin" />
        </button>
      </div>
    </div> -->
  </div>
</template>

<style scoped>
</style>
