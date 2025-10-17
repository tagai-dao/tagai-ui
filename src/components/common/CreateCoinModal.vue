<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { reactive, ref, computed, watch, onMounted, onUnmounted } from "vue";
import { GlobalModalType, type CreateCommunity } from "@/types";
import { CreateFee, BACKEND_API_URL, RegisterSteemMessage, BondingCurveSupply, PumpContract6 } from "@/config";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import ChoseWallet from "../login/ChoseWallet.vue";
import { useAccount } from "@/composables/useAccount";
import ERR_CODE from "@/errCode";
import { bytesToHex, formatPrice } from "@/utils/helper";
import { createCoin, calculateInitEth, checkTickUsed, getTokenPair, getImportTokenOnchainInfo, transferToken } from "@/utils/pump";
import { handleErrorTip, notify } from "@/utils/notify";
import { createCommunity, importCommunity, checkImportTokenDeployed } from '@/apis/api'
import {tagBgColors, tagTextColors} from "@/composables/useTags";
import emitter from '@/utils/emitter'
import {useUploadImg} from "@/composables/useUploadImg";
import ImageCropper from "@/components/common/ImageCropper.vue";
import { useTools } from "@/composables/useTools";
import debounce from "lodash.debounce";
import { parseEther, isAddress, checksumAddress, custom, parseUnits } from "viem";
import { signMessage } from "@/utils/wallets";

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

let importForm = reactive<CreateCommunity>({
  token: "",
  desc: "",
  logoUrl: "",
  tick: "",
  tags: [],
  ethAddr: "",
  twitter: "",
  telegram: "",
  pair: "",
  docs: "",
});

const importStep = ref(1);
const importErrTip = ref('');
const createLoading = ref(false);
const invalidTick = ['tiptag', 'tagai', 'deploy', 'no-tick-of-tiptag', 'no-tick-of-tagai', 'weth', 'wbnb', 'bnb', 'usdt', 'usdc', 'eth', 'btc', 'sol', 'iso', 'ixo']

// 分发策略相关
type DistributionPeriod = '1week' | '1month' | '1year';
const distributionStrategies = ref<Array<{
  period: DistributionPeriod,
  label: string,
  minAmount: number
}>>([
  { period: '1week', label: 'createCommunity.week1Distribution', minAmount: 10000 },
  { period: '1month', label: 'createCommunity.month1Distribution', minAmount: 50000 },
  { period: '1year', label: 'createCommunity.year1Distribution', minAmount: 200000 },
]);
const selectedPeriod = ref<DistributionPeriod | null>(null);
const customAmount = ref<number | undefined>(undefined);
const amountError = ref(false);
const showInvalidName = ref(false);
const showTickUsed = ref(false);
const showMaxAmount = ref(false);
const showTagForbidden = ref(false);
const showLongDesc = ref(false);
const importing = ref(false);
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
  importForm.logoUrl = completedImgUrl.value
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
    createForm.initAmount = parseEther(val.toString())
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
  if (createForm.tags!.length === 3 || importForm.tags!.length === 3) {
    return;
  }
  if (createForm.tags!.find((tag) => tag === inputTag.value) || importForm.tags!.find((tag) => tag === inputTag.value)) {
    return;
  }
  createForm.tags!.push(inputTag.value);
  importForm.tags!.push(inputTag.value);
  inputTag.value = "";
};

const onRemoveTags = (tag: string) => {
  createForm.tags = createForm.tags?.filter(item => item!==tag)
  importForm.tags = importForm.tags?.filter(item => item!==tag)
}

