<script setup lang="ts">
import { ref, onMounted, computed, reactive, ErrorCodes } from "vue";
import BondEthModal from "@/components/login/BondEthModal.vue";
import { useAccountStore } from "@/stores/web3";
import { EthWalletState } from "@/stores/web3";
import { CreateFee, ChainConfig, FeeAddress, RegisterSteemMessage, SendPubKey } from "@/config";
import ErrCode from '@/errCode'
import { checkEns, registerSteem, checkFarcaster, getUserProfile } from "@/apis/api";
import { handleErrorTip, notify } from "@/utils/notify";
import { useAccount } from "@/composables/useAccount";
import { transferEthTo, signMessage as ethSignMessage } from "@/utils/wallets";
import { connectUnisat, signMessage, type BtcWallet } from "@/utils/btc";
import { getUserBitip, checkRegister, checkEthUsed } from "@/apis/api";
import { bytesToHex, reportLog, sleep } from "@/utils/helper";
import { box, generateSteemAuth, getBalance } from "@/utils/web3";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { checksumAddress } from "viem";
import { randomBytes } from '@noble/hashes/utils'
import type { Account } from "@/types";

const accStore = useAccountStore();

const loading = ref(false);
const showInsufficientBalance = ref(false);
const showNoEns = ref(false);
const showFidUsed = ref(false);
const showBondEthToFarcaster = ref(false);
const showFarcasterAuthFailed = ref(false);
const chosingBitip = ref(false);
const bitips = ref([]);
const btcWallet = ref<BtcWallet>();
const initializing = ref(true);
const acc = ref<Account | null>(null);

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
    datetime?: number,
    farcasterSignerUuid?: string,
    farcasterEthAddr?: string,
    farcasterName?: string,
    farcasterUsername?: string,
    farcasterAvatar?: string,
}>({});

const step = computed(() => {
  if (initializing.value) {
    return 5;
  }
  if (chosingBitip.value) {
      return 3;
  }
  if (acc.value?.inSteemWhiteList && acc.value?.ethAddr) {
    return 7;
  }
  if (acc.value?.twitterReputation && acc.value.twitterReputation >= 30 && acc.value?.ethAddr) {
    return 6;
  }
  if (
    !accStore.getAccountInfo.ethAddr ||
    accStore.ethConnectState !== EthWalletState.Connected
  ) {
    return 1;
  } else if (!accStore.getAccountInfo.steemId && !accStore.farcasterUser?.fid) {
    return 2;
  } else if(showBondEthToFarcaster.value) {
    return 4
  }
  return 2
});

const showChangeEthAddr = computed(() => {
  return accStore.farcasterUser?.ethAddr.toLocaleLowerCase() !== accStore.ethConnectAddress.toLowerCase();
})

function resetTips() {
    showNoEns.value = false;
    showInsufficientBalance.value = false;
    chosingBitip.value = false;
    showFidUsed.value = false;
    showBondEthToFarcaster.value = false;
    showFarcasterAuthFailed.value = false;
}

async function payToken() {
    resetTips()
    try {
        loading.value = true
        const payTokenHash = localStorage.getItem('payTokenHash')
        if (payTokenHash) {
            identityInfo.assetId = payTokenHash;
            identityInfo.chainName = ChainConfig.name;
            identityInfo.type = 'payToken'
            await register();
        }else {
          const balance = await getBalance(accStore.getAccountInfo!.ethAddr! as `0x${string}`);
          if (balance <= BigInt(CreateFee)) {
              showInsufficientBalance.value = true;
              return;
          }
          useModalStore().setModalCloseEnable(false);
          const hash = await transferEthTo(FeeAddress, BigInt(CreateFee))

          reportLog('register_steem_step_1', {
            hash,
            identityInfo: identityInfo,
            twitterId: accStore.getAccountInfo?.twitterId
          })
          if (!hash) {
            throw new Error('Failed to transfer BNB');
          }

          localStorage.setItem('payTokenHash', hash)
          identityInfo.assetId = hash;
          identityInfo.chainName = ChainConfig.name;
          identityInfo.type = 'payToken'
          await register();
        }
    } catch (error) {
        handleErrorTip(error)
        loading.value = false
    }finally{
        useModalStore().setModalCloseEnable(true);
        loading.value = false
    }
}

