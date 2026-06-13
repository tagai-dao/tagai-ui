<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { reactive, ref, watch, onMounted } from "vue";
import { GlobalModalType, type CreateCommunity } from "@/types";
import { BACKEND_API_URL, RegisterSteemMessage, BondingCurveSupply } from "@/config";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import ChoseWallet from "../login/ChoseWallet.vue";
import { useAccount } from "@/composables/useAccount";
import { bytesToHex, formatPrice } from "@/utils/helper";
import { createCoin, calculateInitEth, checkTickUsed, getPump9CreateFee, getTokenDexPools, getTokenERC20Info, deployNutboxCommunity, injectTokens, type TokenDexResult, type DexPoolInfo } from "@/utils/pump";
import { handleErrorTip, notify } from "@/utils/notify";
import { createCommunity, importCommunity } from '@/apis/api'
import { getTagStyle } from '@/composables/useTags'
import emitter from '@/utils/emitter'
import {useUploadImg} from "@/composables/useUploadImg";
import ImageCropper from "@/components/common/ImageCropper.vue";
import { useTools } from "@/composables/useTools";
import debounce from "lodash.debounce";
import { parseEther, isAddress, checksumAddress, parseUnits } from "viem";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
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
const tokenDexResult = ref<TokenDexResult | null>(null);
const selectedPoolIndex = ref(-1);
const createLoading = ref(false);
const invalidTick = ['tiptag', 'tagai', 'deploy', 'no-tick-of-tiptag', 'no-tick-of-tagai', 'weth', 'wbnb', 'bnb', 'usdt', 'usdc', 'eth', 'btc', 'sol', 'iso', 'ixo']

const formatFDV = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

// 分发策略相关
const showInvalidName = ref(false);
const showTickUsed = ref(false);
const showMaxAmount = ref(false);
const showTagForbidden = ref(false);
const showLongDesc = ref(false);
const activeTab = ref('token');

// V10 导入代币相关
const communityAddress = ref('');
const socialPoolAddress = ref('');
const injectAmount = ref<number | undefined>(undefined);
const injectLoading = ref(false);
const tokenBalance = ref<bigint>(0n);

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
const showingCreateFee = ref('~ 0.01')

async function refreshCreateFee() {
  const addr = accStore.ethConnectAddress
  if (!addr || !isAddress(addr)) {
    showingCreateFee.value = '~ --'
    return
  }
  try {
    const fee = await getPump9CreateFee(addr as `0x${string}`)
    showingCreateFee.value = `~ ${formatPrice(Number(fee) / 1e18)}`
  } catch (e) {
    console.error('refreshCreateFee failed', e)
  }
}

