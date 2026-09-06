// Run: npx vite --config scripts/profile-scroll-vite.config.mjs
// Open: http://127.0.0.1:5186/scripts/profile-scroll-fixture.html
// Uses real scroll/Vant logic with fixture rows, never account APIs or wallets.
import { fileURLToPath } from 'node:url'
const path = relative => fileURLToPath(new URL(relative, import.meta.url))
export default {
  root: path('../'),
  resolve: { alias: { '@': path('../src'), vue: path('../node_modules/vue/dist/vue.esm-bundler.js') } },
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
}