// register with twitter reputaion
async function sign() {
  try {
      if (accStore.ethConnectState !== EthWalletState.Connected) {
        useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
        return;
      }
        loading.value = true
        identityInfo.assetId = acc.value?.twitterReputation?.toString() ?? "0";
        identityInfo.chainName = ChainConfig.name;
        if (step.value === 6) {
          identityInfo.type = 'reputation'
        } else if (step.value === 7) {
          identityInfo.type = 'whitelist'
        }
        await register();
    } catch (error) {
        handleErrorTip(error)
        loading.value = false
    }finally{
        useModalStore().setModalCloseEnable(true);
    }
}

async function register() {
  loading.value = true
  const twitterId = accStore.getAccountInfo?.twitterId
  try {
    let count = 0
    while (accStore.ethConnectState == EthWalletState.Connecting && count < 5) {
      await sleep(1)
      count++;
    }
    reportLog('register_steem_step_2', {
      step: 2,
      twitterId
    })
    useModalStore().setModalCloseEnable(false);
    const signature = await ethSignMessage(RegisterSteemMessage)
    
    reportLog('register_steem_step_3', {
      step: 3,
      signature,
      twitterId
    })
    if (!signature) {
      throw new Error('Failed to sign message');
    }
    const account = accStore.getAccountInfo
    const salt = bytesToHex(randomBytes(4));
    const steemAccount = generateSteemAuth(signature.replace("0x", "") + salt);

    reportLog('register_steem_step_4', {
      step: 4,
      salt,
      twitterId
    })
    let params = box(steemAccount);

    reportLog('register_steem_step_5', {
      step: 5,
      twitterId,
      ...params
    })
    let createForm = {
      twitterId: account.twitterId,
      pwd: params.pwd,
      sendNonce: params.sendNonce,
      sendPubKey: params.sendPubKey,
      ethAddr: account.ethAddr ?? accStore.ethConnectAddress ?? '',
      salt,
      identityInfo,
      signature
    }
    
    await registerSteem(createForm);
    accStore.setAccount({
      ...accStore.getAccountInfo,
      ethAddr: checksumAddress(account.ethAddr as `0x${string}` ?? accStore.ethConnectAddress as `0x${string}`),
      fid: accStore.farcasterUser?.fid,
      isAuthFarcaster: true,
      farcasterName: accStore.farcasterUser?.name,
      steemId: account.twitterUsername
    })
    accStore.farcasterUser = null;
    localStorage.removeItem('payTokenHash')
    useModalStore().setModalCloseEnable(true);
    useModalStore().setModalVisible(false)
  } catch (error) {
    if(error === ErrCode.TRANSACTION_INVALID) {
      localStorage.removeItem('payTokenHash')
    }
    console.error(error)
    reportLog('register_steem_error', {
      error,
      identityInfo,
      twitterId
    })
    handleErrorTip(error)
  } finally{
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
        const datetime = Date.now();
        let message = JSON.stringify({
            bitip,
            btcAddr: btcWallet.value?.btcAddr,
            version: 1,
            datetime
        }, null, 4)
        const signature = await signMessage(message);

        identityInfo.chainName = 'BTC';
        identityInfo.type = 'bitip';
        identityInfo.assetId = bitip
        identityInfo.btcAddr = btcWallet.value?.btcAddr;
        identityInfo.btcPubkey = btcWallet.value?.btcPubkey;
        identityInfo.version = 1;
        identityInfo.signature = signature;
        identityInfo.datetime = datetime;
        await register()

    } catch (e) {
        handleErrorTip(e)
    } finally {
        loading.value =false
    }
}

