<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { twitterLogin } from '@/apis/api'
import { useAccountStore } from '@/stores/web3'

const route = useRoute()
const router = useRouter()
const accStore = useAccountStore()

onMounted(async () => {
    const state = route.query.state;
    if (state) {
        const userInfo: any = await twitterLogin(state as string)
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