const uploadSuccess = (res: any, file: any) => {
  createForm.logoUrl = res.url;
  importForm.logoUrl = res.url;
  console.log('url1', res.url)
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
  if (invalidTick.includes(createForm.tick.toLowerCase())) {
    showTagForbidden.value = true;
    return false;
  }
  if (createForm.tick.match(/^(?!\d+$)[A-Za-z0-9\u4e00-\u9fa5]{1,16}$/)) {
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

let importInterval: any = null;

const checkImportment = () => {
  if (!importInterval) {
    importInterval = setInterval(async () => {
      if (importForm.transferHash && importForm.signature && importForm.infoStr) {
        try {
          importing.value = true;
          importStep.value = 5;
          useModalStore().setModalCloseEnable(true);
          console.log(1, importForm.transferHash)
          const deployed: any = await checkImportTokenDeployed(importForm.transferHash)
          console.log(2, deployed)
          if (deployed && deployed.status === 3) {
            importing.value = false;
            window.clearInterval(importInterval);
            importInterval = null;
          } else if (deployed && deployed.status === 4) {
            notify({message: deployed.deployError})
            window.clearInterval(importInterval);
            importInterval = null;
          }
        } catch (error) {
          console.log(235, error)
          if (error === ERR_CODE.PARAMS_ERROR) {
            try {
              await importCommunity(importForm, accStore.ethConnectAddress, importForm.signature, importForm.infoStr)
              return;
            } catch (e) {
              error = e
            }
          }
          window.clearInterval(importInterval);
          handleErrorTip(error)
          importInterval = null;
        }
      }
    }, 1500)
  }
}

// 选择分发策略
const selectPeriod = (period: DistributionPeriod) => {
  selectedPeriod.value = period;
  const strategy = distributionStrategies.value.find(s => s.period === period);
  // 默认设置为最低数量
  customAmount.value = strategy?.minAmount;
  amountError.value = false;
  // 同步到 importForm
  importForm.distributionPeriod = period;
  importForm.distributionAmount = customAmount.value;
};

// 验证自定义数量
const validateAmount = (period: DistributionPeriod) => {
  const strategy = distributionStrategies.value.find(s => s.period === period);
  if (!strategy) return;
  
  if (!customAmount.value || customAmount.value < strategy.minAmount) {
    amountError.value = true;
  } else {
    amountError.value = false;
    // 同步到 importForm
    importForm.distributionAmount = customAmount.value;
  }
};

const importTokenStepClick = async () => {
  try {
    createLoading.value = true
    importErrTip.value = ''
    if (importStep.value === 1) {
      console.log('token', importForm.token)
      if (!isAddress(importForm.token)) {
        importErrTip.value = 'Invalid token contract address'
        return
      }
      importForm.token = checksumAddress(importForm.token)
      // get token pair
      const pair = await getTokenPair(importForm.token)
      if (!isAddress(pair)) {
        importErrTip.value = 'Invalid token pair address'
        return
      }
      importForm.pair = pair
      // check pair price from pancake v2
      let tokenInfo = await getImportTokenOnchainInfo([{token: importForm.token, pair, dexVersion: 2}])

      tokenInfo = tokenInfo[importForm.token]
      if (!tokenInfo || isNaN(tokenInfo.price) || tokenInfo.price * tokenInfo.totalSupply < 1) {
        importErrTip.value = 'Token not in Pancake V2 Pool Or marketcap less than 1 BNB'
        return
      }

      if (tokenInfo.decimals != 18) {
        importErrTip.value = `Decimals: ${tokenInfo.decimals} is not supported now`
        return;
      }

      // check tick used
      if (await checkTickUsed(tokenInfo.symbol)) {
        importErrTip.value = `Tick<${tokenInfo.symbol}> has been used by other TagAI token`
        return
      }
      if (invalidTick.includes(tokenInfo.symbol.toLowerCase())) {
        importErrTip.value = 'Cannt set this symbol as a community tag.'
        return false;
      }
      importForm.tick = tokenInfo.symbol
      const totalSupply = tokenInfo.totalSupply
      importForm.decimals = tokenInfo.decimals

      distributionStrategies.value = [
        { period: '1week', label: 'createCommunity.week1Distribution', minAmount: totalSupply * 0.002 },
        { period: '1month', label: 'createCommunity.month1Distribution', minAmount: totalSupply * 0.005 },
        { period: '1year', label: 'createCommunity.year1Distribution', minAmount: totalSupply * 0.01 },
      ]
      
      importStep.value = 2
      console.log('tokenInfo', tokenInfo)
      
    } else if (importStep.value === 2) {
      // 验证是否选择了策略
      if (!selectedPeriod.value) {
        importErrTip.value = 'Please select a distribution strategy'
        return
      }
      // 验证金额
      const strategy = distributionStrategies.value.find(s => s.period === selectedPeriod.value);
      if (!customAmount.value || customAmount.value < (strategy?.minAmount || 0)) {
        amountError.value = true
        return
      }
      importStep.value = 3
    } else if (importStep.value === 3) {
      console.log('importForm', importForm)
      // check input info
      if (!importForm.logoUrl || importForm.logoUrl.length === 0) {
        notify({message: 'Need upload an image for your tag'})
        return;
      }

      if (importForm.desc.length > 1024){
        notify({message: 'The description must within 1024 characters.'})
        return;
      }

      // transfer token to social contract
      useModalStore().setModalCloseEnable(false);
      const txHash = await transferToken(importForm.token, PumpContract6, parseUnits(customAmount.value!.toString(), importForm.decimals ?? 18), false);
      importForm.transferHash = txHash
      importForm.ethAddr = accStore.ethConnectAddress;
      useModalStore().setModalCloseEnable(true);
      // cache info to local storage
      localStorage.setItem('importTokenForm', JSON.stringify(importForm))

      importStep.value = 4
    } else if (importStep.value === 4) {
      const infoStr = JSON.stringify({
        "contract": importForm.token,
        "distribution-period": importForm.distributionPeriod,
        "total-distributed": importForm.distributionAmount,
        "transfer-hash": importForm.transferHash,
        "creator": accStore.ethConnectAddress
      }, null, 4)
      const signature = await signMessage(infoStr)
      if (!signature) {
        notify({message: 'Failed to sign message, please try again.'})
        return
      }
      importForm.signature = signature
      importForm.infoStr = infoStr
      localStorage.setItem('importTokenForm', JSON.stringify(importForm))
      console.log({signature})
      await importCommunity(importForm, accStore.ethConnectAddress, signature, infoStr)
      importing.value = true;
      checkImportment();
      importStep.value = 5;
    } else if (importStep.value === 5) {
      clear()
      useModalStore().setModalCloseEnable(true);
      useModalStore().setModalVisible(false);
    }
  } catch (error) {
    console.error(error)
    handleErrorTip(error)
  } finally{
    createLoading.value = false
  }
}

const clear = () => {
  localStorage.removeItem('importTokenForm')
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
        localStorage.removeItem('createTokenForm')
      }else {
        try {
          await createCommunity(prevForm);
          localStorage.removeItem('createTokenForm')
        } catch (error) {
          if(error === 602) {
            localStorage.removeItem('createTokenForm')
          }
        }
      }
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
    createForm.createHash = createHash as string;
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
    const res = handleErrorTip(e)
    console.error('create community fail', res)

  } finally {
    createLoading.value = false;
  }
};

