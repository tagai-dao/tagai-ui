
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
const CACHE_VERSION = 0
const CACHE_NAME = 'cache_v' + CACHE_VERSION

const clearCache = () => {
  return caches.keys().then(keys => {
    keys.forEach(key => {
      if (key !== CACHE_NAME) {
        caches.delete(key)
      }
    })
  })
}

self.addEventListener('install', (event) => {
  // 新版本 SW 安装后立即接管，否则老用户需关闭全部标签页才能拿到新版
  self.skipWaiting()
  event.waitUntil(
    clearCache()
  )
})

// 注意：事件名是 'activate'（旧代码写成 'activated' 从未触发过）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([clearCache(), self.clients.claim()])
  )
})
