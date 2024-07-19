<script setup lang="ts">
import { ref, onMounted, computed, reactive } from "vue";
import BondEthModal from "@/components/login/BondEthModal.vue";
import { useAccountStore } from "@/stores/web3";
import { EthWalletState } from "@/stores/web3";
import { CreateFee, ChainConfig, FeeAddress } from "@/config";
import { checkEns } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { useAccount } from "@/composables/useAccount";
import { transferBtcTo, getBalance } from "@/utils/wallets";
import { connectUnisat, signMessage, type BtcWallet } from "@/utils/btc";
import { getUserBitip } from "@/apis/api";

const accStore = useAccountStore();

const loading = ref(false);
const showInsufficientBalance = ref(false);
const showNoEns = ref(false);
const chosingBitip = ref(false);
const bitips = ref([]);
const btcWallet = ref<BtcWallet>();

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
    datetime?: number
}>({});

const step = computed(() => {
    if (chosingBitip.value) {
        return 3;
    }
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
    showInsufficientBalance.value = false;
    chosingBitip.value = false;
}

async function payToken() {
    resetTips()
    try {
        loading.value = true
        const balance = await getBalance(accStore.getAccountInfo!.ethAddr!);
        if (balance <= BigInt(CreateFee)) {
            showInsufficientBalance.value = true;
            return;
        }
        const hash = await transferBtcTo(FeeAddress, BigInt(CreateFee))
        identityInfo.assetId = hash;
        identityInfo.chainName = ChainConfig.name;
        identityInfo.type = 'payToken'
        await register();
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
            await register();
        }else {
            showNoEns.value = true
        }

    } catch (e) {
        handleErrorTip(e)
    } finally {
        loading.value = false
    }
}

async function selectBitip() {
    resetTips()
    loading.value = true
    try{
        const wallet = await connectUnisat()
        if (!wallet) return
        btcWallet.value = wallet
        const res: any = await getUserBitip(wallet.btcAddr)
        console.log(233, res, wallet.btcAddr)
        if (res && res.length > 0) {
            bitips.value = res.map((b: any) => b.content)
        }
        chosingBitip.value = true
    } catch (e) {
        handleErrorTip(e)
    } finally {
        loading.value = false
    }
}

async function choseBitip(bitip: string) {
    try{
        loading.value = true
        const message = JSON.stringify({
            bitip,
            btcAddr: btcWallet.value?.btcAddr,
            version: 1,
            datetime: Date.now()
        }, null, 4)
        const signature = await signMessage(message);
        identityInfo.chainName = 'BTC';
        identityInfo.type = 'bitip';
        identityInfo.assetId = bitip
        identityInfo.btcAddr = btcWallet.value?.btcAddr;
        identityInfo.btcPubkey = btcWallet.value?.btcPubkey;
        identityInfo.version = 1;
        identityInfo.signature = signature
        await register()

    } catch (e) {
        handleErrorTip(e)
    } finally {
        loading.value =false
    }
}

async function register() {

}

const openDonut = () => {
    window.open('https://bitip.social', '_blank')
}

onMounted(() => {});
</script>

<template>
  <BondEthModal v-if="step === 1" />
  <div v-else-if="step === 2" class="p-6">
    <div class="text-center text-base text-black font-normal mb-8">{{ $t("loginView.registerRequire") }}</div>
    <div class="flex flex-col items-center gap-4 mt-1.5rem">
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
              @click="payToken"
              :disabled="loading">
        <span class="text-white font-semibold">Pay {{ parseInt(CreateFee) / 1e18 }} BTC</span>
        <i-ep-loading v-show="loading" class="animate-spin" />
      </button>
      <div class="w-full">
        <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
                :class="showNoEns?'bg-grey-light':''"
                @click="choseEns"
                :disabled="loading">
          <span class="text-white font-semibold"> I have ENS </span>
          <i-ep-loading v-show="loading" class="animate-spin" />
        </button>
        <div v-show="showNoEns" class="text-center text-sm text-red-ff">
          {{ $t('loginView.noEns') }}
        </div>
        <div v-show="accountMismatch" class="text-center text-sm text-red-ff">
          {{ $t('web3.addressMismatch', { address: accStore?.getAccountInfo?.ethAddr??'**' }) }}
        </div>
      </div>
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
              @click="selectBitip"
              :disabled="loading">
        <span class="text-white font-semibold">I have BitIp</span>
        <i-ep-loading v-show="loading" class="animate-spin" />
      </button>
    </div>
  </div>
  <div v-if="step===3" class="flex flex-col min-h-[240px] gap-4">
    <div class="h-10 flex items-center justify-center relative">
      <button class="absolute top-0 left-0 h-10 w-10 min-w-10 bg-white rounded-full flex items-center justify-center"
              @click="step=2">
        <img src="~@/assets/icons/icon-back.svg" alt="">
      </button>
      <div class="text-h3 text-black text-center">
        {{$t('loginView.selectBitipTip')}}
      </div>
    </div>
        <div class="flex flex-wrap w-full space-x-5 px-3rem py-6">
          <button @click="choseBitip(bitip)" v-for="bitip of bitips" :key="bitip" :disabled="loading"
                  class="h-12 w-24 bg-gradient-primary text-black rounded-full flex justify-center items-center gap-2 mt-5">
            <span class="">{{ bitip }}</span>
            <i-ep-loading v-show="loading" class="animate-spin" />
          </button>
        </div>

        <div v-show="bitips.length == 0" class="mx-auto my-3 text-1rem">
          <span class="break-word gradient-text bg-purple-white light:bg-text-color17 ">
            {{$t('loginView.noBitip')}}
          </span>
          <span @click="openDonut" class="text-orange-normal cursor-pointer">
            Mint
          </span>
        </div>
      </div>
</template>
