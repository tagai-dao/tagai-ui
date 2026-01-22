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
      // 主菜单：'tag' 或 'coin'
      activeMainMenu: 'tag' as 'tag' | 'coin',
      // Tag 菜单的子标签页：'tweets' 或 'prediction'
      tagSubMenu: 'tweets' as 'tweets' | 'prediction',
      // Coin 菜单的子标签页：'tagCoin' 或 'ip'
      coinSubMenu: 'tagCoin' as 'tagCoin' | 'ip',
      // 兼容旧代码，保持 activeHomeTab
      activeHomeTab: 'tweets' as 'tweets' | 'prediction' | 'tagCoin' | 'ip',
      homeSubMenu: 'tweets' as 'tweets' | 'prediction',
    }
  },
  actions: {
    // 设置主菜单
    setActiveMainMenu(menu: 'tag' | 'coin') {
      this.activeMainMenu = menu
      // 根据主菜单设置 activeHomeTab（兼容旧代码）
      if (menu === 'tag') {
        this.activeHomeTab = this.tagSubMenu
      } else {
        this.activeHomeTab = this.coinSubMenu
      }
    },
    // 设置 Tag 子菜单
    setTagSubMenu(subMenu: 'tweets' | 'prediction') {
      this.tagSubMenu = subMenu
      this.activeHomeTab = subMenu
      this.activeMainMenu = 'tag'
    },
    // 设置 Coin 子菜单
    setCoinSubMenu(subMenu: 'tagCoin' | 'ip') {
      this.coinSubMenu = subMenu
      this.activeHomeTab = subMenu
      this.activeMainMenu = 'coin'
    },
    // 兼容旧代码的方法
    setActiveHomeTab(tab: 'tweets' | 'prediction' | 'tagCoin' | 'ip') {
      this.activeHomeTab = tab
      if (tab === 'tweets' || tab === 'prediction') {
        this.tagSubMenu = tab
        this.activeMainMenu = 'tag'
        this.homeSubMenu = tab
      } else if (tab === 'tagCoin' || tab === 'ip') {
        this.coinSubMenu = tab
        this.activeMainMenu = 'coin'
      }
    }
  }
})
