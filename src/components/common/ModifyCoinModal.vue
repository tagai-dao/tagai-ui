<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { reactive, ref, watch } from "vue";
import {GlobalModalType, type Community} from "@/types";
import {useUploadImg} from "@/composables/useUploadImg";
import ImageCropper from "@/components/common/ImageCropper.vue";
import {useCommunityStore} from "@/stores/community";
import { handleErrorTip, notify } from "@/utils/notify";
import { updateCommunityInfo } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import i18n from "@/lang";

const t = i18n.global.t;
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
  if (!modifyCommunityForm.logo) {
    notify({message: 'Please upload Tag logo'})
    return;
  }
  if (modifyCommunityForm.description.trim().length === 0) {
    notify({message: 'Please complete description'})
    return;
  }
  if (modifyCommunityForm.description.trim().length > 1024) {
    notify({message: t('createCommunity.descTooLong')})
    return;
  }
  if (modifyCommunityForm.twitter && modifyCommunityForm.twitter.length > 0) {
    if (!modifyCommunityForm.twitter.startsWith('https://twitter.com') &&
        !modifyCommunityForm.twitter.startsWith('https://x.com')) {
          notify({message: 'Wrong twitter link form'})
          return;
        }
  }

  if (modifyCommunityForm.telegram && modifyCommunityForm.telegram.length > 0) {
    if (!modifyCommunityForm.telegram.startsWith('https://t.me')) {
          notify({message: 'Wrong telegram link form'})
          return;
        }
  }
  const urlReg =
    /^http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+$/;

  if (modifyCommunityForm.official && modifyCommunityForm.official.length > 0) {
    if (!modifyCommunityForm.official.match(urlReg)) {
      notify({message: 'Wrong url link form'});
      return;
    }
  }

  try{
    loading.value = true
    await updateCommunityInfo(modifyCommunityForm, useAccountStore().getAccountInfo.twitterId);
    useCommunityStore().currentSelectedCommunity = modifyCommunityForm;
    useModalStore().setModalVisible(false);
  } catch(e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
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
          >{{$t('createCommunity.description')}}:</label
        >
        <textarea
          class="border-b-[1px] border-grey-e6 leading-6 text-base"
          v-model="modifyCommunityForm.description"
          id="desc"
          :placeholder="$t('createCommunity.descTag')"
        />
      </div>
      <!-- logo -->
      <div class="flex items-center gap-4">
        <label for="logo" class="leading-6 text-lg font-medium text-black">{{$t('createCommunity.logo')}}:</label>
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
               placeholder="https://x.com"/>
      </div>

      <!-- telegram -->
      <div class="flex flex-col gap-1">
        <label for="twitter" class="leading-6 text-lg font-medium text-black">Telegram:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="modifyCommunityForm.telegram"
               id="telegram"
               placeholder="https://t.me"/>
      </div>
      <!-- official -->
      <div class="flex flex-col gap-1">
        <label for="twitter" class="leading-6 text-lg font-medium text-black">{{ $t('createCommunity.officialLink') }}:</label>
        <input class="border-b-[1px] border-grey-e6 leading-6 text-base"
               v-model="modifyCommunityForm.official"
               id="official"
               :placeholder="$t('createCommunity.officialLink')"/>
      </div>
    </div>
    <div class="pb-2 mt-4">
      <button
        class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
        @click="onConfirmModify"
        :disabled="loading">
        <span>{{ $t('confirm') }}</span>
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
