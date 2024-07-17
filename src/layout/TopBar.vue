<script setup lang="ts">
import {ref} from "vue";
import SearchModal from "@/components/common/SearchModal.vue";

const modalVisible = ref(false)
</script>

<template>
  <div class="w-full h-14 flex justify-between items-center px-4">
    <img class="h-8 mt-2 cursor-pointer"
         src="~@/assets/logo.svg" alt=""
         @click="$router.replace('/')">
    <div class="flex items-center gap-3">
      <img class="w-6.5 cursor-pointer"
           src="~@/assets/icons/icon-notification.svg" alt=""
           @click="$router.push('/notification')">
      <img class="w-6.5 cursor-pointer"
           src="~@/assets/icons/icon-search.svg" alt=""
           @click="modalVisible=true">
      <img class="w-6.5 cursor-pointer" src="~@/assets/icons/icon-lang-en.svg" alt="">
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
