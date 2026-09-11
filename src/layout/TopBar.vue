<script setup lang="ts">
import {computed, ref} from "vue";
import SearchModal from "@/components/common/SearchModal.vue";
import ProfileBtn from "@/layout/ProfileBtn.vue";
import { useAccountStore } from "@/stores/web3";
import { useRoute, useRouter } from "vue-router";
import { useModalStore, useStateStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type LocaleCode } from '@/lang'
import ChainSwitcher from '@/components/common/ChainSwitcher.vue'
import TokenFavoriteButton from '@/components/common/TokenFavoriteButton.vue'
import CommunityLogo from '@/components/common/CommunityLogo.vue'
import { useCommunityStore } from '@/stores/community'
import { usePageRouter, useTools } from '@/composables/useTools'
import { formatUsdCompact } from '@/utils/format'
import { communityChartPeriods } from '@/utils/communityChartPeriod'
import { useChainStore } from '@/stores/chain'

const modalVisible = ref(false)
const router = useRouter();
const route = useRoute();
const { goBack } = usePageRouter();
const communityStore = useCommunityStore();
const headerCommunity = computed(() => route.name === 'tag-detail'
  && communityStore.currentSelectedCommunity?.tick === route.params.id
  ? communityStore.currentSelectedCommunity : null);
const accStore = useAccountStore();
const { onCopy } = useTools()
const stateStore = useStateStore()
const chainStore = useChainStore()
const headerMarketCap = computed(() => {
  const value = Number(headerCommunity.value?.marketCap) * Number(stateStore.ethPrice)
  return Number.isFinite(value) && value > 0 ? formatUsdCompact(value) : '—'
})
const headerChange = computed(() => {
  const quote = communityStore.chartQuote
  if (quote.scope !== `${chainStore.activeChainId}:${headerCommunity.value?.token || ''}`) return null
  const value = quote.change
  return value != null && String(value) !== '' && Number.isFinite(Number(value)) ? Number(value) : null
})
const headerPeriod = computed(() => communityChartPeriods.find(p => p.key === communityStore.chartQuote.period)?.label || '24H')
const shortCa = computed(() => {
  const address = headerCommunity.value?.token
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'
})
const menuRef = ref()


const { locale } = useI18n()

const switchLanguage = (lang: LocaleCode) => {
  menuRef.value?.hide()
  setLocale(lang)
}

function onClickWallet() {
  menuRef.value?.hide()
  if (accStore.getAccountInfo?.ethAddr) {
    router.push('/wallet')
    return;
  }else if(accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.BondEth);
  }
}

async function createTagCoin() {
  if (!accStore.ethConnectAddress) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  } else {
    useModalStore().setModalVisible(true, GlobalModalType.CreateCoin)
    return
  }
}

</script>

