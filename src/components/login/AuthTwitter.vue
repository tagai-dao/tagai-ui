<script setup lang="ts">
import {useAccountStore} from "@/stores/web3";
import {useModalStore, useStateStore} from "@/stores/common";
import {ref} from "vue";
import {twitterAuth, twitterLogin} from "@/apis/api";
import {sleep} from "@/utils/helper";
import type {Account} from "@/types";
import emitter from "@/utils/emitter";
import {handleErrorTip} from "@/utils/notify";
import {LoginStepType, useLoginStore} from "@/stores/login";
import { useRoute } from "vue-router";
import { onUnmounted } from "vue";
import { useUserStore } from "@/stores/privy";

const accStore = useAccountStore();
const stateStore = useStateStore();
const logging = ref(false);
const route = useRoute();
const modalStore = useModalStore()
const authLike = ref(true)
const authPost = ref(true)

/**
 * Login with privy
 */
async function login() {
  try {
    logging.value = true
    const privyStore = useUserStore()
    await privyStore.initPrivyIframe();
    await privyStore.waitForIframeInitialization();

    await privyStore.loginWithTwitter();
  } catch (e) {
    handleErrorTip(e);
    useLoginStore().setLoginStep(LoginStepType.CreateWallet)
  }
}

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
