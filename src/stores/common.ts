import { ref } from 'vue'
import { defineStore } from 'pinia'
import {GlobalModalType, type IPShare} from "@/types";

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

export enum MintState {
  Payment,
  Inscribing,
  Inscribed
}

export enum IdType {
  BitIp,
  ENS,
  PayToken
}

export const useStateStore = defineStore('state', {
  state (){
    return {
      selectedBlks: [] as Array<number>,
      selectedAddresses: [] as Array<string>,
      selectedInsSats: 546,
      connector: 0,
      mintedBlk: [] as Array<number>,
      mintState: MintState.Payment,
      showBtcLogin: false,
      totalMinted: 0,
      selectedIPShare: {} as IPShare,
      globalLoginTip: false,
      showTwitterLogin: false,
      loginTipType: 'mint' as 'mint' | 'comment',
      referee: '' as string | null | undefined,
      idType: IdType.ENS 
    }
  },

})
