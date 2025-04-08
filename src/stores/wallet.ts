import { defineStore } from "pinia";
import { ref } from "vue";

export enum SocialAccountModalType {
  AddToken,
  WrapToken,
  EditAvailableBalance,
  EditCreditLimit
}
export const useSocialAccountModalStore = defineStore(
  'socialAccountModal', () => {
    const modalVisible = ref(false)
    const modalType = ref(SocialAccountModalType.AddToken)
    const modalCloseEnable = ref(true)
    const editTokenInfo = ref('')

    const setModalVisible = (visible: boolean, type: SocialAccountModalType = SocialAccountModalType.AddToken) => {
      if(!modalCloseEnable.value) return
      modalVisible.value = visible
      modalType.value = type
    }

    const setModalCloseEnable = (value: boolean) => {
      modalCloseEnable.value = value
    }

    const openAvailableBalanceModal = (tokenValue: string) => {
      editTokenInfo.value = tokenValue
      modalType.value = SocialAccountModalType.EditAvailableBalance
      modalVisible.value = true
    }

    const openCreditLimitModal = (tokenValue: string) => {
      editTokenInfo.value = tokenValue
      modalType.value = SocialAccountModalType.EditCreditLimit
      modalVisible.value = true
    }

    return {
      modalType,
      modalVisible,
      setModalVisible,
      modalCloseEnable,
      setModalCloseEnable,
      editTokenInfo,
      openAvailableBalanceModal,
      openCreditLimitModal
    }
  })
