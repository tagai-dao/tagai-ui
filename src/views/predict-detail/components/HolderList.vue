<script setup lang="ts">
import { ref } from 'vue'
import { mockHolders } from '../mockData'

// Simple mock loading
const loading = ref(false)
</script>

<template>
  <div class="bg-white rounded-2xl flex flex-col shadow-sm">
      <div class="p-4 border-b border-gray-100 font-bold text-gray-800">Top Holders</div>
      
      <div class="custom-scrollbar p-4">
          <div class="flex gap-4 min-h-full">
              <!-- Left (Red) Holders -->
              <div class="flex-1 flex flex-col gap-3">
                  <div class="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-2">Red Holders</div>
                  <div v-for="(holder, idx) in mockHolders.red" :key="idx" 
                       class="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100">
                      <div class="relative">
                          <img :src="holder.avatar" class="w-8 h-8 rounded-full bg-gray-200">
                          <div class="absolute -top-1 -right-1 w-4 h-4 bg-red-100 text-red-600 text-[10px] flex items-center justify-center rounded-full font-bold border border-white">
                              {{ idx + 1 }}
                          </div>
                      </div>
                      <div class="flex-1 min-w-0">
                          <div class="font-bold text-sm text-gray-900 truncate">{{ holder.name }}</div>
                          <div class="text-xs text-gray-500 font-mono">{{ holder.amount.toLocaleString() }}</div>
                      </div>
                      <div class="text-xs font-bold text-red-500">{{ holder.percentage }}%</div>
                  </div>
              </div>

              <!-- Vertical Divider -->
              <div class="w-px bg-gray-100"></div>

              <!-- Right (Blue) Holders -->
              <div class="flex-1 flex flex-col gap-3">
                  <div class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-blue-100 pb-2">Blue Holders</div>
                   <div v-for="(holder, idx) in mockHolders.blue" :key="idx" 
                       class="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                      <div class="relative">
                          <img :src="holder.avatar" class="w-8 h-8 rounded-full bg-gray-200">
                          <div class="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center rounded-full font-bold border border-white">
                              {{ idx + 1 }}
                          </div>
                      </div>
                      <div class="flex-1 min-w-0">
                          <div class="font-bold text-sm text-gray-900 truncate">{{ holder.name }}</div>
                          <div class="text-xs text-gray-500 font-mono">{{ holder.amount.toLocaleString() }}</div>
                      </div>
                      <div class="text-xs font-bold text-blue-500">{{ holder.percentage }}%</div>
                  </div>
              </div>
          </div>
      </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #eee;
  border-radius: 2px;
}
</style>

