import {defineStore} from "pinia";
import {ref} from "vue";
import { useModalStore } from "./common";
import { GlobalModalType } from "@/types";

export enum LoginStepType {
  AuthTwitter,
  CreateWallet,
  BindEthAddress,
  CreateSocialAccount
}

export const useLoginStore = defineStore(
  'loginState', () => {
    const loginStep = ref(LoginStepType.BindEthAddress)
    const setLoginStep = (step: LoginStepType) => {
      const modalStore = useModalStore()
      loginStep.value = step
      modalStore.setModalVisible(true, GlobalModalType.Login)
    }

    return {
      loginStep,
      setLoginStep
    }
  })
