import { rmSync } from 'node:fs'

// Distribution APKs belong on the website, never inside another APK/IPA.
// Only generated Capacitor web asset directories are affected.
for (const path of ['android/app/src/main/assets/public/downloads', 'ios/App/App/public/downloads']) {
  rmSync(new URL(`../${path}`, import.meta.url), { recursive: true, force: true })
}
