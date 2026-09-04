
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  // 新版本 SW 安装后立即接管，否则老用户需关闭全部标签页才能拿到新版
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Workbox owns the precache lifecycle. The previous blanket deletion also
  // removed the freshly generated Workbox cache during installation.
  event.waitUntil(self.clients.claim())
})
