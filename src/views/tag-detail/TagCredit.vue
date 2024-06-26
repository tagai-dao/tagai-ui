<script setup lang="ts">

</script>

<template>
<div class="bg-white rounded-2xl p-3">
  <div class="grid grid-cols-5 gap-x-2 text-h5 h-10 items-center">
    <span class="col-span-3 pl-8">Account</span>
    <span class="col-span-1">$LATC</span>
    <span class="col-span-1 text-right">$Credit</span>
  </div>
  <div class="grid grid-cols-5 gap-x-2 h-8 items-center text-h4"
       v-for="i of 4" :key="i">
    <div class="col-span-3 truncate flex items-center gap-1">
      <span class="min-w-4">{{i+1}}</span>
      <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt="">
      <span class="truncate">username</span>
    </div>
    <span class="col-span-1">6830M</span>
    <span class="col-span-1 text-right">28988</span>
  </div>
</div>
</template>

<style scoped>

</style>
