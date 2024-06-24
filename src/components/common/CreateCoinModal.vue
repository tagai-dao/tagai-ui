<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {reactive, ref} from "vue";
import {useUploadImg} from "@/composables/useUploadImg";
import type {UploadRequestOptions} from "element-plus";
import {GlobalModalType} from "@/types";

const modalStore = useModalStore()
const {addUploadImg} = useUploadImg()
const createForm = reactive({
  name: '',
  desc: '',
  logoUrl: ''
})
const createLoading = ref(false)

</script>

<template>
  <div class="px-1 flex flex-col gap-y-10">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">Creat Coin</span>
      <img class="cursor-pointer"
           @click="modalStore.setModalVisible(false, GlobalModalType.CreateCoin)"
           src="~@/assets/icons/icon-modal-close.svg"
           alt="">
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label for="name" class="leading-6 text-lg font-medium text-black">Name:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="createForm.name"
               type="text" id="name" placeholder="KATC">
      </div>
      <div class="flex flex-col gap-1">
        <label for="desc" class="leading-6 text-lg font-medium text-black">Description:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="createForm.desc"
               type="text" id="desc" placeholder="LOOK AT THE CEOWD">
      </div>
      <div class="flex gap-4">
        <label for="logo" class="leading-6 text-lg font-medium text-black">Logo:</label>
        <div class="flex items-center gap-2">
          <img v-if="createForm.logoUrl" :src="createForm.logoUrl"
               class="w-8 h-8 min-w-8 min-h-8" alt=""/>
          <div v-else class="w-8 h-8 min-w-8 min-h-8 bg-grey-light-hover rounded-full"></div>
          <el-upload
              class="avatar-uploader w-6 h-6 min-w-6 min-h-6"
              action="#"
              :show-file-list="false"
              :http-request="(options: UploadRequestOptions)=> addUploadImg(options, 'logo')">
            <img src="~@/assets/icons/icon-upload.svg" alt="">
          </el-upload>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="tags" class="leading-6 text-lg ">Onchain Tag </label>
        <div class="flex flex-wrap gap-4 mt-1">
          <span class="font-medium underline text-black">#onchain</span>
          <button class="h-7 bg-yellow-fa px-3 rounded-full text-black font-medium">Auto</button>
        </div>
      </div>
    </div>
    <div class="pb-2">
      <button class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg
                       flex items-center justify-center gap-2 disabled:opacity-30"
              :disabled="createLoading">
        <span>Create Coin</span>
        <i-ep-loading v-if="createLoading" class="animate-spin"/>
      </button>
      <div class="flex justify-between items-center gap-2 mt-2 text-sm px-3">
        <span class="text-grey-normal">cost to deploy：</span>
        <span class="text-red-ff italic">~ 0.00005 BTC</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
