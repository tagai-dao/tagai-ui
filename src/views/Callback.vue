<script setup lang="ts">
import { useUserStore } from "@/stores/privy";
import { useAccountStore } from "@/stores/web3";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { getWalletClient, signMessage } from "@/utils/wallets";
import { bondEth } from "@/apis/api";
import { BondEthMessage } from "@/config";

const privyStore = useUserStore();
const router = useRouter();
const accStore = useAccountStore();

onMounted(async () => {
  try {
    // 初始化iframe
    await privyStore.initPrivyIframe();
    await privyStore.waitForIframeInitialization();
    
    // 然后处理回调
    await privyStore.handleCallback();
    const accInfo = accStore.getAccountInfo;
    if (accInfo && (accInfo.walletType === 1 || !accInfo.ethAddr)) {
      await privyStore.initWallet();
      if (!accInfo.ethAddr) {
        // bind ethAddr for new login user
        const signature = await signMessage(BondEthMessage);
        if (!signature) {
          throw new Error('Signature is null')
        }
        await bondEth(accStore.ethConnectAddress, accInfo.twitterId, signature, BondEthMessage)
        accInfo.ethAddr = accStore.ethConnectAddress
        accStore.setAccount({
          ...accInfo,
          ethAddr: accStore.ethConnectAddress,
          walletType: 1
        })
      }
    } 
  } catch (error) {
    console.error('Error in callback processing:', error);
  }
  // 即使出错也跳转到之前的页面
  const path = localStorage.getItem('current-route')
  localStorage.removeItem('current-route')
  router.replace(path ?? '/')
});
</script>
<template>
  <div class="w-full h-full flex justify-center items-center">
    <img class="w-14 h-14 mr-3" src="~@/assets/loading.gif" alt="">
    <div>
      Waiting for login...
    </div>
  </div>

</template>