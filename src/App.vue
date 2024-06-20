<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute} from "vue-router";
const route = useRoute()
</script>

<template>
  <div id="app" :class="route.name==='home'?'bg-img-home':'bg-img-common'">
    <Layout></Layout>
  </div>
</template>

<style scoped>
</style>
