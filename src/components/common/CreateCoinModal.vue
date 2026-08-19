<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { computed, reactive, ref, watch, onMounted } from "vue";
import { GlobalModalType, type CreateCommunity } from "@/types";
import { BACKEND_API_URL, RegisterSteemMessage, BondingCurveSupply } from "@/config";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import ChoseWallet from "../login/ChoseWallet.vue";
import { useAccount } from "@/composables/useAccount";
import { bytesToHex, formatPrice } from "@/utils/helper";
import { createCoin, calculateInitEth, checkTickUsed, getCreatePumpFee, getTokenDexPools, getTokenERC20Info, deployNutboxCommunity, injectTokens, validateImportedTokenPool, type TokenDexResult, type DexPoolInfo } from "@/utils/pump";
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
import { useChainStore } from '@/stores/chain'

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
type PoolValidationState = { status: 'checking' | 'supported' | 'unsupported'; error?: string }
const poolValidation = ref<Record<string, PoolValidationState>>({});
const createLoading = ref(false);
const invalidTick = ['tiptag', 'tagai', 'deploy', 'no-tick-of-tiptag', 'no-tick-of-tagai', 'weth', 'wbnb', 'bnb', 'usdt', 'usdc', 'eth', 'btc', 'sol', 'iso', 'ixo']

const formatFDV = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

const poolValidationKey = (pool: DexPoolInfo) => pool.pairAddress.toLowerCase()
const getPoolValidation = (pool: DexPoolInfo): PoolValidationState =>
  poolValidation.value[poolValidationKey(pool)] ?? { status: 'checking' }
const shortAddress = (address: string) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Unknown'
const getPairedTokenLabel = (pool: DexPoolInfo) => pool.pairedTokenSymbol || shortAddress(pool.pairedToken)

const selectImportPool = (index: number) => {
  const pool = tokenDexResult.value?.pools[index]
  if (!pool || getPoolValidation(pool).status !== 'supported') return
  selectedPoolIndex.value = index
  importErrTip.value = ''
}

const validateImportPools = async (token: string, result: TokenDexResult) => {
  poolValidation.value = Object.fromEntries(result.pools.map(pool => [
    poolValidationKey(pool),
    { status: 'checking' as const },
  ]))

  // ImportedTokenSwapWrapper is currently the BSC imported-token executor.
  if (chainStore.deployment.key !== 'bsc') {
    poolValidation.value = Object.fromEntries(result.pools.map(pool => [
      poolValidationKey(pool),
      { status: 'supported' as const },
    ]))
    selectedPoolIndex.value = result.pools.length ? 0 : -1
    return
  }

  let cursor = 0
  const workerCount = Math.min(3, result.pools.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < result.pools.length) {
      const index = cursor++
      const pool = result.pools[index]
      const validation = await validateImportedTokenPool(token, pool.pairAddress, pool.dexVersion)
      poolValidation.value = {
        ...poolValidation.value,
        [poolValidationKey(pool)]: validation.supported
          ? { status: 'supported' }
          : { status: 'unsupported', error: validation.error || 'Quote or trade simulation failed' },
      }
    }
  }))

  selectedPoolIndex.value = result.pools.findIndex(pool =>
    getPoolValidation(pool).status === 'supported' && pool.bnbReserves >= 1
  )
  if (selectedPoolIndex.value < 0) {
    importErrTip.value = 'No pool passed both quote and trade validation'
  }
}

// 分发策略相关
const showInvalidName = ref(false);
const showTickUsed = ref(false);
const showMaxAmount = ref(false);
const showTagForbidden = ref(false);
const showLongDesc = ref(false);
const activeTab = ref('token');
const chainStore = useChainStore();
const nativeSymbol = computed(() => chainStore.nativeCurrency.symbol);
const dexName = computed(() => chainStore.deployment.dex.kind === 'pancake' ? 'PancakeSwap' : 'Uniswap');
const showAiDeployTab = computed(() => chainStore.deployment.key !== 'rh');

watch(showAiDeployTab, (visible) => {
  if (!visible && activeTab.value === 'tweet') activeTab.value = 'token';
}, { immediate: true });

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
    const fee = await getCreatePumpFee(addr as `0x${string}`)
    showingCreateFee.value = `~ ${formatPrice(Number(fee) / 1e18)}`
  } catch (e) {
    console.error('refreshCreateFee failed', e)
  }
}

