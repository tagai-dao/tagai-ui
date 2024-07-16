<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { reactive, ref, computed } from "vue";
import { GlobalModalType, type CreateCommunity } from "@/types";
import { CreateFee, BACKEND_API_URL, RegisterSteemMessage } from "@/config";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import ChoseWallet from "../login/ChoseWallet.vue";
import { useAccount } from "@/composables/useAccount";
import { box, generateSteemAuth } from "@/utils/web3";
import { signMessage } from "@/utils/wallets";
import { ethers } from "ethers";
import { bytesToHex } from "@/utils/helper";
import { createCoin } from "@/utils/pump";
import { handleErrorTip } from "@/utils/notify";
import { createCommunity } from '@/apis/api'

const modalStore = useModalStore();

const createForm = reactive<CreateCommunity>({
  tick: "",
  desc: "",
  logoUrl: "",
  tags: [],
  token: "",
  ethAddr: "",
});
const createLoading = ref(false);
const uploading = ref(false);
const showOnlyPic = ref(false);
const showPicSizeLimit = ref(false);
const showInvalidName = ref(false);

const accStore = useAccountStore();
const inputTag = ref("");
const addTagTip = ref("");

const { accountMismatch } = useAccount();

const onAddTags = () => {
  if (createForm.tags!.length === 3) {
    return;
  }
  if (createForm.tags!.find((tag) => tag === inputTag.value)) {
    return;
  }
  createForm.tags!.push(inputTag.value);
  inputTag.value = "";
};

const uploadSuccess = (res: any, file: any) => {
  createForm.logoUrl = res.url;
  uploading.value = false;
};

const beforeUpload = (file: any) => {
  uploading.value = true;
  const isPic = file.type.startsWith("image/");
  const isLt1M = file.size / 1024 / 1024 < 1;
  showOnlyPic.value = !isPic;
  showPicSizeLimit.value = !isLt1M;
};

const onFocusTagInput = () => {
  if (addTagTip.value) {
    addTagTip.value = "";
    inputTag.value = "";
  }
  inputTag.value = "";
};

const testTick = (name: string) => {
  if (createForm.tick.match(/[a-z][A-Z]{1,12}$/)) {
    showInvalidName.value = false;
    return true;
  }
  showInvalidName.value = true
}

const create = async () => {
  const account = accStore.getAccountInfo;
  try {
    createLoading.value = true;
    // check params
    showInvalidName.value = false

    if (!testTick(createForm.tick)) {
      return;
    }

    if (!createForm.logoUrl || createForm.logoUrl.length === 0) {
      return;
    }

    // check steem
    if (!account?.steemId) {
      // generate steem account
      const signature = await signMessage(RegisterSteemMessage);
      const salt = bytesToHex(ethers.randomBytes(4));
      const steemAccount = generateSteemAuth(signature.replace("0x", "") + salt);
      let params = box(steemAccount);
      createForm.pwd = params.pwd;
      createForm.sendNonce = params.sendNonce;
      createForm.sendPubKey = params.sendPubKey;
      createForm.ethAddr = account!.ethAddr!;
    }

    // create token
    const {createHash, token} = await createCoin(createForm);
    createForm.createHash = createHash;
    createForm.token = token;
    // upload community info
    await createCommunity(createForm);

    // created token: prepare local data

    // add steem account
    accStore.setAccount({
      ...account!,
      steemId: account?.twitterUsername
    })
    
  } catch (e) {
    handleErrorTip(e)
  } finally {
    createLoading.value = false;
  }
};
</script>

<template>
  <chose-wallet v-if="accStore.ethConnectState !== EthWalletState.Connected" />
  <div v-else class="px-1 flex flex-col gap-y-10">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('createCommunity.createCommunity') }}</span>
      <img
        class="cursor-pointer"
        @click="modalStore.setModalVisible(false, GlobalModalType.CreateCoin)"
        src="~@/assets/icons/icon-modal-close.svg"
        alt=""
      />
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label for="name" class="leading-6 text-lg font-medium text-black">Name:</label>
        <input
          class="border-b-[1px] border-grey-e6 leading-6 text-base"
          v-model="createForm.tick"
          type="text"
          id="name"
          placeholder="KATC"
        />
      </div>
      <div class="flex flex-col gap-1">
        <label for="desc" class="leading-6 text-lg font-medium text-black"
          >Description:</label
        >
        <textarea
          class="border-b-[1px] border-grey-e6 leading-6 text-base"
          v-model="createForm.desc"
          id="desc"
          placeholder="LOOK AT THE CEOWD"
        />
      </div>
      <div class="flex items-center gap-4">
        <label for="logo" class="leading-6 text-lg font-medium text-black">Logo:</label>
        <div class="flex items-center gap-2">
          <img
            v-if="createForm.logoUrl"
            :src="createForm.logoUrl"
            class="w-11 h-11 min-w-11 min-h-11"
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
            :action="BACKEND_API_URL + '/qiniu/upload'"
            :on-success="uploadSuccess"
            :show-file-list="false"
            :before-upload="beforeUpload"
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
      <div class="flex flex-col gap-1">
        <label for="tags" class="leading-6 text-lg">Community Tag </label>
        <div class="border-b-[1px] border-grey-e6 flex items-center pb-1">
          <input
            class="leading-6 text-base flex-1"
            v-model="inputTag"
            @focus="onFocusTagInput"
            type="text"
            id="name"
            placeholder="KATC"
          />
          <button
            class="border-[1px] border-orange-light-active rounded-md px-2 flex items-center gap-1"
            @click="onAddTags"
          >
            <span class="text-gradient bg-gradient-primary">Add</span>
          </button>
        </div>
        <div v-if="createForm.tags!.length > 0" class="flex flex-wrap gap-4 mt-1">
          <span
            v-for="tag of createForm.tags"
            :key="tag"
            class="bg-green-b6 px-2 rounded-md text-green-hover"
            >#{{ tag }}</span
          >
        </div>
      </div>
    </div>
    <div class="pb-2">
      <button
        class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
        @click="create"
        :disabled="createLoading || accountMismatch"
      >
        <span>Create</span>
        <i-ep-loading v-if="createLoading" class="animate-spin" />
      </button>
      <div v-show="accountMismatch" class="mt-2 text-sm px-3 text-red-ff">
        {{ $t("web3.addressMismatch", { address: accStore.getAccountInfo?.ethAddr }) }}
      </div>
      <div class="flex justify-between items-center gap-2 mt-2 text-sm px-3">
        <span class="text-grey-normal">Cost to deploy：</span>
        <span class="text-red-ff italic">~ {{ (CreateFee as any) / 1e18 }} BTC</span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