async function signInFarcasterEth() {
  resetTips()
  showBondEthToFarcaster.value = true
    try {
        loading.value = true

        identityInfo.farcasterEthAddr = checksumAddress(accStore.ethConnectAddress as `0x${string}`);
        identityInfo.farcasterName = accStore.farcasterUser?.name;
        identityInfo.farcasterUsername = accStore.farcasterUser?.username;
        identityInfo.farcasterSignerUuid = accStore.farcasterUser?.signerUuid;
        identityInfo.assetId = accStore.farcasterUser?.fid;

        identityInfo.farcasterAvatar = accStore.farcasterUser?.avatar;
        identityInfo.chainName = ChainConfig.name;
        identityInfo.type = 'farcaster'
        await register();
    } catch (error) {
        handleErrorTip(error)
    }finally{
        loading.value = false
    }
}


const openDonut = () => {
    window.open('https://bitip.social', '_blank')
}

onMounted(async () => {
  try {
    acc.value = await getUserProfile(accStore.getAccountInfo.twitterId) as Account | null
    const payTokenHash = localStorage.getItem('payTokenHash')
    if (payTokenHash) {
        identityInfo.assetId = payTokenHash;
        identityInfo.chainName = ChainConfig.name;
        identityInfo.type = 'payToken'
        await register();
    }
  } catch (error) {
    acc.value = null
  }
  initializing.value = false
});
</script>

