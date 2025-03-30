<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { reactive, ref, computed, watch } from "vue";
import { GlobalModalType, type CreateCommunity } from "@/types";
import { CreateFee, BACKEND_API_URL, RegisterSteemMessage, BondingCurveSupply } from "@/config";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import ChoseWallet from "../login/ChoseWallet.vue";
import { useAccount } from "@/composables/useAccount";
import { box, generateSteemAuth } from "@/utils/web3";
import { signMessage } from "@/utils/wallets";
import { ethers } from "ethers";
import { bytesToHex, formatPrice } from "@/utils/helper";
import { createCoin, calculateInitEth, checkTickUsed } from "@/utils/pump";
import { handleErrorTip, notify } from "@/utils/notify";
import { createCommunity } from '@/apis/api'
import {tagBgColors, tagTextColors} from "@/composables/useTags";
import emitter from '@/utils/emitter'
import {useUploadImg} from "@/composables/useUploadImg";
import ImageCropper from "@/components/common/ImageCropper.vue";
import { useTools } from "@/composables/useTools";
import debounce from "lodash.debounce";

const modalStore = useModalStore();

const createForm = reactive<CreateCommunity>({
  tick: "",
  desc: "",
  logoUrl: "",
  tags: [],
  token: "",
  ethAddr: "",
  twitter: "",
  telegram: "",
  docs: "",
});
const createLoading = ref(false);
const showInvalidName = ref(false);
const showTickUsed = ref(false);
const showMaxAmount = ref(false);
const showTagForbidden = ref(false);
const showLongDesc = ref(false);
const activeTab = ref('token');

const accStore = useAccountStore();
const inputTag = ref("");
const addTagTip = ref("");

const { accountMismatch, checkLogin } = useAccount();
const {
  uploading,
  cropperModalVisible,
  cropperImgSrc,
  showOnlyPic,
  showPicSizeLimit,
  completedImgUrl,
  openImageCropper,
  onCroppingAndUpload
} = useUploadImg()
const { onCopy } = useTools()

watch(() => completedImgUrl.value, (value) => {
  createForm.logoUrl = completedImgUrl.value
})

const showingInitAmount = ref<number|undefined>()
const showingInitEth = ref<string|undefined>('$0')

watch(() => showingInitAmount.value, debounce(async (val: number) => {
  if (val && val > 0) {
    if (val > BondingCurveSupply) {
      showMaxAmount.value = true
      createForm.initAmount = 0n
      createForm.initEth = 0n
      return;
    }
    showMaxAmount.value = false
    createForm.initAmount = ethers.parseEther(val.toString())
    createForm.initEth = await calculateInitEth(createForm.initAmount)
    showingInitEth.value = formatPrice((createForm.initEth as any).toString() / 1e18)
  }else {
    createForm.initAmount = 0n
    createForm.initEth = 0n
  }
}, 500))

const onAddTags = () => {
  inputTag.value = inputTag.value.trim();
  if (inputTag.value.length == 0) return;
  if (createForm.tags!.length === 3) {
    return;
  }
  if (createForm.tags!.find((tag) => tag === inputTag.value)) {
    return;
  }
  createForm.tags!.push(inputTag.value);
  inputTag.value = "";
};

const onRemoveTags = (tag: string) => {
  createForm.tags = createForm.tags?.filter(item => item!==tag)
}

const uploadSuccess = (res: any, file: any) => {
  createForm.logoUrl = res.url;
  console.log('url', res.url)
  uploading.value = false;
};

const beforeUpload = (file: any) => {
  uploading.value = true;
};

const onFocusTagInput = () => {
  if (addTagTip.value) {
    addTagTip.value = "";
    inputTag.value = "";
  }
  inputTag.value = "";
};

const testTick = async () => {
  showInvalidName.value = false;
  showTickUsed.value = false;
  showTagForbidden.value = false;
  const invalidTick = ['tiptag', 'tagai', 'deploy', 'no-tick-of-tiptag', 'no-tick-of-tagai']
  if (invalidTick.includes(createForm.tick.toLowerCase())) {
    showTagForbidden.value = true;
    return false;
  }
  if (createForm.tick.match(/^[a-zA-Z]{1,16}$/)) {
    const created = await checkTickUsed(createForm.tick);
    console.log('created', created)
    if (created) {
      showTickUsed.value = true
      return false
    }
    return true;
  }
  showInvalidName.value = true
  return false
}

