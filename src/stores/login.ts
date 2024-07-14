import {defineStore} from "pinia";
import {ref} from "vue";

export enum LoginStepType {
  AuthTwitter,
  CreateWallet,
  BindAddress
}

export const useLoginStore = defineStore(
  'loginState', () => {
    const loginStep = ref(LoginStepType.BindAddress)
    const setLoginStep = (step: LoginStepType) => {
      loginStep.value = step
    }

    return {
      loginStep,
      setLoginStep
    }
  })
