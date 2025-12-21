<script setup lang="ts">
import PredictDetailLeft from './PredictDetailLeft.vue'
import PredictDetailRight from './PredictDetailRight.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="h-screen overflow-y-auto bg-gray-50 pb-20 sm:pb-0">
    <!-- Back Button / Header for Mobile -->
    <div class="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 sm:hidden flex items-center gap-2">
       <button @click="router.back()" class="text-gray-600 font-bold">← Back</button>
       <span class="font-bold text-gray-900 truncate flex-1">Prediction Market</span>
    </div>

    <div class="container mx-auto px-4 sm:px-6 py-6 max-w-7xl">
       <!-- Desktop Back Button -->
       <div class="hidden sm:flex items-center mb-4">
          <button @click="router.back()" class="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold transition-colors">
             <span>←</span>
             <span>Back</span>
          </button>
       </div>

       <div class="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          
          <!-- Left Column: Info & Lists -->
          <div class="w-full lg:w-[65%] xl:w-[70%]">
             <PredictDetailLeft />
          </div>

          <!-- Right Column: Trade Panel (Desktop Only) -->
          <div class="hidden lg:block w-full lg:w-[35%] xl:w-[30%] lg:sticky lg:top-6">
             <PredictDetailRight />
          </div>

       </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: Add custom container queries or specific overrides if tailwind isn't enough */
</style>

