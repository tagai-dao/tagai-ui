<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { twitterLogin } from '@/apis/api'
import { useAccountStore } from '@/stores/web3'
import { sleep } from '@/utils/helper'
import { useModalStore } from '@/stores/common'
import emitter from '@/utils/emitter'
import type { Account } from '@/types'

const route = useRoute()
const router = useRouter()
const accStore = useAccountStore()

onMounted(async () => {
    const state = route.query.state;
    if (state) {
        let userInfo: any = await twitterLogin(state as string)
        let count = 0
        if (userInfo.code === 1) {
            while(count < 80) {
                userInfo = await twitterLogin(state as string);
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
        if (userInfo.account) {
            accStore.setAccount(userInfo.account)
            const path = localStorage.getItem('current-route')
            localStorage.removeItem('current-route')
            router.replace(path ?? '/')
        }
        router.replace('/')
    }else {
        router.replace('/')
    }
})
</script>

<template>
    <div>
    </div>
</template>