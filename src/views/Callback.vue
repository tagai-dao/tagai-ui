<script setup lang="ts">
import { useAccountStore } from "@/stores/web3";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { getWalletClient, signMessage } from "@/utils/wallets";
import { bondEth } from "@/apis/api";
import { BondEthMessage } from "@/config";

const router = useRouter();
const accStore = useAccountStore();

onMounted(async () => {
  try {
    
  } catch (error) {
    console.error('Error in callback processing:', error);
  }
  // 即使出错也跳转到之前保存的页面
  const path = localStorage.getItem('current-route') ?? '/'
  localStorage.removeItem('current-route')
  router.replace(path)
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