const create = async () => {
  const connetctedEthAddr = accStore.ethConnectAddress;
  try {
    createLoading.value = true;
    // check params
    showInvalidName.value = false
    showLongDesc.value = false

    let prevForm:any  = localStorage.getItem('createTokenForm')
    if (prevForm){
      prevForm = JSON.parse(prevForm)
      console.log('prevForm', prevForm)
      if(await checkTickUsed(prevForm.tick)){
      }else {
        await createCommunity(prevForm);
      }
      localStorage.removeItem('createTokenForm')
    }

    if (!(await testTick())) {
      console.log('testTick failed')
      return;
    }
    
    if (!createForm.logoUrl || createForm.logoUrl.length === 0) {
      notify({message: 'Need upload an image for your tag'})
      return;
    }

    if (createForm.desc.length > 1024){
      showLongDesc.value = true;
      return;
    }
    // create token
    const {createHash, token} = await createCoin(createForm);
    createForm.createHash = createHash;
    createForm.token = token;
    // upload community info
    delete createForm.initAmount
    delete createForm.initEth
    localStorage.setItem('createTokenForm', JSON.stringify(createForm))
    await createCommunity(createForm);
    localStorage.removeItem('createTokenForm')

    // created token: prepair local data
    emitter.emit('newCommunity', createForm);
    modalStore.setModalCloseEnable(true)
    modalStore.setModalVisible(false)
  } catch (e) {
    console.error('create community fail', e)
    handleErrorTip(e)
  } finally {
    createLoading.value = false;
  }
};

watch(() => createLoading.value, () => {
  modalStore.setModalCloseEnable(!createLoading.value)
})
</script>

