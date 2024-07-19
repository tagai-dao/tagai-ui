<script setup lang="ts">
const emit = defineEmits(['onClose'])
</script>

<template>
  <div>
    <div class="py-3 flex gap-2">
      <button class="h-12 w-12 min-w-12 bg-white rounded-full shadow-popper-tip
                     flex items-center justify-center"
              @click="$emit('onClose')">
        <img src="../../assets/icons/icon-back.svg" alt="">
      </button>
      <div class="flex-1 h-12 min-h-12 rounded-full bg-white shadow-popper-tip overflow-hidden px-4
                  flex items-center">
        <input type="text" class="w-full h-full" placeholder="Search">
        <img src="~@/assets/icons/icon-search-outline.svg" alt="">
      </div>
    </div>
    <div class="mt-3">
      <div class="px-3 font-medium text-lg text-black mb-1">User</div>
      <div class="bg-white p-4 rounded-2xl shadow-popper-tip flex items-center gap-1.5 mb-2"
           v-for="i of 2" :key="i">
        <img class="h-10 w-10 min-h-10 rounded-full"
             src="~@/assets/icons/icon-default-avatar.svg" alt="">
        <div class="flex-1">
          <div>@username</div>
          <div class="text-grey-light-active">ipShare: 895</div>
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
  </div>
</template>

<style scoped>

</style>
