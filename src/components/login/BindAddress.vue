<script setup lang="ts">
import { useAccountStore } from "@/stores/web3";
import { ref, watch } from "vue";
import { ethers } from "ethers";
import { checkEthUsed, bondEth } from '@/apis/api'
import { BondEthMessage } from '@/config'
import { signMessage } from "@/utils/wallets";
import { handleErrorTip } from "@/utils/notify";
import { useModalStore } from "@/stores/common";

const accStore = useAccountStore();
const loading = ref(false);
const ethAddrUsed = ref(false);

async function checkEth(address: string): Promise<boolean> {
  if (ethers.isAddress(address)) {
      loading.value = true
      // check if address been bonded
      try {
        const acc: any = await checkEthUsed(address);
        if (acc.twitterId) {
          ethAddrUsed.value = true;
          return true
        } else {
          ethAddrUsed.value = false;
          return false
        }
      } catch (error) {
        console.error(error);
        handleErrorTip(error);
        return false
      } finally {
        loading.value = false;
      }
    }
    return false
}

watch(() => accStore.ethConnectAddress, (address) => {
  checkEth(address)
})

async function confirm() {
  try{
    loading.value = true;
    if((await checkEth(accStore.ethConnectAddress))) {
      return;
    }
    const signature = await signMessage(BondEthMessage);
    await bondEth(accStore.ethConnectAddress, accStore.getAccountInfo!.twitterId, signature, BondEthMessage)
    accStore.getAccountInfo!.ethAddr = accStore.ethConnectAddress
    accStore.setAccount({
      ...accStore.getAccountInfo!,
      ethAddr: accStore.ethConnectAddress
    })
    useModalStore().setModalVisible(false)
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col min-h-[240px] py-6 px-4 gap-7">
    <div class="text-h2 text-black text-center">
      {{$t('loginView.bindAddress')}}
    </div>
    <div class="text-base text-center">
      {{$t('loginView.bindAddressTip')}}
    </div>
    <div class="flex flex-col w-full items-center px-8">
      <div class="text-base text-center text-red-e6 break-all">
        {{ accStore.ethConnectAddress }}
      </div>
    </div>
    <div class="px-5">
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-4"
        @click="confirm"
        :disabled="loading">
        <span class="text-h5 text-white">{{$t('confirm')}}</span>
        <i-ep-loading v-if="loading" class="animate-spin text-white"/>
      </button>
      <div v-show="ethAddrUsed" class="text-base text-center text-red-e6 mt-3">{{ $t('loginView.addressUsed') }}</div>
      <!-- <div class="text-base text-center text-red-e6 mt-3">钱包地址不匹配，请重新绑定</div> -->
    </div>
  </div>
</template>

<style scoped>

</style>
