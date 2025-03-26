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

const accStore = useAccountStore();
const stateStore = useStateStore();
const logging = ref(false);
const route = useRoute();
const modalStore = useModalStore()
const authLike = ref(true)
const authPost = ref(true)

async function login() {
  try{
    logging.value = true
    modalStore.setModalCloseEnable(false)
    let isIOS = navigator.userAgent.toUpperCase().indexOf('IPHONE') >= 0
    let isAndroid = navigator.userAgent.toUpperCase().indexOf('ANDROID') >= 0

    const res = await twitterAuth(stateStore.referee, authLike.value, authPost.value) as string;
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

    let currentRoute = route.fullPath
    if (!currentRoute.startsWith('/login')) {
      localStorage.setItem('current-route', route.fullPath)
    }

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
    accStore.clear()
    if (userInfo.code === 1) {
      while(count < 80 && logging.value) {
        userInfo = await twitterLogin(state);
        if (userInfo.code === 3) {
          accStore.setAccount(
            {
              ...userInfo.account,
              authLike: authLike.value,
              authPost: authPost.value
            } as Account)
          modalStore.setModalCloseEnable(true)
          useModalStore().setModalVisible(false);
          emitter.emit('login', true);
          break;
        }
        count++;
        await sleep(1)
      }
    }else {
      if (userInfo.code === 3) {
        accStore.setAccount(
          {
            ...userInfo.account,
            authLike: authLike.value,
            authPost: authPost.value
          } as Account)
        modalStore.setModalCloseEnable(true)
        useModalStore().setModalVisible(false);
        emitter.emit('login', true);
      }
    }
  } catch (e) {
    handleErrorTip(e);
    useLoginStore().setLoginStep(LoginStepType.CreateWallet)
  } finally {
    logging.value = false
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
        <div>{{$t('loginView.authTwitterTip')}}</div>
        <div class="">
          <el-checkbox :label="$t('loginView.authLikeTip')" v-model="authLike" />
          <el-checkbox :label="$t('loginView.authPostTip')" v-model="authPost" />
        </div>
        <button @click="login" :disabled="logging"
                class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2">
          <span class="text-white text-h5">
            {{$t('loginView.loginWithTwitter')}}
          </span>
          <i-ep-loading v-if="logging" class="animate-spin text-white"/>
        </button>
      </div>

      <div class="text-base text-center text-grey-normal">{{$t('loginView.p1')}}</div>
    </div>
  </div>
</template>

<style scoped>

</style>
