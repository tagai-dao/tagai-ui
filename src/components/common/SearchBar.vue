<script setup lang="ts">
import {ref, watch} from "vue";
import debounce from "lodash.debounce";

const searchText = ref('')
const showSearchList = ref(false);
const onSearch = (e: any) => {
  if(searchText.value.trim().length > 0 && e.keyCode === 13) {
    showSearchList.value = true
  }
}

const onInput = debounce((e: any) => {
  if(!e.target.value.trim()) showSearchList.value = false
}, 500)

const clearSearchList = () => {
  searchText.value = ''
  showSearchList.value = false
}

</script>

<template>
  <div class="relative flex-1 flex justify-end" ref="searchRef">
    <div class="search-bar relative w-full bg-white flex items-center rounded-full px-4 gap-3 ">
      <img src="~@/assets/icons/icon-search-grey.svg" alt="">
      <input type="text" :placeholder="$t('search')"
             v-model="searchText"
             @keypress="onSearch"
             @input="onInput"
             class="flex-1 bg-transparent relative rounded-full text-base" >
      <button v-if="searchText.trim().length>0"
              @click="clearSearchList"
              class="absolute right-4 bg-grey-light rounded-full">
        <img class="w-6 h-6" src="~@/assets/icons/icon-modal-close.svg" alt="">
      </button>
    </div>
    <el-collapse-transition>
      <div v-show="showSearchList"
           class="absolute top-14 bg-white left-0 right-0 rounded-2xl px-4 py-6 z-[999]">
        <div class="px-3 font-medium text-lg text-black mb-1">User</div>
        <div class="grid grid-cols-4 gap-3">
          <div v-for="i of 2" :key="i"
               class="col-span-1 bg-white p-3 rounded-2xl shadow-popper-tip flex items-center gap-1.5 mb-2">
            <img class="h-10 w-10 min-h-10 rounded-full"
                 src="~@/assets/icons/icon-default-avatar.svg" alt="">
            <div class="flex-1">
              <div>@username</div>
              <div class="text-grey-light-active text-sm">ipShare: 895</div>
            </div>
          </div>
        </div>
        <div class="px-3 font-medium text-lg text-black mt-4 mb-1">Tag</div>
        <div class="flex flex-wrap gap-2">
          <button class="h-6 px-3 rounded-md bg-green-normal text-sm"
                  v-for="i of 4" :key="i">
            onChain
          </button>
        </div>
      </div>
    </el-collapse-transition>
  </div>
</template>

<style scoped>

</style>
