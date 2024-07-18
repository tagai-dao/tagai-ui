<script setup lang="ts">
import { ref, onMounted, computed, reactive } from "vue";
import BondEthModal from "@/components/login/BondEthModal.vue";
import { useAccountStore } from "@/stores/web3";
import { EthWalletState } from "@/stores/web3";
import { CreateFee, ChainConfig, FeeAddress } from "@/config";
import { checkEns } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { useAccount } from "@/composables/useAccount";
import { transferBtcTo } from "@/utils/wallets";

const accStore = useAccountStore();

const loading = ref(false);
const showNoEns = ref(false);

const { accountMismatch } = useAccount();

const identityInfo = reactive<{
    bitip?: string,
    btcAddr?: string,
    btcPubkey?: string,
    version?: number,
    signature?: string,
    chainName?: string,
    type?: string,
    assetId?: string,
    datetime?: string
}>({});

const step = computed(() => {
  if (
    !accStore.getAccountInfo.ethAddr ||
    accStore.ethConnectState !== EthWalletState.Connected
  ) {
    return 1;
  } else if (!accStore.getAccountInfo.steemId) {
    return 2;
  }
});

function resetTips() {
    showNoEns.value = false;
}

async function payToken() {
    resetTips()
    try {
        loading.value = true
        const hash = await transferBtcTo(FeeAddress, BigInt(CreateFee))
        console.log(3, hash)
    } catch (error) {
        handleErrorTip(error)
    }finally{
        loading.value = false
    }
}

async function choseEns() {
    resetTips()
    try{
        loading.value = true;
        const name = await checkEns(accStore.getAccountInfo.ethAddr ?? '')
        if (name) {
            identityInfo.chainName = 'ETH';
            identityInfo.type = 'ens';
            identityInfo.assetId = name as string;
            showNoEns.value = false
            // resister
        }else {
            showNoEns.value = true
        }

    } catch (e) {
        handleErrorTip(e)
    } finally {
        loading.value = false
    }
}

async function choseBitip() {
    resetTips()
}

onMounted(() => {});
</script>

<template>
  <BondEthModal v-if="step === 1" />
  <div v-else-if="step === 2" class="p-6">
    <div class="">{{ $t("loginView.registerRequire") }}</div>
    <div class="flex flex-col items-center gap-4 mt-1.5rem">
      <button
        class="w-full flex justify-center items-center align-center max-w-300px h-48px font-bold text-16px border-1 gradient-border rounded-full hover:shadow-none"
        @click="payToken"
         :disabled="loading"
      >
        <span>
            Pay {{ parseInt(CreateFee) / 1e18 }} BTC
        </span>
        <i-ep-loading v-show="loading" class="animate-spin" />
      </button>
      <div class="w-full">
        <button
          class="w-full flex justify-center items-center align-center max-w-300px h-48px font-bold text-16px border-1 gradient-border rounded-full hover:shadow-none"
          @click="choseEns"
          :disabled="loading"
        >
          <div class="flex justify-center align-center items-center">
            <span> I have ENS </span>
            <i-ep-loading v-show="loading" class="animate-spin" />
          </div>
          <div v-show="accountMismatch">
          {{ $t('web3.addressMismatch', { address: accStore.getAccountInfo.ethAddr }) }}
          </div>
          <div v-show="showNoEns" class="text-red-ff text-sm">
            {{ $t('loginView.noEns') }}
          </div>
        </button>
      </div>
      <button
        class="w-full flex justify-center items-center align-center max-w-300px h-48px font-bold text-16px border-1 gradient-border rounded-full hover:shadow-none"
        @click="choseBitip"
         :disabled="loading"
      >
        <span class="">I have BitIp</span>
        <i-ep-loading v-show="loading" class="animate-spin" />
      </button>
    </div>
  </div>
</template>