watch([() => accStore.ethConnectAddress, () => chainStore.activeChainId], () => refreshCreateFee(), { immediate: true })

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
        importErrTip.value = `No ${dexName.value} pool found for this token`
        return
      }
      tokenDexResult.value = result
      selectedPoolIndex.value = -1

      // get ERC20 info from chain
      const erc20Info = await getTokenERC20Info(importForm.token)
      if (erc20Info.decimals != 18) {
        importErrTip.value = `Decimals: ${erc20Info.decimals} is not supported now`
        return;
      }

      // sanitize tick: replace spaces with underscores
      const tick = erc20Info.symbol.replace(/\s+/g, '_')
      // 与普通社区创建及后端 tick 校验保持一致：支持中文、字母、数字和下划线，
      // 长度 1–16，且不能是纯数字。
      if (!tick || !/^(?!\d+$)[A-Za-z0-9\u4e00-\u9fa5_]{1,16}$/.test(tick)) {
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
      await validateImportPools(importForm.token, result)

    } else if (importStep.value === 2) {
      // pool selection
      if (selectedPoolIndex.value < 0 || !tokenDexResult.value) {
        importErrTip.value = 'Please select a pool'
        return
      }
      const pool = tokenDexResult.value.pools[selectedPoolIndex.value]
      if (getPoolValidation(pool).status !== 'supported') {
        importErrTip.value = 'Selected pool does not support quoting and trading'
        return
      }
      if (pool.bnbReserves < 1) {
        importErrTip.value = `Selected pool liquidity must be greater than 1 ${nativeSymbol.value}`
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
    const {createHash, token, version} = await createCoin(createForm);
    createForm.createHash = createHash as string;
    createForm.token = token;
    createForm.version = version;
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
  <div v-else class="create-modal">
    <header class="create-modal__header">
      <div class="create-modal__identity">
        <div class="create-modal__mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none">
            <path d="M14 4v20M4 14h20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="m7 8 3 3m11-3-3 3M7 20l3-3m11 3-3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".55" />
          </svg>
        </div>
        <div>
          <h2>{{ $t('createCommunity.createCommunity') }}</h2>
          <span>{{ chainStore.deployment.name }} · {{ chainStore.nativeCurrency.symbol }}</span>
        </div>
      </div>
      <button
        type="button"
        class="create-modal__close"
        :aria-label="$t('cancel')"
        @click="modalStore.setModalVisible(false, GlobalModalType.CreateCoin)"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <nav class="create-tabs" :aria-label="$t('createCommunity.createCommunity')">
      <button type="button" :class="{ active: activeTab === 'token' }" @click="activeTab = 'token'">
        {{ $t('createCommunity.directly') }}
      </button>
      <button type="button" :class="{ active: activeTab === 'import' }" @click="activeTab = 'import'">
        {{ $t('createCommunity.importToken') }}
      </button>
      <button
        v-if="showAiDeployTab"
        type="button"
        :class="{ active: activeTab === 'tweet' }"
        @click="activeTab = 'tweet'"
      >
        {{ $t('createCommunity.byAI') }}
      </button>
    </nav>

    <div class="create-modal__scroll no-scroll-bar">
      <!-- 创建代币内容 -->
      <div v-if="activeTab === 'token'" class="token-form">
        <section class="form-section form-section--basic">
          <div class="section-title">
            <span>01</span>
            <div>
              <h3>{{ $t('createCommunity.basicInfo') }}</h3>
              <p>{{ $t('createCommunity.communityInfoTip') }}</p>
            </div>
          </div>

          <div class="basic-grid">
            <div class="basic-fields">
              <label class="field-label" for="coin-tick">
                <span>{{ $t('createCommunity.tagTick') }}</span>
                <em>1–16</em>
              </label>
              <div class="field-control field-control--prefix">
                <span>#</span>
                <input
                  id="coin-tick"
                  v-model="createForm.tick"
                  type="text"
                  :placeholder="$t('createCommunity.tagTick')"
                >
              </div>
              <div v-show="showInvalidName" class="field-error">{{ $t('createCommunity.invalidTickTip') }}</div>
              <div v-show="showTickUsed" class="field-error">{{ $t('createCommunity.tickUsed') }}</div>
              <div v-show="showTagForbidden" class="field-error">{{ $t('createCommunity.tagForbidden') }}</div>
            </div>

            <div class="logo-field">
              <span class="field-label">{{ $t('createCommunity.logo') }}</span>
              <el-upload
                class="logo-uploader"
                action="#"
                :http-request="(options: any) => openImageCropper(options)"
                :on-success="uploadSuccess"
                :show-file-list="false"
                :before-upload="beforeUpload"
              >
                <div class="logo-preview">
                  <img v-if="createForm.logoUrl" :src="createForm.logoUrl" alt="">
                  <img v-else-if="uploading" class="animate-spin logo-loading" src="~@/assets/icons/loading.svg" alt="">
                  <svg v-else viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect x="5" y="7" width="22" height="18" rx="4" stroke="currentColor" stroke-width="1.5" />
                    <circle cx="12" cy="13" r="2" stroke="currentColor" stroke-width="1.5" />
                    <path d="m8 22 5-5 4 4 3-3 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="logo-add">+</span>
                </div>
              </el-upload>
              <div v-if="showOnlyPic" class="field-error">{{ $t('createCommunity.onlyPicTip') }}</div>
              <div v-if="showPicSizeLimit" class="field-error">{{ $t('createCommunity.picSizeLimitTip') }}</div>
            </div>
          </div>

          <div class="description-field">
            <label class="field-label" for="coin-desc">
              <span>{{ $t('createCommunity.description') }}</span>
              <em>{{ createForm.desc?.length || 0 }}/1024</em>
            </label>
            <textarea
              id="coin-desc"
              v-model="createForm.desc"
              class="field-control"
              :placeholder="$t('createCommunity.descTag')"
            />
            <div v-show="showLongDesc" class="field-error">{{ $t('createCommunity.descTooLong') }}</div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-title">
            <span>02</span>
            <div>
              <h3>{{ $t('createCommunity.socialLinks') }}</h3>
              <p>{{ $t('optional') }}</p>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="coin-tags">
              <span>{{ $t('createCommunity.categoryTag') }}</span>
              <em>{{ createForm.tags?.length || 0 }}/3</em>
            </label>
            <div class="field-control tag-input">
              <span>#</span>
              <input
                id="coin-tags"
                v-model="inputTag"
                type="text"
                :placeholder="$t('tag')"
                @focus="onFocusTagInput"
                @keydown="(e: any) => { if (e.key === 'Enter' || e.keyCode === 13) onAddTags() }"
              >
              <button type="button" @click="onAddTags">{{ $t('createCommunity.add') }}</button>
            </div>
            <div v-if="createForm.tags!.length > 0" class="tag-list">
              <button
                v-for="(tag, index) of createForm.tags"
                :key="tag"
                type="button"
                :style="getTagStyle(index)"
                @click="onRemoveTags(tag)"
              >
                #{{ tag }} <span>×</span>
              </button>
            </div>
          </div>

          <div class="social-grid">
            <div class="field-group">
              <label class="field-label" for="twitter">{{ $t('createCommunity.twitter') }}</label>
              <div class="field-control field-control--icon"><span>𝕏</span><input id="twitter" v-model="createForm.twitter" type="text" :placeholder="$t('createCommunity.twitterUrl')"></div>
            </div>
            <div class="field-group">
              <label class="field-label" for="telegram">{{ $t('createCommunity.telegram') }}</label>
              <div class="field-control field-control--icon"><span>↗</span><input id="telegram" v-model="createForm.telegram" type="text" :placeholder="$t('createCommunity.telegramUrl')"></div>
            </div>
            <div class="field-group social-grid__wide">
              <label class="field-label" for="docs">{{ $t('createCommunity.docs') }}</label>
              <div class="field-control field-control--icon"><span>⌘</span><input id="docs" v-model="createForm.docs" type="text" :placeholder="$t('createCommunity.docsUrl')"></div>
            </div>
          </div>
        </section>

        <section class="form-section purchase-section">
          <div class="section-title">
            <span>03</span>
            <div>
              <h3>{{ $t('createCommunity.buyTip') }}</h3>
              <p>{{ $t('optional') }}</p>
            </div>
          </div>
          <div class="purchase-input">
            <input
              id="initamount"
              v-model="showingInitAmount"
              type="number"
              placeholder="0"
            >
            <span>TagCoin</span>
          </div>
          <div v-show="showMaxAmount" class="field-error">{{ $t('createCommunity.maxAmountTip') }}</div>
          <div class="purchase-summary">
            <span>{{ $t('pay') }} {{ showingInitEth }} {{ nativeSymbol }}</span>
            <strong>{{ $t('createCommunity.costTopDeploy') }} <em>{{ showingCreateFee }} {{ nativeSymbol }}</em></strong>
          </div>
        </section>

        <div class="create-submit">
          <button type="button" :disabled="createLoading" @click="create">
            <span>{{ $t('createCommunity.create') }}</span>
            <svg v-if="!createLoading" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 14 14 6m0 0H8m6 0v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <i-ep-loading v-else class="animate-spin" />
          </button>
        </div>
      </div>

    <!-- 导入代币 -->
    <div v-else-if="activeTab=='import'" class="tab-panel tab-panel--import flex flex-col gap-4">
      <div class="flex flex-col gap-1" v-show="importStep==1">
        <label for="tokenCA" class="leading-8 text-lg">{{$t('createCommunity.tokenCA')}}:</label>
        <p class="text-grey-normal text-ml">
          {{ $t('createCommunity.tokenCATip', { chain: chainStore.deployment.name, dex: dexName, symbol: nativeSymbol }) }}
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
            @click="selectImportPool(index)"
            class="import-pool-card border-2 rounded-lg p-3 cursor-pointer transition-all duration-200"
            :class="{
              'import-pool-card--selected': selectedPoolIndex === index,
              'import-pool-card--disabled': getPoolValidation(pool).status === 'unsupported',
              'cursor-wait': getPoolValidation(pool).status === 'checking'
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
                <span class="font-semibold text-black">
                  {{ tokenDexResult.tokenSymbol }} / {{ getPairedTokenLabel(pool) }}
                </span>
              </div>
              <span class="text-sm font-medium" :class="pool.bnbReserves >= 1 ? 'text-green-600' : 'text-red-e6'">
                {{ pool.bnbReserves.toFixed(2) }} {{ nativeSymbol }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-2 mb-2 text-xs">
              <span class="text-grey-normal font-mono" :title="pool.pairedToken">
                Quote: {{ getPairedTokenLabel(pool) }} ({{ shortAddress(pool.pairedToken) }})
              </span>
              <span v-if="getPoolValidation(pool).status === 'checking'" class="text-grey-normal">
                Checking quote &amp; trade…
              </span>
              <span v-else-if="getPoolValidation(pool).status === 'supported'" class="text-green-600 font-medium">
                ✓ Quote &amp; trade supported
              </span>
              <span v-else class="text-red-e6 font-medium" :title="getPoolValidation(pool).error">
                ✕ Unsupported
              </span>
            </div>
            <p
              v-if="getPoolValidation(pool).status === 'unsupported'"
              class="text-red-e6 text-xs mb-2 break-words"
            >
              {{ getPoolValidation(pool).error }}
            </p>
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
        <div class="selected-pool-summary rounded-lg p-3" v-if="tokenDexResult && selectedPoolIndex >= 0">
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
            <span class="text-sm font-semibold text-black">
              {{ tokenDexResult.tokenSymbol }} / {{ getPairedTokenLabel(tokenDexResult.pools[selectedPoolIndex]) }}
            </span>
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
  </div>
</template>

<style scoped>
:global(.create-token-dialog) {
  overflow: hidden;
  padding: 0 !important;
  border: 1px solid var(--border-base);
  background: var(--surface) !important;
  box-shadow: 0 30px 90px rgba(5, 7, 14, .25);
}

:global(.create-token-dialog .el-dialog__body) { padding: 0 !important; }

.create-modal {
  position: relative;
  display: flex;
  max-height: min(86vh, 860px);
  flex-direction: column;
  color: var(--text-base);
  background:
    radial-gradient(circle at 8% 0%, rgba(254,145,63,.08), transparent 18rem),
    radial-gradient(circle at 96% 8%, rgba(141,103,232,.08), transparent 18rem),
    var(--surface);
}

.create-modal__header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 26px 18px;
}

.create-modal__identity { display: flex; min-width: 0; align-items: center; gap: 13px; }
.create-modal__mark { display: grid; width: 44px; height: 44px; flex-shrink: 0; place-items: center; border-radius: 14px; background: linear-gradient(135deg, #ffad62, #fe7f21 54%, #8d67e8); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 10px 26px rgba(254,126,33,.2); }
.create-modal__mark svg { width: 26px; height: 26px; }
.create-modal__identity h2 { color: var(--text-base); font-size: 22px; font-weight: 750; line-height: 28px; letter-spacing: -.035em; }
.create-modal__identity > div > span { display: block; margin-top: 2px; color: var(--text-muted); font-size: 10px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.create-modal__close { display: grid; width: 38px; height: 38px; flex-shrink: 0; place-items: center; border: 1px solid var(--border-base); border-radius: 12px; background: color-mix(in srgb, var(--surface-2) 65%, transparent); color: var(--text-muted); transition: color 160ms ease, background 160ms ease, transform 160ms ease; }
.create-modal__close:hover { transform: rotate(4deg); background: var(--surface-2); color: var(--text-base); }
.create-modal__close svg { width: 22px; height: 22px; }

.create-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 5px;
  margin: 0 26px;
  padding: 4px;
  border-radius: 14px;
  background: var(--surface-2);
}

.create-tabs button { display: inline-flex; min-width: 0; flex: 1; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 12px; border-radius: 11px; color: var(--text-muted); font-size: 12px; font-weight: 650; transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease; }
.create-tabs button.active { background: var(--surface); color: var(--text-base); box-shadow: 0 6px 20px rgba(10,12,20,.08); }

.create-modal__scroll { min-height: 0; overflow-y: auto; padding: 22px 26px 26px; }
.token-form { display: flex; flex-direction: column; gap: 14px; }
.form-section { padding: 20px; border: 1px solid var(--border-base); border-radius: 20px; background: color-mix(in srgb, var(--surface) 94%, transparent); }
.section-title { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 18px; }
.section-title > span { display: grid; width: 28px; height: 28px; flex-shrink: 0; place-items: center; border: 1px solid rgba(254,145,63,.25); border-radius: 9px; background: rgba(254,145,63,.08); color: #e77a27; font-size: 9px; font-weight: 800; }
.section-title h3 { color: var(--text-base); font-size: 14px; font-weight: 720; line-height: 18px; }
.section-title p { margin-top: 2px; color: var(--text-muted); font-size: 10px; line-height: 15px; }

.basic-grid { display: grid; grid-template-columns: minmax(0, 1fr) 92px; align-items: start; gap: 18px; }
.basic-fields, .field-group, .description-field, .logo-field { min-width: 0; }
.description-field { margin-top: 16px; }
.field-label { display: flex; min-height: 18px; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 7px; color: var(--text-base); font-size: 11px; font-weight: 650; }
.field-label em { color: var(--text-muted); font-size: 9px; font-style: normal; font-weight: 500; }
.logo-field .field-label { justify-content: center; }

.field-control { display: flex; width: 100%; min-height: 44px; align-items: center; gap: 9px; padding: 0 13px; border: 1px solid var(--border-base); border-radius: 12px; outline: 0; background: color-mix(in srgb, var(--surface-2) 58%, transparent); color: var(--text-base); font-size: 12px; transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease; }
.field-control:focus, .field-control:focus-within { border-color: rgba(254,145,63,.75); background: var(--surface); box-shadow: 0 0 0 3px rgba(254,145,63,.08); }
.field-control > input, .field-control > textarea, .field-control input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 12px; }
.field-control input::placeholder, textarea.field-control::placeholder { color: var(--text-faint); }
.field-control--prefix > span { color: #e77a27; font-size: 16px; font-weight: 750; }
.field-control--icon > span { display: grid; width: 22px; height: 22px; flex-shrink: 0; place-items: center; border-radius: 7px; background: var(--surface); color: var(--text-muted); font-size: 11px; font-weight: 750; }
textarea.field-control { min-height: 90px; resize: vertical; align-items: flex-start; padding-top: 12px; line-height: 18px; }
.field-error { margin-top: 6px; color: var(--color-down); font-size: 9px; line-height: 14px; }

.logo-preview { position: relative; display: grid; width: 82px; height: 82px; overflow: hidden; place-items: center; border: 1px dashed color-mix(in srgb, var(--border-base) 75%, #fe913f); border-radius: 18px; background: color-mix(in srgb, var(--surface-2) 58%, transparent); color: var(--text-muted); cursor: pointer; transition: border-color 160ms ease, transform 160ms ease; }
.logo-preview:hover { border-color: #fe913f; transform: translateY(-1px); }
.logo-preview > img:not(.logo-loading) { width: 100%; height: 100%; object-fit: cover; }
.logo-preview > svg { width: 31px; height: 31px; }
.logo-loading { width: 22px; height: 22px; }
.logo-add { position: absolute; right: 7px; bottom: 7px; display: grid; width: 21px; height: 21px; place-items: center; border-radius: 7px; background: linear-gradient(135deg, #f99c48, #f0782a); color: #fff; font-size: 15px; line-height: 1; box-shadow: 0 5px 12px rgba(240,120,42,.25); }

.tag-input button { flex-shrink: 0; height: 29px; padding: 0 11px; border-radius: 8px; background: rgba(254,145,63,.1); color: #e77a27; font-size: 10px; font-weight: 750; }
.tag-list { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.tag-list button { padding: 4px 9px; border-radius: 8px; font-size: 10px; }
.tag-list button span { margin-left: 4px; opacity: .65; }
.social-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
.social-grid__wide { grid-column: 1 / -1; }

.purchase-section { background: linear-gradient(125deg, color-mix(in srgb, var(--surface) 92%, #fe913f 8%), var(--surface) 58%, color-mix(in srgb, var(--surface) 94%, #8d67e8 6%)); }
.purchase-input { display: flex; min-height: 58px; align-items: center; gap: 10px; padding: 0 15px; border: 1px solid var(--border-base); border-radius: 15px; background: var(--surface); }
.purchase-input:focus-within { border-color: rgba(254,145,63,.75); box-shadow: 0 0 0 3px rgba(254,145,63,.08); }
.purchase-input input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 23px; font-weight: 700; letter-spacing: -.03em; }
.purchase-input span { flex-shrink: 0; padding: 6px 9px; border-radius: 9px; background: var(--surface-2); color: #e77a27; font-size: 10px; font-weight: 750; }
.purchase-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; color: var(--text-muted); font-size: 10px; }
.purchase-summary strong { color: var(--text-muted); font-weight: 550; }
.purchase-summary em { margin-left: 5px; color: var(--text-base); font-style: normal; font-weight: 750; }

.create-submit { padding: 4px 2px 0; }
.create-submit button { display: flex; width: 100%; height: 50px; align-items: center; justify-content: center; gap: 8px; border-radius: 15px; background: linear-gradient(115deg, #ff9d47, #f0782a 58%, #e96d1d); color: #fff; font-size: 13px; font-weight: 750; box-shadow: 0 14px 30px rgba(240,120,42,.24); transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease; }
.create-submit button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 17px 36px rgba(240,120,42,.3); }
.create-submit button:disabled { opacity: .45; cursor: wait; }
.create-submit svg { width: 18px; height: 18px; }
.tab-panel { min-height: 280px; padding: 20px; border: 1px solid var(--border-base); border-radius: 20px; background: var(--surface); }

.animate-fade-in { animation: fade-in .5s ease-out; }
.animate-slide-up { animation: slide-up .6s ease-out; }
.animation-delay-200 { animation-delay: .2s; animation-fill-mode: both; }
.animation-delay-500 { animation-delay: .5s; animation-fill-mode: both; }
.animation-delay-1000 { animation-delay: 1s; animation-fill-mode: both; }
.animate-pulse { animation: pulse 2s cubic-bezier(.4,0,.6,1) infinite; }
.animate-bounce { animation: bounce 2s infinite; }
.animate-ping { animation: ping 1s cubic-bezier(0,0,.2,1) infinite; }

@keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

.import-pool-card {
  background-color: var(--surface);
  border-color: var(--border-base);
  color: var(--text-base);
}

.import-pool-card--selected {
  background-color: var(--pool-selected-bg);
  border-color: #fe913f;
}

.import-pool-card--disabled {
  cursor: not-allowed;
  opacity: .62;
}

.import-pool-card--selected .text-black {
  color: var(--text-base) !important;
}

.import-pool-card--selected .text-grey-normal {
  color: var(--text-muted) !important;
}

.selected-pool-summary {
  background-color: var(--surface-2);
  color: var(--text-base);
}

@media (max-width: 640px) {
  :global(.create-token-dialog) { width: calc(100% - 20px) !important; border-radius: 20px !important; }
  .create-modal { max-height: 88vh; }
  .create-modal__header { padding: 18px 18px 14px; }
  .create-modal__mark { width: 40px; height: 40px; border-radius: 13px; }
  .create-modal__identity h2 { font-size: 19px; }
  .create-tabs { margin: 0 18px; }
  .create-tabs button { gap: 5px; padding: 0 6px; font-size: 10px; }
  .create-modal__scroll { padding: 16px 18px 20px; }
  .form-section { padding: 16px; border-radius: 17px; }
  .basic-grid { grid-template-columns: minmax(0, 1fr) 76px; gap: 13px; }
  .logo-preview { width: 70px; height: 70px; border-radius: 15px; }
  .social-grid { grid-template-columns: 1fr; }
  .social-grid__wide { grid-column: auto; }
  .purchase-summary { align-items: flex-start; flex-direction: column; gap: 5px; }
}

</style>
