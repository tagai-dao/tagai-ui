<script setup lang="ts">
import {ref} from "vue";
import SearchModal from "@/components/common/SearchModal.vue";
import ProfileBtn from "@/layout/ProfileBtn.vue";
import CreateBtn from "@/layout/CreateBtn.vue";
import { useAccountStore } from "@/stores/web3";

const modalVisible = ref(false)


</script>

<template>
  <div class="w-full h-14 web:h-20 flex justify-between items-center px-4
              web:border-b-[1px] border-white">
    <img class="h-8 mt-2 cursor-pointer"
         src="~@/assets/logo.svg" alt=""
         @click="$router.replace('/')">
    <div class="flex items-center gap-3 web:gap-6">
      <router-link to="/" class="hidden web:block">
        <img v-if="$route.name==='home'" class="w-6 h-6"
             src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
      </router-link>
      <div class="relative cursor-pointer" @click="$router.push('/notification')">
        <img class="w-6"
             src="~@/assets/icons/icon-notification.svg" alt="">
        <div v-if="useAccountStore().unreadMessageCount > 0" class="bg-red-e6 h-[12px] w-[12px] min-w-[12px] rounded-full text-[10px] text-white
                    absolute bottom-[2px] right-0 flex justify-center items-center">
          {{ useAccountStore().unreadMessageCount }}
        </div>
      </div>
      <img class="w-6 cursor-pointer web:hidden"
           src="~@/assets/icons/icon-search.svg" alt=""
           @click="modalVisible=true">
      <img class="w-6 cursor-pointer" v-if="!!useAccountStore().getAccountInfo?.ethAddr"
           src="~@/assets/icons/icon-wallet.svg" alt=""
           @click="$router.push('/wallet')">
      <!-- <img class="w-6 cursor-pointer" src="~@/assets/icons/icon-lang-en.svg" alt=""> -->
      <ProfileBtn class="hidden web:flex"/>
      <CreateBtn class="hidden web:block"/>
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
