import { getSettledTokens } from "@/apis/api";
import { WETH } from "@/config";
import type { SocialAccountTokens, TwitterTipRecord, TwitterTipErrorType } from "@/types";
import { getTokensInfo } from "@/utils/twitterTip";
import { defineStore } from "pinia";
import { ref } from "vue";
import { useAccountStore } from "./web3";

export enum SocialAccountModalType {
  AddToken,
  WrapBNB,
  EditAllowance,
  EditLimit,
  TipToken,
  ClaimTipToken
}
export const useSocialAccountModalStore = defineStore(
  'socialAccountModal', () => {
    const modalVisible = ref(false)
    const modalType = ref(SocialAccountModalType.AddToken)
    const modalCloseEnable = ref(true)
    const accStore = useAccountStore()

    const needClaim = ref(false)
    const socialAccountTokens = ref<SocialAccountTokens[]>([])
    const editTokenInfo = ref<SocialAccountTokens|null>(null)

    const setModalVisible = (visible: boolean, type: SocialAccountModalType = SocialAccountModalType.AddToken) => {
      if(!modalCloseEnable.value) return
      modalVisible.value = visible
      modalType.value = type
    }

    const updateSocialAccountTokens = async () => {
      let updatedTokens: any = await getSettledTokens(accStore.getAccountInfo.twitterId!)
      if (!updatedTokens || updatedTokens.length == 0) {
        updatedTokens = []
      }
      updatedTokens = [{
        token: WETH,
        tick: 'WBNB',
        logo: 'https://tiptag.oss-cn-shenzhen.aliyuncs.com/tagai/community/bnb-logo.svg'
      }].concat(updatedTokens)
      socialAccountTokens.value = await getTokensInfo(updatedTokens);
    }

    const setModalCloseEnable = (value: boolean) => {
      modalCloseEnable.value = value
    }

    const openAllowanceModal = (token: SocialAccountTokens) => {
      editTokenInfo.value = token
      modalType.value = SocialAccountModalType.EditAllowance
      modalVisible.value = true
    }

    const openLimitModal = (token: SocialAccountTokens) => {
      editTokenInfo.value = token
      modalType.value = SocialAccountModalType.EditLimit
      modalVisible.value = true
    }

    const openTipTokenModal = (token: SocialAccountTokens) => {
      editTokenInfo.value = token
      modalType.value = SocialAccountModalType.TipToken
      modalVisible.value = true
    }

    const openClaimTipTokenModal = () => {
      modalType.value = SocialAccountModalType.ClaimTipToken
      modalVisible.value = true
    }

    return {
      modalType,
      modalVisible,
      setModalVisible,
      modalCloseEnable,
      setModalCloseEnable,
      editTokenInfo,
      openAllowanceModal,
      openLimitModal,
      socialAccountTokens,
      updateSocialAccountTokens,
      openTipTokenModal,
      needClaim,
      openClaimTipTokenModal
    }
  })
