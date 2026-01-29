/**
 * TagAI Mini App - Service Worker
 * 用于处理推送通知和离线缓存
 *
 * 注意：Service Worker 不支持 ES6 import，必须使用传统 JavaScript
 */

const CACHE_VERSION = 1;
const CACHE_NAME = 'tagai-cache-v' + CACHE_VERSION;

console.log('[Service Worker] Loading...');

// 清理旧缓存
function clearCache() {
  return caches.keys().then(function(keys) {
    return Promise.all(
      keys.filter(function(key) {
        return key !== CACHE_NAME;
      }).map(function(key) {
        console.log('[Service Worker] Deleting old cache:', key);
        return caches.delete(key);
      })
    );
  });
}

// 安装 Service Worker
self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    clearCache().then(function() {
      console.log('[Service Worker] Installed successfully');
      // 跳过等待，立即激活
      return self.skipWaiting();
    })
  );
});

// 激活 Service Worker
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    clearCache().then(function() {
      console.log('[Service Worker] Activated successfully');
      // 立即控制所有客户端
      return self.clients.claim();
    })
  );
});

// 处理推送通知
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push received:', event);

  var notificationData = {
    title: 'TagAI',
    body: '您有一条新消息',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: {}
  };

  // 解析推送数据
  if (event.data) {
    try {
      var payload = event.data.json();
      console.log('[Service Worker] Push payload:', payload);

      notificationData = {
        title: payload.title || (payload.notification && payload.notification.title) || 'TagAI',
        body: payload.body || (payload.notification && payload.notification.body) || '您有一条新消息',
        icon: payload.icon || (payload.notification && payload.notification.icon) || '/pwa-192x192.png',
        badge: payload.badge || (payload.notification && payload.notification.badge) || '/pwa-192x192.png',
        tag: payload.tag || 'tagai-notification',
        data: payload.data || (payload.notification && payload.notification.data) || {},
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || [],
        vibrate: payload.vibrate || [200, 100, 200],
        timestamp: Date.now()
      };

      // 添加图片（如果有）
      if (payload.image) {
        notificationData.image = payload.image;
      }
    } catch (error) {
      console.error('[Service Worker] Failed to parse push data:', error);
      notificationData.body = event.data.text();
    }
  }

  var title = notificationData.title;
  var options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: notificationData.requireInteraction,
    actions: notificationData.actions,
    vibrate: notificationData.vibrate,
    timestamp: notificationData.timestamp
  };

  if (notificationData.image) {
    options.image = notificationData.image;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 处理通知点击事件
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  var urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  // 处理操作按钮点击
  if (event.action) {
    var action = event.notification.actions.find(function(a) {
      return a.action === event.action;
    });
    if (action && action.url) {
      urlToOpen = action.url;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // 检查是否已有打开的窗口
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          var clientUrl = new URL(client.url);
          var targetUrl = new URL(urlToOpen, self.location.origin);

          if (clientUrl.href === targetUrl.href && 'focus' in client) {
            return client.focus();
          }
        }

        // 检查是否有任何窗口打开
        if (clientList.length > 0) {
          var client = clientList[0];
          if ('navigate' in client) {
            return client.navigate(urlToOpen).then(function(client) {
              return client ? client.focus() : null;
            });
          }
          return client.focus();
        }

        // 如果没有打开的窗口，打开一个新窗口
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// 处理通知关闭事件
self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] Notification closed:', event);
});

// Fetch 事件处理（可选，用于离线缓存）
self.addEventListener('fetch', function(event) {
  // 只缓存 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }

  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    // 无效的 URL，忽略
    return;
  }

  // 跳过某些请求
  // 1. chrome-extension 或其他浏览器扩展请求
  if (url.protocol === 'chrome-extension:' ||
      url.protocol === 'moz-extension:' ||
      url.protocol === 'safari-extension:') {
    return;
  }

  // 2. API 调用
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. 外部域名（只缓存同源请求）
  if (url.origin !== self.location.origin) {
    return;
  }

  // 网络优先策略
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // 如果响应有效，克隆并缓存
        if (response && response.status === 200) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache).catch(function(err) {
              // 忽略缓存错误
              console.warn('[Service Worker] Cache put failed:', err);
            });
          });
        }
        return response;
      })
      .catch(function() {
        // 网络失败时，尝试从缓存获取
        return caches.match(event.request);
      })
  );
});

console.log('[Service Worker] Loaded successfully');
