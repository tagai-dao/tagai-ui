<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {reactive, ref} from "vue";
import {useUploadImg} from "@/composables/useUploadImg";
import type {UploadRequestOptions} from "element-plus";
import {GlobalModalType} from "@/types";
import { CreateFee, BACKEND_API_URL } from "@/config";

const modalStore = useModalStore()
const {addUploadImg} = useUploadImg()
const createForm = reactive<{name: string, desc: string, logoUrl: string, tags: string[]}>({
  name: '',
  desc: '',
  logoUrl: '',
  tags: []
})
const createLoading = ref(false)
const uploading = ref(false)
const showOnlyPic = ref(false)
const showPicSizeLimit = ref(false)

const inputTag = ref('')
const addTagTip = ref('')
const onAddTags = () => {
  if (createForm.tags.length === 3) {
    return;
  }
  if (createForm.tags.find(tag => tag === inputTag.value)) {
    return;
  }
   createForm.tags.push(inputTag.value)
  inputTag.value = ''
}

const uploadSuccess = (res: any, file: any) => {
  createForm.logoUrl = URL.createObjectURL(file.raw);
  console.log(11, createForm)
}

const beforeUpload = (file: any) => {
  const isPic = file.type.startsWith('image/')
  const isLt1M = file.size / 1024/ 1024 < 1;
  showOnlyPic.value = !isPic;
  showPicSizeLimit.value = !isLt1M;
}

const onFocusTagInput = () => {
  if(addTagTip.value) {
    addTagTip.value = ''
    inputTag.value = ''
  }
  inputTag.value = ''
}

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
        <textarea class="border-b-[1px] border-grey-e6 leading-6 text-base"
                  v-model="createForm.desc"
                  id="desc" placeholder="LOOK AT THE CEOWD"/>
      </div>
      <div class="flex items-center gap-4">
        <label for="logo" class="leading-6 text-lg font-medium text-black">Logo:</label>
        <div class="flex items-center gap-2">
          <img v-if="createForm.logoUrl" :src="createForm.logoUrl"
               class="w-11 h-11 min-w-11 min-h-11" alt=""/>
          <div v-else
               class="w-11 h-11 min-w-11 min-h-11 bg-grey-f0 rounded-full flex items-center justify-center">
            <img class="w-3 h-3" src="~@/assets/icons/icon-img.svg" alt="">
          </div>
          <el-upload
              class="avatar-uploader w-7 h-6 min-w-7 min-h-7 bg-grey-f0 rounded-full flex items-center justify-center"
              :action="BACKEND_API_URL + '/qiniu/upload'"
              :on-success="uploadSuccess"
              :show-file-list="false"
              :before-upload="beforeUpload">
            <img v-if="uploading" class="animate-spin" src="~@/assets/icons/loading.svg" alt="">
            <img v-else src="~@/assets/icons/icon-upload.svg" alt="">
          </el-upload>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="tags" class="leading-6 text-lg ">Community Tag </label>
        <div class="border-b-[1px] border-grey-e6 flex items-center pb-1">
          <input class="leading-6 text-base flex-1"
                 v-model="inputTag"
                 @focus="onFocusTagInput"
                 type="text" id="name" placeholder="KATC">
          <button class="border-[1px] border-orange-light-active rounded-md px-2 flex items-center gap-1"
                  @click="onAddTags">
            <span class="text-gradient bg-gradient-primary">Confirm</span>
          </button>
        </div>
        <div v-if="createForm.tags.length>0" class="flex flex-wrap gap-4 mt-1">
          <span v-for="tag of createForm.tags" :key="tag"
                class="bg-green-b6 px-2 rounded-md text-green-hover">#{{tag}}</span>
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
        <span class="text-grey-normal">Cost to deploy：</span>
        <span class="text-red-ff italic">~ {{ (CreateFee as any) / 1e18 }} BTC</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
