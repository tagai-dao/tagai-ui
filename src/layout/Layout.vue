<script setup lang="ts">
import {RouterView} from "vue-router";
import TopBar from "@/layout/TopBar.vue";
import TabBar from "@/layout/TabBar.vue";
</script>

<template>
  <main class="w-full h-full flex flex-col max-w-[1200px] mx-auto">
    <TopBar/>
    <div class="flex-1 overflow-hidden">
      <RouterView/>
    </div>
    <TabBar/>
  </main>
</template>

<style scoped>

</style>
