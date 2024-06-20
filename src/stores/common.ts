import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCreateCoinStore = defineStore(
  'createCoin', () => {
  const createModalVisible = ref(false)
  const setModalVisible = (visible: boolean) => {
    createModalVisible.value = visible
  }
  return { createModalVisible, setModalVisible }
})
