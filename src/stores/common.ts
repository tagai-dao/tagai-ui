import { ref } from 'vue'
import { defineStore } from 'pinia'
import {GlobalModalType} from "@/types";

export const useModalStore = defineStore(
  'globalModal', () => {
  const modalVisible = ref(false)
  const modalType = ref(GlobalModalType.CreateCoin)
  const setModalVisible = (visible: boolean, type: GlobalModalType = GlobalModalType.CreateCoin) => {
    modalVisible.value = visible
    modalType.value = type
  }

  return {
    modalType,
    modalVisible,
    setModalVisible
  }
})
