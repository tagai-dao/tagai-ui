import { ref } from 'vue'
import { defineStore } from 'pinia'
import {GlobalModalType} from "@/types";

export const useModalStore = defineStore(
  'globalModal', () => {
  const modalVisible = ref(false)
  const modalType = ref(GlobalModalType.CreateCoin)
  const modalCloseEnable = ref(true)
  const setModalVisible = (visible: boolean, type: GlobalModalType = GlobalModalType.CreateCoin) => {
    if(!modalCloseEnable.value) return
    modalVisible.value = visible
    modalType.value = type
  }

  const setModalCloseEnable = (value: boolean) => {
    modalCloseEnable.value = value
  }

  return {
    modalType,
    modalVisible,
    setModalVisible,
    modalCloseEnable,
    setModalCloseEnable
  }
})

export enum IdType {
  BitIp,
  ENS,
  PayToken
}

export const useStateStore = defineStore('state', {
  state (){
    return {
      referee: '' as string | null | undefined,
      idType: IdType.ENS,
      ethPrice: 0,
      sellsman: ''
    }
  },

})
