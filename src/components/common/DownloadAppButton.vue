<script setup lang="ts">
import { ref } from 'vue'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { ElMessage } from 'element-plus'
import { parseAndroidDownload } from '@/utils/androidUpdatePolicy'

defineProps<{ sidebar?: boolean }>()
const busy = ref(false)

async function download() {
  if (busy.value) return
  // An APK cannot be installed on iOS. Do not silently download an unusable file.
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    ElMessage.info('The Android APK cannot be installed on iPhone/iPad. Use Safari → Share → Add to Home Screen.')
    return
  }
  busy.value = true
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const native = Capacitor.isNativePlatform()
    const path = `/app-updates/android.json?t=${Date.now()}`
    let data: unknown
    if (native) {
      const response = await CapacitorHttp.get({ url: `https://tagai.fun${path}`,
        connectTimeout: 10000, readTimeout: 10000, headers: { 'Cache-Control': 'no-cache' } })
      if (response.status !== 200) throw new Error('Manifest unavailable')
      data = response.data
    } else {
      const response = await fetch(path, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error('Manifest unavailable')
      data = await response.json()
    }
    const release = parseAndroidDownload(data)
    if (!release) throw new Error('No published release')
    if (native) {
      await Browser.open({ url: release.downloadUrl })
    } else {
      // Same-origin paths also work on preview deployments and local testing.
      const url = new URL(release.downloadUrl)
      const response = await fetch(url.pathname, { method: 'HEAD', cache: 'no-store', signal: controller.signal })
      if (!response.ok || !/application\/(?:vnd.android.package-archive|octet-stream)/i.test(response.headers.get('content-type') || '')) {
        throw new Error('APK unavailable')
      }
      const link = document.createElement('a')
      link.href = url.pathname
      link.download = url.pathname.split('/').pop() || 'TagAI.apk'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
  } catch {
    ElMessage.error('App download is temporarily unavailable. Please try again shortly.')
  } finally {
    clearTimeout(timeout)
    busy.value = false
  }
}
</script>

<template>
  <button type="button" :disabled="busy" :aria-busy="busy" aria-label="Download App"
    title="Download App (Android APK)" @click="download"
    class="flex items-center text-content disabled:opacity-50"
    :class="sidebar ? 'justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg hover:bg-surface-2 mb-2 w-full' : 'gap-2 cursor-pointer text-left'">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" class="shrink-0" :class="[sidebar ? 'w-6 h-6 desk:mr-3' : 'w-4 h-4', busy ? 'animate-pulse' : '']">
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </svg>
    <span :class="sidebar ? 'hidden desk:inline text-h4' : ''">{{ busy ? 'Downloading…' : 'Download App' }}</span>
  </button>
</template>
