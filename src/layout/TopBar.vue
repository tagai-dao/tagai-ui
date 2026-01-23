<script setup lang="ts">
import {ref} from "vue";
import SearchModal from "@/components/common/SearchModal.vue";
import ProfileBtn from "@/layout/ProfileBtn.vue";
import { useAccountStore } from "@/stores/web3";
import RuleModal from "@/components/common/RuleModal.vue";
import { useRouter } from "vue-router";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { useI18n } from 'vue-i18n'

const modalVisible = ref(false)
const ruleModalVisible = ref(false)
const router = useRouter();
const accStore = useAccountStore();
const menuRef = ref()


const { locale } = useI18n()

const switchLanguage = (lang: string) => {
  menuRef.value?.hide()
  locale.value = lang
  localStorage.setItem('language', lang)
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
  <div class="w-full h-14 web:h-20 flex justify-between items-center px-4
              web:border-b-[1px] border-white">
    <div class="flex items-center gap-2 mt-2">
      <img class="h-8 cursor-pointer"
           src="~@/assets/logo.png" alt=""
           @click="$router.replace('/')">
      <button class="bg-gradient-primary text-white rounded-2xl text-sm px-2 h-5"
              @click="ruleModalVisible = true">{{ $t('rule') }}</button>
    </div>
    <div class="flex items-center gap-3 web:gap-6">
      <!-- 移动端：搜索、通知、创建 TagCoin 图标 -->
      <div class="flex items-center gap-3 web:hidden">
        <img class="w-6 cursor-pointer"
             src="~@/assets/icons/icon-search.svg" alt=""
             @click="modalVisible=true">
        <div v-if="!!useAccountStore().getAccountInfo?.twitterId" class="relative">
          <img class="w-6 cursor-pointer"
               src="~@/assets/icons/icon-notification.svg" alt=""
               @click="$router.push('/notification')">
          <div v-if="useAccountStore().unreadMessageCount > 0" class="bg-red-e6 h-[12px] w-[12px] min-w-[12px] rounded-full text-[10px] text-white
              absolute -top-1 -right-1 flex justify-center items-center">
            {{ useAccountStore().unreadMessageCount }}
          </div>
        </div>
        <img class="w-6 cursor-pointer"
             src="~@/assets/icons/icon-tabbar-create.svg" alt=""
             @click="createTagCoin">
      </div>
      <ProfileBtn class="hidden web:flex"/>
      <router-link to="/wallet/">
        <div class=" gap-2 items-center cursor-pointer hidden web:flex">
          <img v-if="$route.name==='wallet'" class="w-6" src="~@/assets/icons/icon-tabbar-wallet-active.svg" alt="">
          <img v-else class="w-6" src="~@/assets/icons/icon-wallet.svg" alt="">
        </div>
      </router-link>
      <el-popover popper-class="c-select-popper" ref="menuRef"
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
            <div v-if="$i18n.locale==='zh'"
                 @click="switchLanguage('en')"
                 class="flex gap-2 items-center cursor-pointer">
              <img class="w-4" src="~@/assets/icons/icon-lang-en.svg" alt="">
              <span>英文</span>
            </div>
            <div v-if="$i18n.locale==='en'"
                 @click="switchLanguage('zh')"
                 class="flex gap-2 items-center cursor-pointer">
              <img class="w-4 cursor-pointer" src="~@/assets/icons/icon-lang-zh.svg" alt="">
              <span>中文</span>
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
    <el-dialog v-model="ruleModalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-closee>
      <RuleModal @onClose="ruleModalVisible=false"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
