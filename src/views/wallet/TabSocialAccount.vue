<script setup lang="ts">
import AddTokenList from "@/views/wallet/social/AddTokenList.vue";
import EditAllowance from "@/views/wallet/social/EditAllowance.vue";
import AddNewToken from "@/views/wallet/social/AddNewToken.vue";
import TipToken from "@/views/wallet/social/TipToken.vue";
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import EditLimit from "@/views/wallet/social/EditLimit.vue";
import { useAccountStore } from "@/stores/web3";
import { formatAmount } from "@/utils/helper";
import { onMounted, ref } from "vue";
import { getRewardsClaimd } from "@/utils/twitterTip";
import RechargeBNB from "@/views/wallet/social/RechargeBNB.vue";
import WithdrawBNB from "@/views/wallet/social/WithdrawBNB.vue";
import { useAccount } from "@/composables/useAccount";
import { zeroAddress } from "viem";
import CommentBuyAuthorization from './social/CommentBuyAuthorization.vue';
import { useI18n } from 'vue-i18n';

const accStore = useAccountStore()
const socialAccountModalStore = useSocialAccountModalStore()
const { updateBalance } = useAccount();
const isLoading = ref(false)
const activeService = ref<'buy' | 'tip'>('buy')
const { locale } = useI18n()
const serviceText = (cn: string, en: string) => locale.value.startsWith('zh') ? cn : en

function setModalType(type: SocialAccountModalType) {
  socialAccountModalStore.modalType = type
  socialAccountModalStore.modalVisible = true
}

function refreshBalance() {
  isLoading.value = true
  updateBalance()
  socialAccountModalStore.updateSocialAccountTokens().finally(() => {
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  })
}

onMounted(() => {
  getRewardsClaimd(accStore.getAccountInfo.twitterId).then((res:any) => {
    socialAccountModalStore.needClaim = res == zeroAddress;
  })
})

</script>

<template>
  <div class="min-h-full px-3">
    <div class="social-services" :aria-label="serviceText('选择自动支付功能', 'Choose payment service')">
      <button :aria-pressed="activeService === 'buy'" :class="{ selected: activeService === 'buy' }" @click="activeService = 'buy'">{{ serviceText('评论买币', 'Comment buy') }}</button>
      <button :aria-pressed="activeService === 'tip'" :class="{ selected: activeService === 'tip' }" @click="activeService = 'tip'">{{ serviceText('社交打赏', 'Social tipping') }}</button>
      <span>{{ serviceText('独立账户 · 独立授权', 'Separate funds & authorizations') }}</span>
    </div>
    <CommentBuyAuthorization v-show="activeService === 'buy'" />
    <section v-show="activeService === 'tip'" class="social-tip-section">
    <header class="social-tip-heading"><h2>{{ serviceText('社交打赏', 'Social tipping') }}</h2><p>{{ serviceText('给喜欢的创作者打赏。这里的充值仅用于 Tip，不用于评论买币。', 'Tip your favorite creators. Deposits here fund tips, not comment buys.') }}</p></header>
    <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3 relative mb-2">
      <div class="flex justify-center items-center mb-2">
        <div class="relative w-min">
          <span class="text-grey-normal text-h1">{{ formatAmount(accStore.socialBalance) }}</span>
          <div class="absolute left-[120%] bottom-1 flex items-center gap-2">
            <span class="whitespace-nowrap text-h5 text-gradient bg-gradient-primary">BNB</span>
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.tipDes1') }}</div>
                  <ul class="list-decimal pl-5">
                    <li>{{ $t('profileView.tipDes2') }}</li>
                    <li>{{ $t('profileView.tipDes5') }}</li>
                    <li v-if="accStore.getAccountInfo?.accountType === 0">{{ $t('profileView.tipDes6') + ' @TagAIDAO tip [amount] $[ticker] to @[user]' }}</li>
                    <li v-else>{{ $t("profileView.tipDes7") }}</li>
                  </ul>
                </div>
              </template>
            </el-popover>
            <el-popover @click="refreshBalance" popper-class="c-popper" placement="right-start">
              <template #reference>
                <img @click="refreshBalance" class="w-5 min-w-5 min-h-5 cursor-pointer" src="~@/assets/icons/icon-refresh.svg" alt="" :class="isLoading ? 'animate-spin' : ''">
              </template>
              <template #default>
                <div class="bg-white rounded-xl flex p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.refreshBalance') }}</div>
                  </div>
              </template>
            </el-popover>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 max-w-[500px] mx-auto">
        <!-- <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5"
          @click="setModalType(SocialAccountModalType.AddToken)">
          {{$t('profileView.addToken')}}
        </button> -->
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5"
          @click="setModalType(SocialAccountModalType.Recharge)">
          {{ serviceText('充值打赏资金', 'Fund tips') }}
        </button>
        <button class="flex-1 h-10 bg-gradient-primary rounded-full px-3 text-white text-h5"
          @click="setModalType(SocialAccountModalType.Withdraw)">
          {{ serviceText('提取打赏资金', 'Withdraw tip funds') }}
        </button>
        <button @click="$router.push('/tip-record')" class="relative">
          <img class="w-8 h-8" src="~@/assets/icons/icon-record.svg" alt="">
          <div class="absolute top-[-3px] right-[-3px] w-4 h-4 bg-red-normal rounded-full" v-if="socialAccountModalStore.needClaim"></div>
        </button>
      </div>
    </div>
    <div class="flex items-end gap-3 justify-end my-2">
      <button class="text-lg rounded-full px-3 text-h5 underline text-orange-normal"
          @click="setModalType(SocialAccountModalType.AddToken)">
          {{$t('profileView.addToken')}}
        </button>
    </div>
    <AddTokenList></AddTokenList>
    </section>
    <el-dialog v-model="socialAccountModalStore.modalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false"
               align-center
               destroy-on-close >
      <EditAllowance v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditAllowance" @added="refreshBalance"/>
      <EditLimit v-if="socialAccountModalStore.modalType==SocialAccountModalType.EditLimit" @added="refreshBalance"/>
      <AddNewToken v-if="socialAccountModalStore.modalType==SocialAccountModalType.AddToken" @added="refreshBalance"/>
      <TipToken v-if="socialAccountModalStore.modalType==SocialAccountModalType.TipToken"/>
      <RechargeBNB v-if="socialAccountModalStore.modalType==SocialAccountModalType.Recharge" @added="refreshBalance"/>
      <WithdrawBNB v-if="socialAccountModalStore.modalType==SocialAccountModalType.Withdraw" @withdraw="refreshBalance"/>
    </el-dialog>
  </div>
</template>

<style scoped>
.social-services { display: flex; align-items: center; gap: 5px; padding: 5px; border-bottom: 1px solid var(--border-base); margin-top: 14px; }
.social-services button { padding: 11px 20px; border-radius: 10px; color: var(--text-muted); font-size: 14px; font-weight: 600; }
.social-services button.selected { color: #e58339; background: #fe913f12; }
.social-services button:focus-visible { outline: 2px solid #fe913f; outline-offset: 2px; }
.social-services > span { margin-left: auto; color: var(--text-muted); font-size: 11px; padding-right: 12px; }
.social-tip-heading { margin: 28px 0 22px; color: var(--text-base); }
.social-tip-heading h2 { font-size: 26px; font-weight: 650; }
.social-tip-heading p { font-size: 13px; color: var(--text-muted); margin-top: 7px; }
@media (max-width: 600px) { .social-services > span { display: none; } .social-services button { flex: 1; padding: 10px; } }
</style>
