<script setup lang="ts">
import {useCreateCoinStore} from "@/stores/common";
import {reactive, ref} from "vue";
import {useUploadImg} from "@/composables/useUploadImg";
import type {UploadRequestOptions} from "element-plus";
const createCoinStore = useCreateCoinStore()
const {addUploadImg} = useUploadImg()
const createForm = reactive({
  name: '',
  desc: '',
  logoUrl: ''
})
const createLoading = ref(false)

</script>

<template>
  <el-dialog v-model="createCoinStore.createModalVisible"
             modal-class="overlay-white"
             class="max-w-[500px] rounded-[20px]"
             width="90%" :show-close="false" align-center>
    <div class="px-1 flex flex-col gap-y-10">
      <div class="flex justify-between items-center">
        <span class="text-2xl font-medium text-black-23">Creat Coin</span>
        <img class="cursor-pointer"
             @click="createCoinStore.setModalVisible(false)"
             src="~@/assets/icons/icon-modal-close.svg"
             alt="">
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-1">
          <label for="name" class="leading-6 text-lg font-light text-black">Name:</label>
          <input class="border-b-[1px] border-gray-e6 leading-6 text-base"
                 v-model="createForm.name"
                 type="text" id="name" placeholder="KATC">
        </div>
        <div class="flex flex-col gap-1">
          <label for="desc" class="leading-6 text-lg font-light text-black">Description:</label>
          <input class="border-b-[1px] border-gray-e6 leading-6 text-base"
                 v-model="createForm.desc"
                 type="text" id="desc" placeholder="LOOK AT THE CEOWD">
        </div>
        <div class="flex justify-between gap-1 border-b-[1px] border-gray-e6 pb-2">
          <label for="logo" class="leading-6 text-lg font-light text-black">Logo:</label>
          <div class="flex items-center gap-2">
            <img v-if="createForm.logoUrl" :src="createForm.logoUrl" class="avatar" alt=""/>
            <div v-else class="w-12 h-12 min-w-12 min-h-12 bg-gray-e5 rounded-full"></div>
            <el-upload
                class="avatar-uploader"
                action="#"
                :show-file-list="false"
                :http-request="(options: UploadRequestOptions)=> addUploadImg(options, 'logo')">
              <img src="~@/assets/icons/icon-upload.svg" alt="">
            </el-upload>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label for="tags" class="leading-6 text-lg font-light text-black">Onchain Tag </label>
          <div class="flex flex-wrap gap-4 mt-1">
            <span class="font-medium underline text-black">#onchain</span>
            <button class="h-7 bg-yellow-ff px-3 rounded-full text-black font-medium">Auto</button>
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
        <div class="flex items-center justify-center gap-2 mt-2 text-lg">
          <span class="text-gray-77">cost to deploy：</span>
          <span class="text-red-ef">~ 0.00005 BTC</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>

</style>
