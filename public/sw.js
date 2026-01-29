
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
  event.waitUntil(
    clearCache()
  )
})

self.addEventListener('activated', (event) => {
  console.log('activated')
  event.waitUntil(
    clearCache()
  )
})

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received', event);

  let notificationData = {
    title: 'TagAI Mini App',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    data: {},
  };

  // Parse notification data
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (e) {
      console.error('[Service Worker] Failed to parse push data:', e);
      notificationData.body = event.data.text();
    }
  }

  const title = notificationData.title || 'TagAI Mini App';
  const options = {
    body: notificationData.body || '',
    icon: notificationData.icon || '/pwa-192x192.png',
    badge: notificationData.badge || '/favicon.ico',
    tag: notificationData.tag || 'tagai-notification',
    data: notificationData.data || {},
    requireInteraction: notificationData.requireInteraction || false,
    actions: notificationData.actions || [],
    vibrate: notificationData.vibrate || [200, 100, 200],
    timestamp: Date.now(),
  };

  // Add image if provided
  if (notificationData.image) {
    options.image = notificationData.image;
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked', event);

  // Close the notification
  event.notification.close();

  // Determine the URL to open
  let urlToOpen = event.notification.data.url || '/';

  // Handle action clicks
  if (event.action) {
    const action = event.notification.actions.find(a => a.action === event.action);
    if (action && action.url) {
      urlToOpen = action.url;
    }
  }

  // Focus or open window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // Check if there's any window open
        if (clientList.length > 0) {
          // Navigate the first client to the URL
          const client = clientList[0];
          if ('navigate' in client) {
            return client.navigate(urlToOpen).then(client => client ? client.focus() : null);
          }
          return client.focus();
        }

        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close event handler
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed', event);
});
