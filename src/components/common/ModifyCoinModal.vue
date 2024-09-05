<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { reactive, ref, watch } from "vue";
import {GlobalModalType, type Community} from "@/types";
import {useUploadImg} from "@/composables/useUploadImg";
import ImageCropper from "@/components/common/ImageCropper.vue";
import {useCommunityStore} from "@/stores/community";

const comStore = useCommunityStore()
const modalStore = useModalStore();
const modifyCommunityForm = reactive<Community>({
  ...comStore.currentSelectedCommunity!
});
const loading = ref(false);

const {
  uploading,
  cropperModalVisible,
  cropperImgSrc,
  completedImgUrl,
  openImageCropper,
  onCroppingAndUpload
} = useUploadImg()

watch(() => completedImgUrl.value, (value) => {
  modifyCommunityForm.logo = completedImgUrl.value
})

const uploadSuccess = (res: any, file: any) => {
  modifyCommunityForm.logo = res.url;
  uploading.value = false;
};

const onConfirmModify = async () => {
  console.log(modifyCommunityForm)
}

</script>

<template>
  <div class="flex flex-col gap-y-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('createCommunity.modifyCoin') }}</span>
      <img
        class="cursor-pointer"
        @click="modalStore.setModalVisible(false, GlobalModalType.CreateCoin)"
        src="~@/assets/icons/icon-modal-close.svg"
        alt=""
      />
    </div>
    <div class="flex flex-col gap-4">
      <!-- desc -->
      <div class="flex flex-col gap-1">
        <label for="desc" class="leading-6 text-lg font-medium text-black"
          >Description:</label
        >
        <textarea
          class="border-b-[1px] border-grey-e6 leading-6 text-base"
          v-model="modifyCommunityForm.description"
          id="desc"
          placeholder="Describe your tag"
        />
      </div>
      <!-- logo -->
      <div class="flex items-center gap-4">
        <label for="logo" class="leading-6 text-lg font-medium text-black">Logo:</label>
        <div class="flex items-center gap-2">
          <img
            v-if="modifyCommunityForm.logo"
            :src="modifyCommunityForm.logo"
            class="w-11 h-11 min-w-11 min-h-11 rounded-md"
            alt=""
          />
          <div
            v-else
            class="w-11 h-11 min-w-11 min-h-11 bg-grey-f0 rounded-full flex items-center justify-center"
          >
            <img class="w-3 h-3" src="~@/assets/icons/icon-img.svg" alt="" />
          </div>
          <el-upload
            class="avatar-uploader w-7 h-6 min-w-7 min-h-7 bg-grey-f0 rounded-full flex items-center justify-center"
            action="#"
            :http-request="(options: any)=> openImageCropper(options)"
            :on-success="uploadSuccess"
            :show-file-list="false"
          >
            <img
              v-if="uploading"
              class="animate-spin"
              src="~@/assets/icons/loading.svg"
              alt=""
            />
            <img v-else src="~@/assets/icons/icon-upload.svg" alt="" />
          </el-upload>
        </div>
      </div>
      <!-- twitter -->
      <div class="flex flex-col gap-1">
        <label for="twitter" class="leading-6 text-lg font-medium text-black">Twitter:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="modifyCommunityForm.twitter"
               id="twitter"
               placeholder="@twittername"/>
      </div>
      <!-- telegram -->
      <div class="flex flex-col gap-1">
        <label for="twitter" class="leading-6 text-lg font-medium text-black">Twitter:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="modifyCommunityForm.telegram"
               id="telegram"
               placeholder="@telegram"/>
      </div>
      <!-- official -->
      <div class="flex flex-col gap-1">
        <label for="twitter" class="leading-6 text-lg font-medium text-black">Twitter:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="modifyCommunityForm.official"
               id="official"
               placeholder="official link"/>
      </div>
    </div>
    <div class="pb-2 mt-4">
      <button
        class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
        @click="onConfirmModify"
        :disabled="loading">
        <span>Confirm</span>
        <i-ep-loading v-if="loading" class="animate-spin" />
      </button>
    </div>
    <el-dialog v-model="cropperModalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
      <ImageCropper :cropperImgSrc="cropperImgSrc?.toString()"
                    @onCancel="cropperModalVisible = false; uploading=false"
                    @onConfirm="onCroppingAndUpload"/>
    </el-dialog>
  </div>
</template>

<style scoped></style>
