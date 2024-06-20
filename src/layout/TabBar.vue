<script setup lang="ts">
import {useCreateCoinStore} from "@/stores/common";

const createCoinStore = useCreateCoinStore()
</script>

<template>
  <div class="h-24 w-full bg-white flex justify-between items-center px-8 py-4">
    <router-link to="/" class="flex flex-col items-center cursor-pointer gap-0.5 px-2">
      <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
      <span>Tag</span>
    </router-link>
    <button class="mb-6" @click="createCoinStore.setModalVisible(true)">
      <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
    </button>
    <router-link to="/profile" class="flex flex-col items-center cursor-pointer gap-0.5 px-2">
      <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-profile.svg" alt="">
      <span>Profile</span>
    </router-link>
  </div>
</template>

<style scoped>

</style>