<template>
  <div class="w-full h-14 web:h-20 native-safe-topbar flex justify-between items-center px-4
              web:border-b-[1px] border-line">
    <button v-if="route.name === 'tag-detail'" type="button" class="flex h-10 w-10 shrink-0 items-center justify-center web:hidden" :aria-label="$t('back')" @click="goBack">
      <img class="w-6 h-6 dark:invert" src="~@/assets/icons/icon-back.svg" alt="" />
    </button>
    <div class="flex shrink-0 items-center gap-2 mt-2" :class="{ 'hidden web:flex': route.name === 'tag-detail' }">
      <img class="h-8 cursor-pointer"
           src="~@/assets/logo.png" alt=""
           @click="$router.replace('/')">
    </div>
    <div v-if="headerCommunity" class="flex min-w-0 flex-1 items-center gap-2 web:hidden">
      <CommunityLogo :logo="headerCommunity.logo" size="sm" :shadow="false" class="shrink-0" />
      <div class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-content" :title="headerCommunity.tick">{{ headerCommunity.tick }}</span>
        <button type="button" class="flex max-w-full items-center gap-1 text-xs text-grey-64 py-1" :disabled="!headerCommunity.token"
          aria-label="Copy token contract address" :title="headerCommunity.token" @click="onCopy(headerCommunity.token || '')">
          <span class="truncate">CA {{ shortCa }}</span><img class="h-3 w-3 shrink-0" src="~@/assets/icons/icon-copy.svg" alt="" />
        </button>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-sm font-semibold tabular-nums text-content">{{ headerMarketCap }} <span class="text-xs text-grey-64">MC</span></div>
        <div class="text-xs tabular-nums" :class="headerChange === null ? 'text-grey-64' : headerChange >= 0 ? 'text-up' : 'text-down'">
          {{ headerPeriod }} {{ headerChange === null ? '—' : `${headerChange >= 0 ? '+' : ''}${headerChange.toFixed(2)}%` }}
        </div>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-3 web:gap-6">
      <!-- 移动端详情页用收藏替换链切换和搜索，保留通知入口。 -->
      <div class="flex items-center gap-3 web:hidden">
        <TokenFavoriteButton v-if="route.name === 'tag-detail'" :token="headerCommunity" />
        <span v-else-if="route.name === 'basket-detail'" id="mobile-basket-favorite" class="flex items-center" />
        <template v-else>
          <ChainSwitcher variant="compact" />
          <img class="w-6 cursor-pointer"
               src="~@/assets/icons/icon-search.svg" alt=""
               @click="modalVisible=true">
        </template>
        <div v-if="route.name !== 'tag-detail' && !!useAccountStore().getAccountInfo?.twitterId" class="relative">
          <img class="w-6 cursor-pointer"
               src="~@/assets/icons/icon-notification.svg" alt=""
               @click="$router.push('/notification')">
          <div v-if="useAccountStore().unreadMessageCount > 0" class="bg-red-e6 h-[12px] w-[12px] min-w-[12px] rounded-full text-[10px] text-white
              absolute -top-1 -right-1 flex justify-center items-center">
            {{ useAccountStore().unreadMessageCount }}
          </div>
        </div>
      </div>
      <ProfileBtn class="hidden web:flex"/>
      <router-link to="/wallet/">
        <div class=" gap-2 items-center cursor-pointer hidden web:flex">
          <img v-if="$route.name==='wallet'" class="w-6" src="~@/assets/icons/icon-tabbar-wallet-active.svg" alt="">
          <img v-else class="w-6" src="~@/assets/icons/icon-wallet.svg" alt="">
        </div>
      </router-link>
      <el-popover v-if="route.name !== 'tag-detail'" popper-class="c-select-popper" ref="menuRef"
                  trigger="click" width="160" :teleported="true" :persistent="false">
        <template #reference>
          <img class="w-5 cursor-pointer"
               src="~@/assets/icons/icon-menu.svg" alt="">
        </template>
        <template #default>
          <div class="p-2 flex flex-col gap-3">
            <router-link to="/mindshare/" class="flex gap-2 items-center cursor-pointer">
              <img class="w-4" src="~@/assets/icons/icon-mindshare.svg" alt="">
              <span>{{$t('mindshare')}}</span>
            </router-link>
<!--            <div v-if="!!useAccountStore().getAccountInfo?.twitterId"-->
<!--                 @click="onClickWallet"-->
<!--                 class="flex gap-2 items-center cursor-pointer">-->
<!--              <img class="w-4" src="~@/assets/icons/icon-wallet.svg" alt="">-->
<!--              <span>{{$t('wallet')}}</span>-->
<!--            </div>-->
            <!-- 四语切换：当前语言打勾 -->
            <div v-for="l of SUPPORTED_LOCALES" :key="l.code"
                 @click="switchLanguage(l.code)"
                 class="flex gap-2 items-center justify-between cursor-pointer"
                 :class="locale === l.code ? 'text-orange-normal font-semibold' : ''">
              <div class="flex gap-2 items-center">
                <img class="w-4" src="~@/assets/icons/icon-lang-en.svg" alt="">
                <span>{{ l.label }}</span>
              </div>
              <span v-if="locale === l.code">✓</span>
            </div>
            <a class="flex gap-2 items-center cursor-pointer"
               @click="menuRef.hide()"
               href="https://coincidence-labs.gitbook.io/tagai/" target="_blank">
              <img class="w-4" src="~@/assets/icons/icon-docs.svg" alt="">
              <span>{{$t('docs')}}</span>
            </a>
            <a class="flex gap-2 items-center cursor-pointer"
               @click="menuRef.hide()"
               href="https://scalebit.xyz/reports/TagAI-Audit-Report.pdf" target="_blank">
              <img class="w-4" src="~@/assets/icons/icon-warning.svg" alt="">
              <span>{{$t('auditReport')}}</span>
            </a>
            <a class="flex gap-2 items-center cursor-pointer"
               @click="menuRef.hide()"
               href="https://x.com/tagaidao" target="_blank">
              <img class="w-4" src="~@/assets/icons/icon-link-x.svg" alt="">
              <span>{{$t('Twitter')}}</span>
            </a>
            <a class="flex gap-2 items-center cursor-pointer"
               @click="menuRef.hide()"
               href="https://t.me/tagaidotfun" target="_blank">
              <img class="w-4" src="~@/assets/icons/icon-link-tg.svg" alt="">
              <span>{{$t('Telegram')}}</span>
            </a>
          </div>
        </template>
      </el-popover>
    </div>
    <el-dialog v-model="modalVisible"
               modal-class="overlay-white c-modal-fullscreen" fullscreen
               :show-close="false" align-center destroy-on-close>
      <SearchModal @onClose="modalVisible=false"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
