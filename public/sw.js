import { setCacheNameDetails } from 'workbox-core'
import { addPlugins, precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { validatedPrecachePlugin, navigationDenylist } from '../src/service-worker/precachePolicy.js'

// Start a fresh precache once: older caches may contain HTML under JS URLs.
// Preserve the default scope suffix so Workbox can clean up only old precaches
// belonging to this service worker after the validated install succeeds.
setCacheNameDetails({ prefix: 'tagai-validated-v1' })
addPlugins([validatedPrecachePlugin])
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// /, /bsc, /rh and deep links must boot the same release as its cached chunks.
// Previously only / used the precached index; deep links fetched a newer shell
// from the network while an older worker still controlled their asset requests.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: navigationDenylist,
}))

// Keep an open page and its cached chunks on the same release. A new worker
// waits until the old release's tabs close; never interrupt wallet confirmations
// or forms by taking control and forcing a page reload during a deployment.

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
