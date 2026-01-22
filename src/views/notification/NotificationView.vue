<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import TabSocial from "@/views/notification/TabSocial.vue";

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">{{$t('notificationView.notification')}}</div>
      </template>
    </BackHeader>
    <div class="flex-1 overflow-auto px-3">
      <TabSocial />
    </div>
  </div>
</template>

<style scoped>

</style>
