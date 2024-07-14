<script setup lang="ts">

</script>

<template>
  <div class="flex flex-col min-h-[240px] py-6 px-4 gap-7">
    <div class="text-h2 text-black text-center">
      {{$t('loginView.bindAddress')}}
    </div>
    <div class="flex flex-col w-full items-center px-8">
      <div class="text-base text-center text-red-ff">钱包地址不匹配，请重新绑定</div>
      <div class="text-base text-center text-red-ff break-all">
        0xaf05ce8a2cef336006e933c02fc89887f5b3c726
      </div>
    </div>
    <div class="px-5">
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-4">
        <span class="text-h5 text-white">Confirm</span>
      </button>
    </div>
  </div>
</template>

<style scoped>

</style>
