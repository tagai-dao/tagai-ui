<script setup lang="ts">
import {onMounted, ref} from "vue";
import {handleErrorTip} from "@/utils/notify";
import { onUnmounted } from "vue";
import { useUserStore } from "@/stores/privy";

const logging = ref(false);
const privyStore = useUserStore()

/**
 * Login with privy
 */
async function login() {
  try {
    logging.value = true
    await privyStore.waitForIframeInitialization();

    await privyStore.loginWithTwitter();
  } catch (e) {
    handleErrorTip(e);
  }
}

onMounted(() => {
  privyStore.initPrivyIframe().catch(e => {

  });
})

onUnmounted(() => {
  logging.value = false
})
</script>

<template>
  <div class="flex flex-col justify-center min-h-[240px] py-6 px-4">
    <div class="flex flex-col gap-y-[48px]">
      <div class="flex items-center gap-8 justify-center">
        <img class="w-12 min-w-12 object-center object-contain" src="~@/assets/logo.png" alt="">
        <img class="w-10 min-w-10 object-center object-contain" src="~@/assets/icons/icon-login-arrow.svg" alt="">
        <img class="w-8 min-w-8 object-center object-contain" src="~@/assets/icons/icon-x.svg" alt="">
      </div>
      <div class="flex flex-col gap-2">
        <!-- <div>{{$t('loginView.authTwitterTip')}}</div> -->
        <div class="">
          <!-- <el-checkbox :label="$t('loginView.authLikeTip')" v-model="authLike" />
          <el-checkbox :label="$t('loginView.authPostTip')" v-model="authPost" /> -->
        </div>
        <button @click="login" :disabled="logging"
                class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2">
          <span class="text-white text-h5">
            {{$t('loginView.loginWithTwitter')}}
          </span>
          <i-ep-loading v-if="logging" class="animate-spin text-white"/>
        </button>
      </div>

      <div class="text-lg text-center text-grey-normal text-weight-bold flex justify-center items-center gap-2">
        Protected by
        <img class="w-22 h-5" src="~@/assets/icons/privy-logo.png" alt="">
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
