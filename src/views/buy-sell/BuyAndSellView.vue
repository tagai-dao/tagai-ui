<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {ref} from "vue";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
const tradeType = ref('buy')

const {
  contentRef,
  showClear,
  contentEl,
  contentInput,
  getBlur,
  onPaste,
} = useCreateTweet()

const isPostTweet = ref(false)

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">$LATC</div>
      </template>
    </BackHeader>
    <div class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2"
         id="trade-record-scroller">
      <div class="bg-white py-5 px-4 rounded-2xl flex flex-col gap-3">
        <div class="flex rounded-full overflow-hidden h-9 text-white bg-grey-normal text-h5">
          <button class="h-full flex-1"
                  :class="tradeType==='buy'?'bg-gradient-primary':''"
                  @click="tradeType='buy'">Buy</button>
          <button class="h-full flex-1"
                  :class="tradeType==='sell'?'bg-gradient-primary':''"
                  @click="tradeType='sell'">Sell</button>
        </div>
        <div class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black
                  flex items-center">
          <span class="text-h5">购买</span>
          <input type="number" class="bg-transparent h-full flex-1 text-h3">
          <span class="text-h5">$ BTC</span>
        </div>
        <div class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black
                  flex items-center justify-between">
          <span class="text-h5">获得 TRUMP</span>
          <span class="text-h3">1928000</span>
        </div>
        <div class="border-[1px] border-grey-c9 rounded-xl">
          <div class="flex items-center gap-2 px-3 pt-3">
            <img class="h-6 w-6 min-w-6 rounded-full"
                 src="~@/assets/icons/icon-default-avatar.svg" alt="">
            <span class="text-h3">ELUMSK</span>
          </div>
          <div class="max-h-[160px] overflow-hidden relative flex flex-col p-3">
            <div contenteditable
                 class="outline-none flex-1 overflow-auto no-scroll-bar min-h-[56px] whitespace-pre-line
                      text-lg z-10 relative"
                 ref="contentRef"
                 @input="contentInput"
                 @blur="getBlur"
                 @paste="onPaste"
                 v-html="contentEl"></div>
            <div v-if="!showClear" class="absolute top-3 left-3 text-14px leading-24px z-0 opacity-30">
              写点 Trump 的内容，将被铭刻至链上，并根据社区互动获得奖励
            </div>
          </div>
        </div>
        <div class="flex justify-center">
          <el-radio-group v-model="isPostTweet" class="c-radio gap-8">
            <el-radio :value="false">None</el-radio>
            <el-radio :value="true">tweet & Earn</el-radio>
          </el-radio-group>
        </div>
        <button class="w-full h-12 rounded-full bg-gradient-primary text-white text-h5
                     flex items-center justify-center gap-2">
          <span>Confirm</span>
          <i-ep-loading class="animate-spin"/>
        </button>
      </div>
      <RecordList/>
    </div>
  </div>
</template>

<style scoped>

</style>
