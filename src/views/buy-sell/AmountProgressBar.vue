<script setup lang="ts">
import {inject, type Ref, ref} from "vue";

const barConfig = [
  {label: '25%', value: 25},
  {label: '50%', value: 50},
  {label: '75%', value: 75},
  {label: '100%', value: 100},
]
const percentage = inject<Ref<number>>('percentage')!

const onBar = (value: number) => {
  if(value===percentage.value && value===25) percentage.value = 0
  else percentage.value = value
}

</script>

<template>
  <div class="grid grid-cols-4 gap-1">
    <div v-for="i of barConfig" class="col-span-1 cursor-pointer" @click="onBar(i.value)">
      <div class="h-3 w-full"
           :class="i.value<=percentage?'bg-gradient-primary':'bg-grey-light-active'"></div>
      <div class="text-sm text-center mt-0.5"
           :class="i.value===percentage?'text-grey-normal':'text-grey-light-active'">{{i.label}}</div>
    </div>
  </div>
</template>

<style scoped>

</style>
