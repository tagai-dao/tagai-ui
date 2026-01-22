import { ref } from 'vue'
import { defineStore } from 'pinia'
import {GlobalModalType} from "@/types";

export const useModalStore = defineStore(
  'globalModal', () => {
  const modalVisible = ref(false)
  const modalType = ref(GlobalModalType.CreateCoin)
  const modalCloseEnable = ref(true)
  const modalParams = ref<any>(null)

  const setModalVisible = (visible: boolean, type: GlobalModalType = GlobalModalType.CreateCoin, params: any = null) => {
    if(!modalCloseEnable.value) return
    modalVisible.value = visible
    modalType.value = type
    modalParams.value = params
  }

  const setModalCloseEnable = (value: boolean) => {
    modalCloseEnable.value = value
  }

  return {
    modalType,
    modalVisible,
    modalParams,
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
      sellsman: '',
      activeHomeTab: 'tweets' as 'tweets' | 'prediction' | 'tagCoin' | 'ip',
      homeSubMenu: 'tweets' as 'tweets' | 'prediction',
      coinSubMenu: 'tagCoin' as 'tagCoin' | 'ip'
    }
  },
  actions: {
    setActiveHomeTab(tab: 'tweets' | 'prediction' | 'tagCoin' | 'ip') {
      this.activeHomeTab = tab
      if (tab === 'tweets' || tab === 'prediction') {
        this.homeSubMenu = tab
      } else if (tab === 'tagCoin' || tab === 'ip') {
        this.coinSubMenu = tab
      }
    }
  }
})
