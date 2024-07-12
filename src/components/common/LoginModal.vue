<script setup lang="ts">
import { type Account } from '@/types';
import { ref, onMounted } from 'vue';
import { twitterAuth, twitterLogin } from '@/apis/api';
import { useAccountStore } from '@/stores/web3';
import { useTimer } from '@/composables/useTools';
import { useStateStore, useModalStore } from '@/stores/common';
import { sleep } from '@/utils/helper'
import emitter from '@/utils/emitter';
import { handleServerError, handleTransError } from '@/utils/notify';

const accStore = useAccountStore();
const stateStore = useStateStore();
const setTimer = useTimer();
const loging = ref(false);

async function login() {
    try{
        loging.value = true
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
    } finally {
        loging.value = false
    }
}

onMounted(() => {
})
</script>

<template>
  <div>
    <button @click="login">
        Login
    </button>
  </div>
</template>