<template>
  <BondEthModal v-if="step === 1" />
  <div v-else-if="step === 2" class="p-6">
    <div v-show="!accStore.getAccountInfo.steemId" class="text-center text-base text-black font-normal mb-8">{{ $t("loginView.registerRequire") }}</div>
    <div class="flex flex-col items-center gap-4 mt-1.5rem">
      <div class="w-full" v-if="!accStore.getAccountInfo.steemId">
        <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
                :class="showNoEns?'bg-grey-light':''"
                @click="payToken"
                :disabled="loading || accountMismatch">
          <span class="text-white font-semibold">{{ $t('pay') }} {{ parseInt(CreateFee) / 1e18 }} BNB</span>
          <i-ep-loading v-show="loading" class="animate-spin" />
        </button>
        <div v-show="showInsufficientBalance" class="text-center text-sm text-red-e6">
          {{ $t('errMessage.insufficientFee') }}
        </div>
        <div v-show="accountMismatch" class="text-center text-sm text-red-e6">
          {{ $t('web3.addressMismatch', { address: accStore?.getAccountInfo?.ethAddr??'**' }) }}
        </div>
      </div>
      <!-- <div class="w-full">
        <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
                :class="showNoEns?'bg-grey-light':''"
                @click="choseEns"
                :disabled="loading || accountMismatch">
          <span class="text-white font-semibold"> I have ENS </span>
          <i-ep-loading v-show="loading" class="animate-spin" />
        </button>
        <div v-show="showNoEns" class="text-center text-sm text-red-e6">
          {{ $t('loginView.noEns') }}
        </div>
        <div v-show="accountMismatch" class="text-center text-sm text-red-e6">
          {{ $t('web3.addressMismatch', { address: accStore?.getAccountInfo?.ethAddr??'**' }) }}
        </div>
      </div> -->
      <button v-if="!accStore.getAccountInfo.steemId" class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
              @click="selectBitip"
              :disabled="loading">
        <span class="text-white font-semibold">{{ $t('loginView.haveBitIP') }}</span>
        <i-ep-loading v-show="loading" class="animate-spin" />
      </button>
    </div>
  </div>
  <div v-if="step===3" class="flex flex-col min-h-[240px] gap-4">
    <div class="h-10 flex items-center justify-center relative">
      <button class="absolute top-0 left-0 h-10 w-10 min-w-10 bg-white rounded-full flex items-center justify-center"
              @click="chosingBitip=false">
        <img src="~@/assets/icons/icon-back.svg" alt="">
      </button>
      <div class="text-h3 text-black text-center">
        {{$t('loginView.selectBitipTip')}}
      </div>
    </div>
        <div class="flex flex-wrap w-full space-x-5 px-3rem py-6">
          <button @click="choseBitip(bitip)" v-for="bitip of bitips" :key="bitip" :disabled="loading"
                  class="h-12 bg-gradient-primary text-black rounded-full flex justify-center items-center gap-2 mt-5 px-6">
            <span class="">{{ bitip }}</span>
            <i-ep-loading v-show="loading" class="animate-spin" />
          </button>
        </div>

        <div v-show="bitips.length == 0" class="mx-auto my-3 text-1rem">
          <span class="break-word gradient-text bg-purple-white light:bg-text-color17 ">
            {{$t('loginView.noBitip')}}
          </span>
          <span @click="openDonut" class="text-orange-normal cursor-pointer">
            {{ $t('loginView.mint') }}
          </span>
        </div>
      </div>
    <div v-if="step === 4" class="flex flex-col min-h-[240px] gap-4">
      <button class="absolute top-4 left-4 h-10 w-10 min-w-10 bg-white rounded-full flex items-center justify-center"
              @click="showBondEthToFarcaster = false">
        <img src="~@/assets/icons/icon-back.svg" alt="">
      </button>
        <div class="flex justify-center items-center mt-6">
          <img :src="accStore.farcasterUser?.avatar" alt="" style="object-fit: cover" class="w-16 h-16 rounded-full">
        </div>
        <div class="text-h3 text-black text-center">
            {{ accStore.farcasterUser?.name }}@{{ accStore.farcasterUser?.username }}
          </div>
        <p v-if="showFidUsed" class="text-center text-sm text-red-e6">
          {{$t('loginView.fidUsedTip')}}
        </p>
        <div v-else class="w-full mt-6">
          <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2"
                @click="signInFarcasterEth"
                :disabled="loading || accountMismatch">
            <span class="text-white font-semibold">
              {{ $t("loginView.bond") }}
            </span>
            <i-ep-loading v-show="loading" class="animate-spin" />
          </button>
          <div v-show="accountMismatch" class="text-center text-sm text-red-e6">
            {{ $t('web3.addressMismatch', { address: accStore?.getAccountInfo?.ethAddr??'**' }) }}
          </div>
        </div>
    </div>
    <div v-if="step === 5" class="flex flex-col min-h-[240px] items-center justify-center gap-4">
      <div class="text-h3 text-black text-center">
        <img src="~@/assets/loading.gif" alt="">
      </div>
    </div>
    <div v-if="step === 6" class="flex flex-col min-h-[240px] items-center justify-center gap-4">
      <div class="text-h3 text-black text-center mt-5">
        {{$t('loginView.registerSteemMessage')}}
        </div>
      <div class="w-full">
        <textarea class="w-full h-32 p-2 my-5 text-h3 text-gray-700 border border-gray-300 rounded" v-model="RegisterSteemMessage" readonly></textarea>
        <button class="h-12 w-full mb-5 bg-gradient-primary rounded-full flex justify-center items-center gap-2" @click="sign" 
        :disabled="loading || accountMismatch">
          <span class="text-white font-semibold">
            {{ (accStore.ethConnectAddress ? $t("loginView.bond") : $t('connect')) }}
          </span>
          <i-ep-loading v-show="loading" class="animate-spin" />
        </button>
        <div v-show="accountMismatch" class="text-center text-sm text-red-e6">
          {{ $t('web3.addressMismatch', { address: accStore?.getAccountInfo?.ethAddr??'**' }) }}
        </div>
      </div>
    </div>

    <div v-if="step === 7" class="flex flex-col min-h-[240px] items-center justify-center gap-4">
      <div class="text-h3 text-black text-center mt-5">
        {{$t('loginView.createSocialAccount')}}
        </div>
      <div class="w-full">
        <textarea class="w-full h-32 p-2 my-5 text-h3 text-gray-700 border border-gray-300 rounded" v-model="RegisterSteemMessage" readonly></textarea>
        <button class="h-12 w-full mb-5 bg-gradient-primary rounded-full flex justify-center items-center gap-2" @click="sign" 
        :disabled="loading || accountMismatch">
          <span class="text-white font-semibold">
            {{ (accStore.ethConnectAddress ? $t("loginView.bond") : $t('connect')) }}
          </span>
          <i-ep-loading v-show="loading" class="animate-spin" />
        </button>
        <div v-show="accountMismatch" class="text-center text-sm text-red-e6">
          {{ $t('web3.addressMismatch', { address: accStore?.getAccountInfo?.ethAddr??'**' }) }}
        </div>
      </div>
    </div>
</template>
