<template>
  <div class="flex flex-col gap-y-2 py-3">
    <div class="text-h3 text-center mb-5 text-black">Account Settings</div>
    <div class="flex items-center justify-center gap-4">
      <!-- <label for="profile" class="text-h4 text-black">{{ $t('loginView.avatar') }}:</label> -->
      <div class="flex justify-center items-center gap-2">
        <img v-if="createUserInfo.profile" :src="createUserInfo.profile"
             class="w-20 h-20 min-w-20 min-h-20 rounded-md" alt=""/>
        <div v-else class="w-20 h-20 min-w-20 min-h-20 bg-grey-f0 rounded-full flex items-center justify-center">
          <img class="w-3 h-3" src="~@/assets/icons/icon-img.svg" alt="" />
        </div>
        <el-upload class="avatar-uploader w-10 h-10 min-w-10 min-h-10 bg-grey-f0 rounded-full flex items-center justify-center"
                   action="#"
                   :http-request="(options: any)=> openImageCropper(options)"
                   :on-success="uploadSuccess"
                   :show-file-list="false"
                   :before-upload="beforeUpload">
          <img v-if="uploading"
               class="animate-spin"
               src="~@/assets/icons/loading.svg" alt=""/>
          <img v-else src="~@/assets/icons/icon-upload.svg" alt="" />
        </el-upload>
        <div v-if="showOnlyPic" class="text-red-e6">
          {{$t('createCommunity.onlyPicTip')}}
        </div>
        <div v-if="showPicSizeLimit" class="text-red-e6">
          {{$t('createCommunity.picSizeLimitTip')}}
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-1 justify-center items-center mt-5">
      <!-- <label for="name" class="text-h4 text-black">{{$t('loginView.username')}}:</label> -->
      <input class="border-[1px] border-grey-e6 leading-6 text-base text-center w-1/2 rounded-full px-3 py-2"
             v-model="createUserInfo.username"
             type="text"
             id="name"/>
    </div>
    <div class="flex justify-center mt-4">
      <button class="px-5 h-11 bg-gradient-primary rounded-full
                       flex justify-center items-center space-x-2 disabled:opacity-30"
              :disabled="uploading || loading"
              @click="onConfirm">
        <span class="text-white font-bold text-lg">{{$t('confirm')}}</span>
        <i-ep-loading v-if="loading" class="text-white animate-spin"/>
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

<script setup lang="ts">
import {useUploadImg} from "@/composables/useUploadImg";
import {onMounted, reactive, ref} from "vue";
import ImageCropper from "@/components/common/ImageCropper.vue";
import {useAccountStore} from "@/stores/web3";
import { updateEmailProfile } from '@/apis/api'
import { useModalStore } from "@/stores/common";
import { handleErrorTip } from "@/utils/notify";

const {
  uploading,
  showOnlyPic,
  cropperModalVisible,
  cropperImgSrc,
  showPicSizeLimit,
  openImageCropper,
  onCroppingAndUpload
} = useUploadImg()
const loading = ref(false)
const accStore = useAccountStore();
const createUserInfo = reactive({
  profile: '',
  username: ''
})

const uploadSuccess = (res: any, file: any) => {
  createUserInfo.profile = res.url;
  uploading.value = false;
}

const beforeUpload = (file: any) => {
  uploading.value = true;
}

const onConfirm = async () => {
  try {
    loading.value = true;
    await updateEmailProfile(accStore.getAccountInfo.twitterId, createUserInfo.username, createUserInfo.profile);
    accStore.setAccount({
      ...accStore.getAccountInfo,
      twitterUsername: createUserInfo.username,
      twitterName: createUserInfo.username,
      profile: createUserInfo.profile
    });
    useModalStore().setModalVisible(false);
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false;
  }
}

function getCleanLocalPart(email: string) {
  // 取本地部分
  if (!email.includes('@')) return '';
  const localPart = email.match(/^([^@]+)/)?.[1] ?? '';
  // 去掉非字母数字
  return localPart.replace(/[^A-Za-z0-9]/g, '');
}

onMounted(async () => {
  const userInfo = accStore.getAccountInfo;
  createUserInfo.profile = userInfo.profile;
  createUserInfo.username = userInfo.twitterUsername ?? getCleanLocalPart(userInfo.twitterId);
})

</script>

<style lang="scss" scoped>

</style>