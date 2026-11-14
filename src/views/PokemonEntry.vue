<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getAccessToken } from '@privy-io/react-auth'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { usePrivyStore } from '@/stores/privy'
import { GlobalModalType } from '@/types'
import emitter from '@/utils/emitter'

const gameOrigin = 'https://pokemon.tagai.fun'
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const route = useRoute()
const accounts = useAccountStore()
const wallet = usePrivyStore()
const modal = useModalStore()
const flow = computed(() => typeof route.query.state === 'string' && uuid.test(route.query.state) ? route.query.state : '')
const account = computed(() => accounts.getAccountInfo)
const busy = ref(false)
const status = ref('')
let automaticFlow = ''
let retriedAfterBinding = false

function openLogin() {
  sessionStorage.setItem('login-redirect', `/bsc/pokemon?state=${flow.value}`)
  modal.setModalVisible(true, GlobalModalType.Login, { pokemon: true })
}

async function enterGame() {
  const player = account.value
  if (!player?.twitterId || !player.accessToken || !flow.value || busy.value) return
  const session = accounts.sessionVersion
  busy.value = true
  status.value = '正在核对 TagAI 账户…'
  try {
    const privyAccessToken = await getAccessToken()
    if (!accounts.isSessionCurrent(session)) return
    if (!privyAccessToken) {
      status.value = '请重新使用 X 或邮箱登录。'
      openLogin()
      return
    }
    const res = await fetch(gameOrigin + '/auth/authorize', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({flow: flow.value, twitterId: player.twitterId, accessToken: player.accessToken, privyAccessToken}),
    })
    const reply = await res.json()
    if (!accounts.isSessionCurrent(session)) return
    if (res.ok && typeof reply.code === 'string' && uuid.test(reply.code)) {
      location.replace(gameOrigin + '/#code=' + reply.code)
    } else if (reply.error === 'wallet_pending') {
      // Only request a new binding when no TagAI wallet has been registered.
      // Existing external wallets need explicit migration in the account page.
      if (wallet.walletBinding) {
        status.value = '正在准备 Privy 钱包…'
      } else if (!retriedAfterBinding && !player.ethAddr && !wallet.walletBinding && (Number(player.accountType) === 0 || Number(player.accountType) === 1)) {
        retriedAfterBinding = true
        emitter.emit('privyWalletBindingRequested', {
          identity: String(player.twitterId), accountType: Number(player.accountType), userInfo: player,
        })
        status.value = '正在准备 Privy 钱包…'
      } else {
        status.value = 'Privy 钱包尚未完成验证，请检查 TagAI 钱包设置后重试。'
      }
    } else {
      status.value = reply.error === 'expired'
        ? '登录请求已过期，请从游戏入口重新开始。'
        : '暂时无法验证 TagAI 登录，请重新登录或稍后重试。'
    }
  } catch {
    status.value = '连接游戏服务器失败，请稍后重试。'
  } finally {
    busy.value = false
  }
}

watch(() => [flow.value, wallet.sdkReady, wallet.walletBinding, account.value?.twitterId] as const,
  ([id, ready, binding, identity], previous) => {
    if (!id || !ready) return
    if (automaticFlow !== id) {
      automaticFlow = id
      const failed = sessionStorage.getItem('pokemon-login-failed') === '1'
      sessionStorage.removeItem('pokemon-login-failed')
      if (failed) status.value = 'X 授权未完成，请重试或使用邮箱验证码。'
      if (!identity || failed) openLogin()
      else void enterGame()
    } else if (identity && (previous?.[2] || !previous?.[3])) {
      void enterGame()
    }
  }, { immediate: true, flush: 'post' })
</script>

<template>
  <section class="mx-auto flex h-full max-w-lg flex-col items-start justify-center gap-4 overflow-auto p-6">
    <h1 class="text-h3">Pokémon FireRed AIPRO</h1>
    <p>使用 X 或邮箱登录 TagAI 后进入游戏。</p>
    <a v-if="!flow" :href="gameOrigin" class="underline">返回游戏入口</a>
    <template v-else>
      <button v-if="account" type="button" class="rounded bg-gradient-primary px-5 py-3 font-semibold text-white disabled:opacity-60"
        :disabled="busy" @click="enterGame">
        {{ busy ? '正在验证登录…' : '继续进入游戏' }}
      </button>
      <button v-else type="button" class="rounded bg-gradient-primary px-5 py-3 font-semibold text-white disabled:opacity-60" @click="openLogin">
        使用 X 或邮箱登录
      </button>
      <button v-if="account" type="button" class="underline" @click="openLogin">重新登录或切换账户</button>
      <p role="status">{{ status }}</p>
      <a :href="gameOrigin" class="underline">返回游戏入口</a>
    </template>
  </section>
</template>
