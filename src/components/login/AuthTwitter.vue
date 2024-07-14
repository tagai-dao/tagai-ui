<script setup lang="ts">
import {useAccountStore} from "@/stores/web3";
import {useModalStore, useStateStore} from "@/stores/common";
import {useTimer} from "@/composables/useTools";
import {ref} from "vue";
import {twitterAuth, twitterLogin} from "@/apis/api";
import {sleep} from "@/utils/helper";
import type {Account} from "@/types";
import emitter from "@/utils/emitter";
import {handleTransError} from "@/utils/notify";
import {LoginStepType, useLoginStore} from "@/stores/login";

const accStore = useAccountStore();
const stateStore = useStateStore();
const setTimer = useTimer();
const logging = ref(false);

async function login() {
  try{
    logging.value = true
    let isIOS = navigator.userAgent.toUpperCase().indexOf('IPHONE') >= 0
    let isAndroid = navigator.userAgent.toUpperCase().indexOf('ANDROID') >= 0

    const res = await twitterAuth(stateStore.referee) as string;
    const params = res.split('?')[1].split('&');
    let state: string | null = null;
    for (let p of params) {
      const [key, value] = p.split('=')
      if (key === 'state') {
        state = value;
        break;
      }
    }
    if (!state) return;

    if (isIOS || isAndroid) {
      setTimeout(() => {
        window.location.href = res
      });
    }else {
      setTimeout(() => {
        window.open(res, 'newwindow', 'height=700,width=500,top=0,left=0,toolbar=no,menubar=no,resizable=no,scrollbars=no,location=no,status=no')
      })
    }

    await sleep(6)
    let count = 0;
    let userInfo: any = await twitterLogin(state);
    if (userInfo.code === 1) {
      while(count < 80) {
        userInfo = await twitterLogin(state);
        if (userInfo.code === 3) {
          accStore.setAccount(userInfo.account as Account)
          useModalStore().setModalVisible(false);
          emitter.emit('login', true);
          break;
        }
        count++;
        await sleep(1)
      }
    }else {
      if (userInfo.code === 3) {
        accStore.setAccount(userInfo.account as Account)
        useModalStore().setModalVisible(false);
        emitter.emit('login', true);
      }
    }
  } catch (e) {
    handleTransError(e);
    useLoginStore().setLoginStep(LoginStepType.CreateWallet)
  } finally {
    logging.value = false
  }
}
</script>

<template>
  <div class="flex flex-col justify-center min-h-[240px] py-6 px-4">
    <div class="flex flex-col gap-y-[48px]">
      <div class="flex items-center gap-8 justify-center">
        <img class="w-12 min-w-12 object-center object-contain" src="~@/assets/logo-primary.svg" alt="">
        <img class="w-10 min-w-10 object-center object-contain" src="~@/assets/icons/icon-login-arrow.svg" alt="">
        <img class="w-8 min-w-8 object-center object-contain" src="~@/assets/icons/icon-x.svg" alt="">
      </div>
      <button @click="login" :disabled="logging"
              class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2">
          <span class="text-white text-h5">
            {{$t('loginView.loginWithTwitter')}}
          </span>
        <i-ep-loading v-if="logging" class="animate-spin text-white"/>
      </button>
      <div class="text-base text-center text-grey-normal">{{$t('loginView.p1')}}</div>
    </div>
  </div>
</template>

<style scoped>

</style>
