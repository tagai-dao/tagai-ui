<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MindShareType } from '@/types'
import MindShare from './MindShare.vue'

const router = useRouter()
const mindShareType = ref<MindShareType>(MindShareType.Project)

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="flex flex-col h-full bg-grey-light">
    <!-- Top Bar - 仅移动端显示 -->
    <div class="web:hidden flex justify-between items-center px-4 py-3 bg-white sticky top-0 z-10">
      <div 
        class="w-8 h-8 flex items-center justify-center rounded-full bg-grey-light cursor-pointer hover:opacity-80 active:scale-95 transition-all"
        @click="goBack"
      >
        <i-ep-arrow-left class="text-xl text-black" />
      </div>
      <h2>
        {{ $t('mindshare') }}
      </h2>
      <!-- 移动端：选择器显示在顶部栏 -->
      <el-select
        v-model="mindShareType"
        class="web:hidden bg-white rounded-full overflow-hidden max-w-[100px] c-select h-10 flex items-center text-h4 text-black"
        popper-class="c-select-popper rounded-xl"
      >
        <el-option :value="MindShareType.Project" :label="$t('mindShare.project')" />
        <el-option :value="MindShareType.User" :label="$t('mindShare.user')" />
      </el-select>
      <!-- PC 端：占位符保持布局 -->
      <div class="hidden web:block w-8 h-8"></div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <MindShare :mindShareType="mindShareType" @update:mindShareType="mindShareType = $event" />
    </div>
  </div>
</template>

<style scoped>
:deep(.c-select .el-input__wrapper) {
  box-shadow: none !important;
  background-color: transparent;
  padding: 0 12px;
}
:deep(.c-select .el-input__inner) {
  font-weight: 600;
  color: #000000 !important;
  text-align: right;
  -webkit-text-fill-color: #000000;
}
:deep(.c-select .el-select__caret) {
    color: #000;
}
</style>
