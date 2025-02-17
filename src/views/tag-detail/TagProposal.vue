<script setup lang="ts">
import { ref } from 'vue';
const tabOptions = ['Character', 'Actions']
const activeTab = ref('Character')

const gotoChain = (tab: string) => {
  activeTab.value = tab
}
</script>

<template>
  <div class="flex justify-start items-center gap-2 bg-white px-2 rounded-full">
    <button v-for="tab of tabOptions" :key="tab"
            class="px-3 rounded-full h-8 text-h3"
            :class="tab===activeTab?'bg-orange-normal text-white':'text-grey-3f'"
            @click="gotoChain(tab)">{{tab}}</button>
  </div>
  <div class="min-h-[300px] flex flex-col justify-center items-center bg-white py-3 px-4 rounded-2xl">
    <div class="text-h1 text-grey-light-active">
      Coming Soon ...
    </div>
  </div>
</template>

<style scoped>

</style>
