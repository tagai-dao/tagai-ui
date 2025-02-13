<script setup lang="ts">
import { ref } from "vue";

const tabOptions = ['NULS', 'Base', 'BSC']
const activeTab = ref('NULS')

function gotoChain(chain: string){
  if (chain === 'Base') {
    window.open('https://tiptag.social', '__blank')
  }
}

</script>

<template>
  <div class="min-w-[120px] h-full pt-24 px-4 pb-4 bg-white">
    <div class="flex flex-col">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-8 text-h3"
              :class="tab===activeTab?'bg-orange-normal text-white':'text-grey-3f'"
              @click="gotoChain(tab)">{{tab}}</button>
    </div>
  </div>
</template>

<style scoped>

</style>