watch(() => createLoading.value, () => {
  modalStore.setModalCloseEnable(!createLoading.value)
})

onMounted(async () => {
  let importInfo: any = localStorage.getItem('importTokenForm')
  if (importInfo) {
    const info = JSON.parse(importInfo)
    if (info.signature) {
      activeTab.value = 'import';
      importForm = info;
      importStep.value = 4;
      useModalStore().setModalCloseEnable(false);
      checkImportment()
    }else if (info.transferHash) {
      activeTab.value = 'import';
      importForm = info;
      importStep.value = 3;
      useModalStore().setModalCloseEnable(false);
    }else {
      localStorage.removeItem('importTokenForm')
    }
  }
  let prevForm:any  = localStorage.getItem('createTokenForm')
  if (prevForm){
    prevForm = JSON.parse(prevForm)
    console.log('prevForm', prevForm)
    if(await checkTickUsed(prevForm.tick)){
      localStorage.removeItem('createTokenForm')
    }else {
      try {
        await createCommunity(prevForm);
        localStorage.removeItem('createTokenForm')
      } catch (error) {
        if(error === 602) {
          localStorage.removeItem('createTokenForm')
        }
      }
    }
  }
})

onUnmounted(() => {
  window.clearInterval(importInterval);
  importInterval = null;
})

