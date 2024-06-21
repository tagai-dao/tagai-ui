<template>
  <div class="border-1 border-white rounded-12px p-3 flex flex-col justify-center items-center gap-5
              md:max-w-35rem cursor-pointer">
    <div class="text-xl 2xl:text-30px">{{ goods?.spacedRune }}</div>
    <button @click.stop="showMint" class="bg-primaryGradient h-[40px] min-w-[120px] rounded-full text-xl text-black font-IBMPlexMonoBold">
      Mint
    </button>

    <runes-modal v-model="showRunesMintModal"
      :rune="goods"
      type='comment'
      :connector='null'
      :tweetId="tweetId"
      @close="showRunesMintModal=false"
      align-center>
    </runes-modal>
    <el-dialog v-model="showConnectBtc"
            width="500"
            align-center
            title="Connect">
        <ConnectBtcBtn @close="showConnectBtc = false" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { WalletState, useAccountStore } from "@/store/web3";
import { ref } from 'vue'

const props = defineProps(['goods', 'tweetId'])
const showRunesMintModal = ref(false)
const showConnectBtc = ref(false)
const accStore = useAccountStore()

function showMint() {
  if ((accStore.connectState == WalletState.Disconnect) || (accStore.connectState == WalletState.WrongAddress)) {
        showConnectBtc.value = true
        return;
    }
  showRunesMintModal.value = true
}
</script>

<style scoped>

</style>
