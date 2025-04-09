import type { SocialAccountTokens, TwitterTipRecord, TwitterTipErrorType } from "@/types";
import { getTokensInfo } from "@/utils/twitterTip";
import { defineStore } from "pinia";
import { ref } from "vue";

export enum SocialAccountModalType {
  AddToken,
  WrapBNB,
  EditAllowance,
  EditLimit,
  TipToken
}
export const useSocialAccountModalStore = defineStore(
  'socialAccountModal', () => {
    const modalVisible = ref(false)
    const modalType = ref(SocialAccountModalType.AddToken)
    const modalCloseEnable = ref(true)
    const socialAccountTokens = ref<SocialAccountTokens[]>([])
    const editTokenInfo = ref<SocialAccountTokens|null>(null)
    const tipTokenRecords = ref<TwitterTipRecord[]>([])

    const setModalVisible = (visible: boolean, type: SocialAccountModalType = SocialAccountModalType.AddToken) => {
      if(!modalCloseEnable.value) return
      modalVisible.value = visible
      modalType.value = type
    }

    const updateSocialAccountTokens = async () => {
      socialAccountTokens.value = await getTokensInfo(socialAccountTokens.value);
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
      tipTokenRecords
    }
  })