<template>
  <chose-wallet v-if="accStore.ethConnectState !== EthWalletState.Connected" />
  <div v-else class="flex flex-col gap-y-2 max-h-[70vh] overflow-auto no-scroll-bar">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('createCommunity.createCommunity') }}</span>
      <img
        class="cursor-pointer"
        @click="modalStore.setModalVisible(false, GlobalModalType.CreateCoin)"
        src="~@/assets/icons/icon-modal-close.svg"
        alt=""
      />
    </div>

    <!-- 选项卡 -->
    <div class="flex border-b border-grey-e6 mb-4" v-if="false">
      <div
        class="px-4 py-2 cursor-pointer text-lg text-bold"
        :class="{'border-b-2 border-orange-light-active': activeTab === 'token'}"
        @click="activeTab = 'token'"
      >
        {{$t('createCommunity.directly')}}
      </div>
      <div
        class="px-4 py-2 cursor-pointer text-lg bold"
        :class="{'border-b-2 border-orange-light-active': activeTab === 'tweet'}"
        @click="activeTab = 'tweet'"
      >
        {{$t('createCommunity.byAI')}}
      </div>
    </div>

    <!-- 创建代币内容 -->
    <div v-if="activeTab === 'token'">
      <div class="flex flex-col gap-4">
      <!-- name -->
        <div class="flex flex-col gap-1">
          <label for="name" class="leading-6 text-lg font-medium text-black">{{$t('createCommunity.tagTick')}}:</label>
          <input
            class="border-b-[1px] border-grey-e6 leading-6 text-base"
            v-model="createForm.tick"
            type="text"
            id="name"
            :placeholder="$t('createCommunity.invalidTickTip')"
          />
          <div class="text-red-e6 text-sm" v-show="showInvalidName">
            {{ $t('createCommunity.invalidTickTip') }}
          </div>
          <div class="text-red-e6 text-sm" v-show="showTickUsed">
            {{ $t('createCommunity.tickUsed') }}
          </div>
          <div class="text-red-e6 text-sm" v-show="showTagForbidden">
            {{ $t('createCommunity.tagForbidden') }}
          </div>
        </div>
        <!-- desc -->
        <div class="flex flex-col gap-1">
          <label for="desc" class="leading-6 text-lg font-medium text-black"
            >{{$t('createCommunity.description')}}:</label
          >
          <textarea
            class="border-b-[1px] border-grey-e6 leading-6 text-base"
            v-model="createForm.desc"
            id="desc"
            :placeholder="$t('createCommunity.descTag')"
          />
          <div class="text-red-e6 text-sm" v-show="showLongDesc">
            {{ $t('createCommunity.descTooLong') }}
          </div>
        </div>
        <!-- logo -->
        <div class="flex items-center gap-4">
          <label for="logo" class="leading-6 text-lg font-medium text-black">{{ $t('createCommunity.logo') }}:</label>
          <div class="flex items-center gap-2">
            <img
              v-if="createForm.logoUrl"
              :src="createForm.logoUrl"
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
            <div v-if="showOnlyPic" class="text-red-e6">
              {{$t('createCommunity.onlyPicTip')}}
            </div>
            <div v-if="showPicSizeLimit" class="text-red-e6">
              {{$t('createCommunity.picSizeLimitTip')}}
            </div>
          </div>
        </div>
        <!-- tag -->
        <div class="flex flex-col gap-1">
          <label for="tags" class="leading-6 text-lg">{{$t('createCommunity.categoryTag') + ' ' + $t('optional')}} </label>
          <div class="border-b-[1px] border-grey-e6 flex items-center pb-1">
            <input
              class="leading-6 text-base flex-1"
              v-model="inputTag"
              @focus="onFocusTagInput"
              @keydown="(e) => {if (e.key === 'Enter' || e.key === 'Enter' || e.keyCode===13) { onAddTags()}}"
              type="text"
              id="name"
              :placeholder="$t('tag')"
            />
            <button
              class="border-[1px] border-orange-light-active rounded-md px-2 flex items-center gap-1"
              @click="onAddTags"
            >
              <span class="text-gradient bg-gradient-primary">{{ $t('createCommunity.add') }}</span>
            </button>
          </div>
          <div v-if="createForm.tags!.length > 0" class="flex flex-wrap gap-4 mt-1">
            <button v-for="(tag, index) of createForm.tags" :key="tag"
                    @click="onRemoveTags(tag)"
                    :style="{backgroundColor: tagBgColors[index], color: tagTextColors[index]}"
                    class="px-2 rounded-md">#{{ tag }}</button>
          </div>
        </div>
        <!-- twitter -->
        <div class="flex flex-col gap-1">
          <label for="twitter" class="leading-6 text-lg">{{$t('createCommunity.twitter') + ' ' + $t('optional')}}:</label>
          <input
              class="border-b-[1px] border-grey-e6 leading-6 text-base"
              v-model="createForm.twitter"
              type="text"
              id="twitter"
              :placeholder="$t('createCommunity.twitterUrl')"
          />
        </div>
        <!-- telegram -->
        <div class="flex flex-col gap-1">
          <label for="telegram" class="leading-6 text-lg">{{$t('createCommunity.telegram') + ' ' + $t('optional')}}:</label>
          <input
              class="border-b-[1px] border-grey-e6 leading-6 text-base"
              v-model="createForm.telegram"
              type="text"
              id="telegram"
              :placeholder="$t('createCommunity.telegramUrl')"
          />
        </div>
        <!-- telegram -->
        <div class="flex flex-col gap-1">
          <label for="docs" class="leading-6 text-lg">{{$t('createCommunity.docs') + ' ' + $t('optional')}}:</label>
          <input
              class="border-b-[1px] border-grey-e6 leading-6 text-base"
              v-model="createForm.docs"
              type="text"
              id="docs"
              :placeholder="$t('createCommunity.docsUrl')"
          />
        </div>
        <!-- amount -->
        <div class="flex flex-col gap-1">
          <label for="initamount" class="font-medium text-black text-lg">
            {{ $t('createCommunity.buyTip') }}
          </label>
          <div class="flex items-center border-b-[1px] border-grey-e6 gap-2 h-14">
            <input
                class="flex-1 leading-6 text-base"
                v-model="showingInitAmount"
                type="number"
                id="initamount"
                :placeholder="$t('createCommunity.initAmountTip')"
            />
            <span class="italic text-red-e6">TagCoin</span>
          </div>
          <div class="text-red-e6 text-sm" v-show="showMaxAmount">
              {{ $t("createCommunity.maxAmountTip") }}
          </div>
          <div class="text-left text-grey-normal">
            {{ $t('createCommunity.initEth', {amount: showingInitEth}) }}
          </div>
        </div>
      </div>
      <div class="py-2">
        <button
          class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
          @click="create"
          :disabled="createLoading"
        >
          <span>{{ $t('createCommunity.create') }}</span>
          <i-ep-loading v-if="createLoading" class="animate-spin" />
        </button>
        <!-- <div v-show="accountMismatch && !accStore.getAccountInfo?.twitterId" class="mt-2 text-sm px-3 text-red-e6">
          {{ $t("web3.addressMismatch", { address: accStore.getAccountInfo?.ethAddr }) }}
        </div> -->

        <div class="text-red-e6 text-sm" v-show="showInvalidName">
          {{ $t('createCommunity.invalidTickTip') }}
        </div>
        <div class="text-red-e6 text-sm" v-show="showTickUsed">
          {{ $t('createCommunity.tickUsed') }}
        </div>
        <div class="text-red-e6 text-sm" v-show="showTagForbidden">
          {{ $t('createCommunity.tagForbidden') }}
        </div>
        <div class="flex justify-between items-center gap-2 mt-2 text-sm px-3">
          <span class="text-grey-normal">{{$t('createCommunity.costTopDeploy')}}</span>
          <span class="text-red-e6 italic">~ {{ (CreateFee as any) / 1e18 }} BNB</span>
        </div>
      </div>
    </div>

    <!-- 发推内容 -->
    <div v-else class="flex flex-col gap-4">
      <div class="text-center text-grey-normal">
        <div class="flex flex-col text-left gap-1">
          <p class="text-grey-normal text-lg font-medium mb-2">
            {{$t('createCommunity.deployTip')}}
          </p>
          <p>
            • {{$t('createCommunity.deployTip1')}}
          </p>
          <p>
            • {{ $t('createCommunity.deployTip2') }}
          </p>
          <p>
            • {{$t('createCommunity.deployTip3')}}
          </p>
          <div class="text-blue-500 flex text-center justify-center text-lg my-8 items-center">
            @TipTagAi #deploy
            <button class="ml-2" @click="onCopy(`@TipTagAi #deploy`)">
                <img class="w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="">
              </button>
          </div>
        </div>
      </div>
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