</script>

<template>
  <chose-wallet v-if="accStore.ethConnectState !== EthWalletState.Connected && accStore.getWalletType !== 'privy'" />
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
    <div class="flex border-b border-grey-e6 mb-4">
      <div
        class="px-4 py-2 cursor-pointer text-lg text-bold"
        :class="{'border-b-2 border-orange-light-active': activeTab === 'token'}"
        @click="activeTab = 'token'"
      >
        {{$t('createCommunity.directly')}}
      </div>
      <div
        class="px-4 py-2 cursor-pointer text-lg bold"
        :class="{'border-b-2 border-orange-light-active': activeTab === 'import'}"
        @click="activeTab = 'import'"
      >
        {{$t('createCommunity.importToken')}}
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
              @keydown="(e: any) => {if (e.key === 'Enter' || e.key === 'Enter' || e.keyCode===13) { onAddTags()}}"
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

    <!-- 导入代币 -->
    <div v-else-if="activeTab=='import'" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1" v-show="importStep==1">
        <label for="tokenCA" class="leading-8 text-lg">{{$t('createCommunity.tokenCA')}}:</label>
        <p class="text-grey-normal text-ml">
          {{ $t('createCommunity.tokenCATip') }}
        </p>
        <input
          class="border-[2px] leading-6 text-ml h-10 rounded-lg p-5 text-center my-3 border-orange-light-active"
          v-model="importForm.token"
          type="text"
          id="tokenCA"
        />
        <p v-show="importErrTip.length > 0" class="text-red-e6 text-sm">
          {{ importErrTip }}
        </p>
      </div>

      <div class="flex flex-col gap-4" v-show="importStep==2">
        <div class="flex flex-col gap-1">
          <label class="leading-8 text-lg font-medium text-black">
            <span class="text-orange-normal h1 text-2xl text-bold">
              {{ importForm.tick }}
             </span>
             &nbsp;{{$t('createCommunity.distribution')}}:</label>
          <p class="text-grey-normal text-base">
            {{ $t('createCommunity.distributionTip') }}
          </p>
        </div>
        
        <!-- 分发策略卡片 -->
        <div class="flex flex-col gap-4">
          <div 
            v-for="strategy in distributionStrategies" 
            :key="strategy.period"
            @click="selectPeriod(strategy.period)"
            class="border-2 rounded-lg p-4 cursor-pointer transition-all duration-300"
            :class="{
              'border-grey-e6': selectedPeriod !== strategy.period && !amountError,
              'border-orange-light-active': selectedPeriod === strategy.period && !amountError,
              'border-red-e6': selectedPeriod === strategy.period && amountError,
              'bg-white': true
            }"
          >
            <!-- 卡片标题和最低数量 -->
            <div class="flex justify-between items-center">
              <span 
                class="font-medium transition-all duration-300"
                :class="{
                  'text-lg text-black': selectedPeriod !== strategy.period,
                  'text-2xl text-orange-normal': selectedPeriod === strategy.period
                }"
              >
                {{ $t(strategy.label) }}
              </span>
              <div class="flex items-center gap-1">
                <span class="text-sm text-grey-normal">{{ $t('createCommunity.minTokenAmount') }}:</span>
                <span class="text-base font-medium text-black">{{ strategy.minAmount.toLocaleString() }}</span>
              </div>
            </div>
            
            <!-- 自定义数量输入框 - 只在选中时显示，带动画 -->
            <div 
              class="overflow-hidden transition-all duration-300"
              :style="{
                maxHeight: selectedPeriod === strategy.period ? '100px' : '0px',
                opacity: selectedPeriod === strategy.period ? '1' : '0'
              }"
            >
              <div class="mt-4 flex flex-col gap-2">
                <label class="text-base font-medium text-black">{{ $t('createCommunity.customAmount') }}:</label>
                <input
                  v-model.number="customAmount"
                  @input="validateAmount(strategy.period)"
                  type="number"
                  class="border-b-[1px] border-grey-e6 leading-6 text-base py-2"
                  :placeholder="$t('createCommunity.pleaseInputAmount')"
                  @click.stop
                />
              </div>
            </div>
            
            <!-- 每日分发数量显示 -->
            <div 
              v-if="selectedPeriod === strategy.period && customAmount"
              class="mt-3 pt-3 border-grey-e6"
            >
              <!-- 一周和一月的简单显示 -->
              <div v-if="strategy.period === '1week' || strategy.period === '1month'" class="flex items-center gap-2">
                <span class="text-sm text-grey-normal">{{ $t('createCommunity.dailyDistribution') }}:</span>
                <span class="text-base font-medium text-orange-normal">
                  {{ Math.floor(customAmount / (strategy.period === '1week' ? 7 : 30)).toLocaleString() }}
                </span>
                <span class="text-sm text-grey-normal">{{ $t('createCommunity.tokensPerDay') }}</span>
              </div>
              
              <!-- 一年的分段显示 -->
              <div v-else-if="strategy.period === '1year'" class="flex flex-col gap-2">
                <div class="text-sm font-medium text-black mb-1">{{ $t('createCommunity.distributionSchedule') }}:</div>
                <div class="space-y-2 bg-grey-f0 rounded-lg p-3">
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-grey-normal">{{ $t('createCommunity.month1') }}:</span>
                    <span class="font-medium text-orange-normal">{{ Math.ceil(customAmount / 69 * 32 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-grey-normal">{{ $t('createCommunity.month2to3') }}:</span>
                    <span class="font-medium text-orange-normal"> {{ Math.ceil(customAmount / 69 * 8 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-grey-normal">{{ $t('createCommunity.month3to6') }}:</span>
                    <span class="font-medium text-orange-normal">{{ Math.ceil(customAmount / 69 * 4 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-grey-normal">{{ $t('createCommunity.month6to9') }}:</span>
                    <span class="font-medium text-orange-normal">{{ Math.ceil(customAmount / 69 * 2 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-grey-normal">{{ $t('createCommunity.month9to12') }}:</span>
                    <span class="font-medium text-orange-normal">{{ Math.ceil(customAmount / 69 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 错误提示 -->
        <p v-show="amountError && selectedPeriod" class="text-red-e6 text-sm -mt-2">
          {{ $t('createCommunity.amountLessThanMin') }}
        </p>
      </div>

      <!-- input community info: icon & description -->
      <div class="flex flex-col gap-1" v-show="importStep==3">
        <label class="leading-10  text-2xl text-bold">{{$t('createCommunity.communityInfo', {tick: importForm.tick})}}:</label>
        <!-- desc -->
        <div class="flex flex-col gap-1">
          <label for="desc" class="leading-6 text-lg font-medium text-black"
            >{{$t('createCommunity.description')}}:</label
          >
          <textarea
            class="border-b-[1px] border-grey-e6 leading-6 text-base"
            v-model="importForm.desc"
            id="desc"
            :placeholder="$t('createCommunity.descTag')"
          />
          <div class="text-red-e6 text-sm" v-show="showLongDesc">
            {{ $t('createCommunity.descTooLong') }}
          </div>
        </div>
        <!-- logo -->
        <div class="flex items-center gap-4 my-4">
          <label for="logo" class="leading-6 text-lg font-medium text-black">{{ $t('createCommunity.logo') }}:</label>
          <div class="flex items-center gap-2">
            <img
              v-if="importForm.logoUrl"
              :src="importForm.logoUrl"
              class="w-12 h-12 min-w-12 min-h-12 rounded-md"
              alt=""
            />
            <div
              v-else
              class="w-12 h-12 min-w-12 min-h-12 bg-grey-f0 rounded-full flex items-center justify-center"
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
              @keydown="(e: any) => {if (e.key === 'Enter' || e.key === 'Enter' || e.keyCode===13) { onAddTags()}}"
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
          <div v-if="importForm.tags!.length > 0" class="flex flex-wrap gap-4 mt-1">
            <button v-for="(tag, index) of importForm.tags" :key="tag"
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
              v-model="importForm.twitter"
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
              v-model="importForm.telegram"
              type="text"
              id="telegram"
              :placeholder="$t('createCommunity.telegramUrl')"
          />
        </div>
        <!-- telegram -->
        <div class="flex flex-col gap-1">
          <label for="docs" class="leading-6">{{$t('createCommunity.docs') + ' ' + $t('optional')}}:</label>
          <input
              class="border-b-[1px] border-grey-e6 leading-6 text-base"
              v-model="importForm.docs"
              type="text"
              id="docs"
              :placeholder="$t('createCommunity.docsUrl')"
          />
        </div>
       <p class="pt-3 text-red-e6 text-ml italic">
        {{$t('createCommunity.importTip', {amount: customAmount?.toLocaleString(), tick: importForm.tick})}}
       </p>
      </div>

      <!-- 确认信息页面 -->
      <div class="flex flex-col gap-4" v-show="importStep==4">
        <!-- 标题提示 -->
        <div class="flex flex-col gap-2 pb-2 border-b border-grey-e6">
          <h3 class="text-2xl font-bold text-black">{{ $t('createCommunity.signInfo') }}</h3>
          <p class="text-grey-normal text-base">{{ $t('createCommunity.signInfoTip') }}</p>
        </div>

        <!-- 基本信息卡片 -->
        <div class="bg-grey-f0 rounded-lg p-4 flex flex-col gap-4">
          <h4 class="text-lg font-semibold text-black border-b border-grey-e6 pb-2">{{ $t('createCommunity.basicInfo') }}</h4>
          
          <!-- Logo 和 Tick -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-3 flex-1">
              <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.logo') }}:</span>
              <img
                v-if="importForm.logoUrl"
                :src="importForm.logoUrl"
                class="w-16 h-16 rounded-lg shadow-sm"
                alt="Logo"
              />
            </div>
            <div class="flex items-center gap-3 flex-1">
              <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.tagTick') }}:</span>
              <span class="text-xl font-bold text-orange-normal">{{ importForm.tick }}</span>
            </div>
          </div>

          <!-- 合约地址 -->
          <div class="flex items-start gap-3">
            <span class="text-base text-grey-normal min-w-[80px] pt-1">{{ $t('createCommunity.contractAddress') }}:</span>
            <div class="flex-1 bg-white rounded px-3 py-2 font-mono text-sm break-all">
              {{ importForm.token }}
            </div>
          </div>

          <!-- 描述 -->
          <div class="flex flex-col gap-2">
            <span class="text-base text-grey-normal">{{ $t('createCommunity.description') }}:</span>
            <div class="bg-white rounded px-3 py-2 text-sm text-black whitespace-pre-wrap">
              {{ importForm.desc || $t('none') }}
            </div>
          </div>

          <!-- 分类标签 -->
          <div class="flex flex-col gap-2" v-if="importForm.tags && importForm.tags.length > 0">
            <span class="text-base text-grey-normal">{{ $t('createCommunity.categoryTag') }}:</span>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(tag, index) of importForm.tags" 
                :key="tag"
                :style="{backgroundColor: tagBgColors[index], color: tagTextColors[index]}"
                class="px-3 py-1 rounded-md text-sm"
              >
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>

        <!-- 分发策略卡片 -->
        <div class="bg-grey-f0 rounded-lg p-4 flex flex-col gap-4">
          <h4 class="text-lg font-semibold text-black border-b border-grey-e6 pb-2">{{ $t('createCommunity.distribution') }}</h4>
          
          <!-- 策略周期 -->
          <div class="flex items-center gap-3">
            <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.distribution') }}:</span>
            <span class="text-lg font-medium text-orange-normal">
              {{ $t(distributionStrategies.find(s => s.period === selectedPeriod)?.label || '') }}
            </span>
          </div>

          <!-- 分发数量 -->
          <div class="flex items-center gap-3">
            <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.totalDistributed') }}:</span>
            <span class="text-lg font-medium text-black">{{ customAmount?.toLocaleString() }} {{ importForm.tick }}</span>
          </div>

          <!-- 详细分发计划 -->
          <div class="bg-white rounded-lg p-3 flex flex-col gap-2">
            <div class="text-sm font-medium text-black mb-1">{{ $t('createCommunity.distributionSchedule') }}:</div>
            
            <!-- 一周的详细 -->
            <div v-if="selectedPeriod === '1week'" class="flex justify-between items-center text-sm">
              <span class="text-grey-normal">{{ $t('createCommunity.dailyDistribution') }}:</span>
              <span class="font-medium text-orange-normal">
                {{ Math.floor(customAmount! / 7).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
              </span>
            </div>

            <!-- 一月的详细 -->
            <div v-if="selectedPeriod === '1month'" class="flex justify-between items-center text-sm">
              <span class="text-grey-normal">{{ $t('createCommunity.dailyDistribution') }}:</span>
              <span class="font-medium text-orange-normal">
                {{ Math.floor(customAmount! / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
              </span>
            </div>

            <!-- 一年的详细 -->
            <div v-if="selectedPeriod === '1year'" class="space-y-2">
              <div class="flex justify-between items-center text-sm">
                <span class="text-grey-normal">{{ $t('createCommunity.month1') }}:</span>
                <span class="font-medium text-orange-normal">
                  {{ Math.ceil(customAmount! / 69 * 32 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
                </span>
              </div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-grey-normal">{{ $t('createCommunity.month2to3') }}:</span>
                <span class="font-medium text-orange-normal">
                  {{ Math.ceil(customAmount! / 69 * 8 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
                </span>
              </div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-grey-normal">{{ $t('createCommunity.month3to6') }}:</span>
                <span class="font-medium text-orange-normal">
                  {{ Math.ceil(customAmount! / 69 * 4 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
                </span>
              </div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-grey-normal">{{ $t('createCommunity.month6to9') }}:</span>
                <span class="font-medium text-orange-normal">
                  {{ Math.ceil(customAmount! / 69 * 2 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
                </span>
              </div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-grey-normal">{{ $t('createCommunity.month9to12') }}:</span>
                <span class="font-medium text-orange-normal">
                  {{ Math.ceil(customAmount! / 69 / 30).toLocaleString() }} {{ $t('createCommunity.tokensPerDay') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 社交链接卡片 -->
        <div class="bg-grey-f0 rounded-lg p-4 flex flex-col gap-4" v-if="importForm.twitter || importForm.telegram || importForm.docs">
          <h4 class="text-lg font-semibold text-black border-b border-grey-e6 pb-2">{{ $t('createCommunity.socialLinks') }}</h4>
          
          <!-- Twitter -->
          <div class="flex items-center gap-3" v-if="importForm.twitter">
            <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.twitter') }}:</span>
            <a :href="importForm.twitter" target="_blank" class="text-blue-500 hover:underline text-sm break-all">
              {{ importForm.twitter }}
            </a>
          </div>

          <!-- Telegram -->
          <div class="flex items-center gap-3" v-if="importForm.telegram">
            <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.telegram') }}:</span>
            <a :href="importForm.telegram" target="_blank" class="text-blue-500 hover:underline text-sm break-all">
              {{ importForm.telegram }}
            </a>
          </div>

          <!-- Docs -->
          <div class="flex items-center gap-3" v-if="importForm.docs">
            <span class="text-base text-grey-normal min-w-[80px]">{{ $t('createCommunity.docs') }}:</span>
            <a :href="importForm.docs" target="_blank" class="text-blue-500 hover:underline text-sm break-all">
              {{ importForm.docs }}
            </a>
          </div>
        </div>

        <!-- 转账哈希卡片 -->
        <div class="bg-orange-50 border-2 border-orange-light-active rounded-lg p-4 flex flex-col gap-3">
          <h4 class="text-lg font-semibold text-black border-b border-orange-light-active pb-2">{{ $t('createCommunity.transferHash') }}</h4>
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-white rounded px-3 py-2 font-mono text-sm break-all">
              {{ importForm.transferHash }}
            </div>
            <button 
              @click="onCopy(importForm.transferHash!)"
              class="min-w-[60px] h-9 bg-gradient-primary text-white rounded-md px-3 hover:opacity-90 transition-opacity"
            >
              {{ $t('copy') }}
            </button>
          </div>
        </div>
      </div>

      <div v-show="importStep==5" class="text-center">
        <!-- 庆祝动画容器 -->
        <div class="relative mb-6">
          <!-- 装饰性星星 -->
          <div class="absolute -top-2 -left-2 text-yellow-400 animate-pulse">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
          </div>
          <div class="absolute -top-1 -right-2 text-yellow-400 animate-pulse animation-delay-500">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
          </div>
        </div>

        <!-- 成功标题 -->
        <h3 class="text-2xl font-bold text-orange-normal mb-3">
          🎉 {{ importing ? $t('createCommunity.importing') : $t('createCommunity.importSuccess') }} 🎉
        </h3>
        
        <!-- 成功描述 -->
        <div 
        @click="clear()" class="bg-gradient-to-r from-orange-light to-orange-light-hover rounded-2xl p-6 mb-6 border border-orange-light-active">
          <p v-show="!importing" class="text-orange-normal text-lg font-medium mb-2">
            ✨ {{ $t('createCommunity.importSuccessTip') }} ✨
          </p>
          <p class="text-orange-normal text-sm mb-3">
            {{ importing ? $t('createCommunity.importingTip') : $t('createCommunity.importSuccessSubTip', '您的代币已成功导入到TipTag平台，现在可以开始使用啦！') }}
          </p>
          <!-- 跳转链接 -->
          <a v-show="!importing"
            :href="`/tag-detail/${importForm.tick}`" 
            class="inline-flex items-center gap-2 text-orange-normal hover:text-orange-normal-hover font-medium text-sm transition-colors duration-200"
          >
            <span>🚀 {{ $t('createCommunity.readyToUse') }}</span>
            <i-ep-arrow-right class="w-4 h-4" />
          </a>
        </div>
      </div>

      <div class="py-2 flex gap-2 justify-between mx-3">
        <button v-if="importStep > 1 && importStep != 4 && importStep != 5"
          class="h-12 flex-1 border border-gray-300 bg-gray-50 rounded-full text-gray-700 hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
          @click="importErrTip = '';importStep -= 1"
          :disabled="createLoading"
        >
          <span>{{ $t('createCommunity.lastStep') }}</span>
        </button>
        <button
          class="h-12 flex-1 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30 hover:shadow-lg transition-all duration-200"
          @click="importTokenStepClick"
          :disabled="createLoading || importing"
        >
          <span v-if="importStep === 5">🎉 {{ importing ? $t('createCommunity.importing') : $t('createCommunity.complete') }}</span>
          <span v-else>{{ importStep === 3 ? $t('createCommunity.transfer') : importStep === 4 ? $t('createCommunity.import') : $t('createCommunity.next') }}</span>
          <i-ep-loading v-if="createLoading || importing" class="animate-spin" />
        </button>
      </div>
    </div>

    <!-- 发推AI 部署 -->
    <div v-else-if="activeTab=='tweet'" class="flex flex-col gap-4">
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

<style scoped>
/* 自定义动画 */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.6s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.8s ease-out;
}

.animation-delay-200 {
  animation-delay: 0.2s;
  animation-fill-mode: both;
}

.animation-delay-500 {
  animation-delay: 0.5s;
  animation-fill-mode: both;
}

.animation-delay-1000 {
  animation-delay: 1s;
  animation-fill-mode: both;
}

/* 成功页面的特殊效果 */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-bounce {
  animation: bounce 2s infinite;
}

.animate-ping {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

/* 按钮悬停效果增强 */
button:hover {
  transform: translateY(-1px);
}
</style>
