<script setup lang="ts">
import {ref} from "vue";
import SearchModal from "@/components/common/SearchModal.vue";
import ProfileBtn from "@/layout/ProfileBtn.vue";

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
      <img class="w-6 cursor-pointer"
           src="~@/assets/icons/icon-notification.svg" alt=""
           @click="$router.push('/notification')">
      <img class="w-6 cursor-pointer web:hidden"
           src="~@/assets/icons/icon-search.svg" alt=""
           @click="modalVisible=true">
      <img class="w-6 cursor-pointer" src="~@/assets/icons/icon-lang-en.svg" alt="">
      <ProfileBtn class="hidden web:flex"/>
      <button class="h-12 bg-gradient-primary px-6 rounded-full hidden web:flex items-center gap-2">
        <span class="text-white font-bold">{{$t('createCoin')}}</span>
        <img src="~@/assets/icons/icon-add.svg" alt="">
      </button>
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
