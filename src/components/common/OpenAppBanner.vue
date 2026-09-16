<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { androidContentIntent } from '@/utils/nativeContentLinks'
import DownloadAppButton from './DownloadAppButton.vue'

const route = useRoute()
const androidWeb = !Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)
const intent = computed(() => androidWeb
  ? androidContentIntent(`https://tagai.fun${route.fullPath}`) : null)
</script>

<template>
  <aside v-if="intent" class="fixed bottom-20 left-3 right-3 z-[1500] rounded-xl border border-line bg-surface p-3 shadow-lg text-content" aria-label="Open in TagAI">
    <div class="flex items-center justify-between gap-3">
      <a :href="intent" class="rounded-lg bg-orange-normal px-3 py-2 text-white font-semibold">Open TagAI App</a>
      <DownloadAppButton />
    </div>
    <p class="mt-2 text-xs">Requires Android App 1.0.23 or later. You can also continue on this webpage.</p>
  </aside>
</template>