watch(() => accStore.ethConnectAddress, () => refreshCreateFee(), { immediate: true })

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
  if (createForm.tick.match(/^(?!\d+$)[A-Za-z0-9\u4e00-\u9fa5_]{1,16}$/)) {
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

      // get dex pools + token info
      const result = await getTokenDexPools(importForm.token)
      if (!result || result.pools.length === 0) {
        importErrTip.value = 'No PancakeSwap pool found for this token'
        return
      }
      tokenDexResult.value = result
      selectedPoolIndex.value = 0

      // get ERC20 info from chain
      const erc20Info = await getTokenERC20Info(importForm.token)
      if (erc20Info.decimals != 18) {
        importErrTip.value = `Decimals: ${erc20Info.decimals} is not supported now`
        return;
      }

      // sanitize tick: replace spaces with underscores
      const tick = erc20Info.symbol.replace(/\s+/g, '_')
      if (!tick || !/^[a-zA-Z0-9_]+$/.test(tick)) {
        importErrTip.value = `Token symbol "${erc20Info.symbol}" is not valid`
        return
      }
      // check tick used
      if (await checkTickUsed(tick)) {
        importErrTip.value = `Tick<${tick}> has been used by other TagAI token`
        return
      }
      if (invalidTick.includes(tick.toLowerCase())) {
        importErrTip.value = 'Cannt set this symbol as a community tag.'
        return false;
      }
      importForm.tick = tick
      importForm.decimals = erc20Info.decimals
      importStep.value = 2

    } else if (importStep.value === 2) {
      // pool selection
      if (selectedPoolIndex.value < 0 || !tokenDexResult.value) {
        importErrTip.value = 'Please select a pool'
        return
      }
      const pool = tokenDexResult.value.pools[selectedPoolIndex.value]
      if (pool.bnbReserves < 1) {
        importErrTip.value = 'Selected pool liquidity must be greater than 1 BNB'
        return
      }
      importForm.pair = pool.pairAddress
      importForm.dexVersion = pool.dexVersion
      importStep.value = 3

    } else if (importStep.value === 3) {
      // 链上部署 Nutbox Community + 后端入库
      useModalStore().setModalCloseEnable(false);
      const result = await deployNutboxCommunity(importForm.token as `0x${string}`)
      communityAddress.value = result.community
      socialPoolAddress.value = result.pool
      importForm.createHash = result.txHash
      importForm.communityAddress = result.community
      importForm.socialPoolAddress = result.pool
      importForm.ethAddr = accStore.ethConnectAddress;

      // 设置 logo 和 desc（从 GeckoTerminal 获取的信息）
      if (tokenDexResult.value) {
        if (!importForm.logoUrl && tokenDexResult.value.tokenLogo) {
          importForm.logoUrl = tokenDexResult.value.tokenLogo
        }
        if (!importForm.desc && tokenDexResult.value.tokenName) {
          importForm.desc = tokenDexResult.value.tokenName
        }
      }

      // 调用后端 API 入库
      try {
        await importCommunity(importForm, accStore.ethConnectAddress, '', '')
      } catch (error) {
        useModalStore().setModalCloseEnable(true);
        handleErrorTip(error)
        return
      }
      useModalStore().setModalCloseEnable(true);
      localStorage.setItem('importTokenForm', JSON.stringify(importForm))
      importStep.value = 4

    } else if (importStep.value === 4) {
      // 注入代币（可选）或跳过
      if (injectAmount.value && injectAmount.value > 0) {
        injectLoading.value = true
        try {
          const amount = parseUnits(injectAmount.value.toString(), importForm.decimals ?? 18)
          await injectTokens(communityAddress.value as `0x${string}`, importForm.token as `0x${string}`, amount)
          notify({message: t('createCommunity.socialDistEnabled')})
        } catch (error) {
          handleErrorTip(error)
          return
        } finally {
          injectLoading.value = false
        }
      }
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
  localStorage.removeItem('importTokenForm')
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
                    :style="getTagStyle(index)"
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
          <span class="text-red-e6 italic">{{ showingCreateFee }} BNB</span>
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

      <!-- Step 2: Pool selection -->
      <div class="flex flex-col gap-3" v-show="importStep==2" v-if="tokenDexResult">
        <!-- Token info header -->
        <div class="flex items-center gap-3 pb-2 border-b border-grey-e6">
          <img v-if="tokenDexResult.tokenLogo" :src="tokenDexResult.tokenLogo" class="w-10 h-10 rounded-full" @error="($event.target as HTMLImageElement).style.display='none'" />
          <div class="flex flex-col">
            <span class="text-xl font-bold text-black">{{ tokenDexResult.tokenName || tokenDexResult.tokenSymbol }}</span>
            <span class="text-sm text-grey-normal">{{ tokenDexResult.tokenSymbol }} · ${{ Number(tokenDexResult.tokenPrice).toFixed(6) }} · FDV ${{ formatFDV(tokenDexResult.fdv) }}</span>
          </div>
        </div>

        <p class="text-grey-normal text-sm">Select a pool to use ({{ tokenDexResult.pools.length }} found):</p>

        <!-- Pool list -->
        <div class="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          <div
            v-for="(pool, index) in tokenDexResult.pools"
            :key="pool.pairAddress"
            @click="selectedPoolIndex = index"
            class="border-2 rounded-lg p-3 cursor-pointer transition-all duration-200"
            :class="{
              'border-orange-light-active bg-orange-50': selectedPoolIndex === index,
              'border-grey-e6 bg-white': selectedPoolIndex !== index
            }"
          >
            <div class="flex justify-between items-center mb-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-xs font-bold text-white"
                  :class="{
                    'bg-purple-500': pool.dexVersion === 4,
                    'bg-blue-500': pool.dexVersion === 3,
                    'bg-green-500': pool.dexVersion === 2
                  }"
                >V{{ pool.dexVersion }}</span>
                <span class="font-medium text-black">{{ pool.feeTier }}</span>
              </div>
              <span class="text-sm font-medium" :class="pool.bnbReserves >= 1 ? 'text-green-600' : 'text-red-e6'">
                {{ pool.bnbReserves.toFixed(2) }} BNB
              </span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="text-grey-normal">Liquidity</span>
                <p class="text-black font-medium">${{ formatFDV(pool.liquidityUsd) }}</p>
              </div>
              <div>
                <span class="text-grey-normal">24h Volume</span>
                <p class="text-black font-medium">${{ formatFDV(pool.volume24h) }}</p>
              </div>
              <div>
                <span class="text-grey-normal">24h Txns</span>
                <p class="text-black font-medium">{{ pool.txCount24h }}</p>
              </div>
            </div>
          </div>
        </div>
        <p v-show="importErrTip.length > 0" class="text-red-e6 text-sm">
          {{ importErrTip }}
        </p>
      </div>

      <!-- Step 3: Deploy community -->
      <div class="flex flex-col gap-4" v-show="importStep==3">
        <!-- Token info summary -->
        <div class="flex items-center gap-3 pb-3 border-b border-grey-e6" v-if="tokenDexResult">
          <img v-if="tokenDexResult.tokenLogo" :src="tokenDexResult.tokenLogo" class="w-12 h-12 rounded-full" @error="($event.target as HTMLImageElement).style.display='none'" />
          <div class="flex flex-col flex-1">
            <span class="text-xl font-bold text-black">{{ tokenDexResult.tokenName || tokenDexResult.tokenSymbol }}</span>
            <span class="text-sm text-grey-normal">{{ tokenDexResult.tokenSymbol }} · ${{ Number(tokenDexResult.tokenPrice).toFixed(6) }} · FDV ${{ formatFDV(tokenDexResult.fdv) }}</span>
          </div>
        </div>

        <!-- Selected pool info -->
        <div class="bg-grey-f0 rounded-lg p-3" v-if="tokenDexResult && selectedPoolIndex >= 0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm text-grey-normal">Selected Pool:</span>
            <span class="px-2 py-0.5 rounded text-xs font-bold text-white"
              :class="{
                'bg-purple-500': tokenDexResult.pools[selectedPoolIndex]?.dexVersion === 4,
                'bg-blue-500': tokenDexResult.pools[selectedPoolIndex]?.dexVersion === 3,
                'bg-green-500': tokenDexResult.pools[selectedPoolIndex]?.dexVersion === 2
              }"
            >V{{ tokenDexResult.pools[selectedPoolIndex]?.dexVersion }}</span>
            <span class="text-sm font-medium text-black">{{ tokenDexResult.pools[selectedPoolIndex]?.feeTier }}</span>
          </div>
          <div class="text-xs text-grey-normal font-mono break-all">{{ importForm.pair }}</div>
        </div>
      </div>

      <!-- Step 4: Inject tokens (optional) -->
      <div class="flex flex-col gap-4" v-show="importStep==4">
        <!-- Success message -->
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p class="text-green-700 font-medium text-lg">{{ $t('createCommunity.communityCreated') }}</p>
          <p class="text-green-600 text-sm mt-1 font-mono break-all">{{ communityAddress }}</p>
        </div>

        <!-- Inject tokens prompt -->
        <div class="bg-grey-f0 rounded-lg p-4 flex flex-col gap-3">
          <h4 class="text-lg font-semibold text-black">{{ $t('createCommunity.enableSocialDist') }}</h4>
          <p class="text-grey-normal text-sm leading-relaxed">
            {{ $t('createCommunity.enableSocialDistTip', { days: 7 }) }}
          </p>

          <div class="flex flex-col gap-2 mt-2">
            <label class="text-base font-medium text-black">{{ $t('createCommunity.injectAmount') }}:</label>
            <input
              v-model.number="injectAmount"
              type="number"
              class="border-b-[1px] border-grey-e6 leading-6 text-base py-2"
              :placeholder="$t('createCommunity.injectAmountPlaceholder')"
            />
          </div>
        </div>
      </div>


      <div class="py-2 flex gap-2 justify-between mx-3">
        importStep: {{ importStep }}
        <button v-if="importStep > 1 && importStep < 4"
          class="h-12 flex-1 border border-gray-300 bg-gray-50 rounded-full text-gray-700 hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
          @click="importErrTip = '';importStep -= 1"
          :disabled="createLoading"
        >
          <span>{{ $t('createCommunity.lastStep') }}</span>
        </button>
        <button
          class="h-12 flex-1 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30 hover:shadow-lg transition-all duration-200"
          @click="importTokenStepClick"
          :disabled="createLoading || injectLoading"
        >
          <span v-if="importStep === 3">{{ $t('createCommunity.createCommunity') }}</span>
          <span v-else-if="importStep === 4">{{ injectAmount ? $t('createCommunity.enableDistribution') : $t('createCommunity.skipAndComplete') }}</span>
          <span v-else>{{ $t('createCommunity.next') }}</span>
          <i-ep-loading v-if="createLoading || injectLoading" class="animate-spin" />
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
            @launchonbnb #deploy
            <button class="ml-2" @click="onCopy(`@launchonbnb #deploy`)">
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
