// Read-only component preview. All wallet, RPC and API imports are replaced with local fixtures.
// npx vite --config scripts/comment-buy-preview/vite.config.mjs
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
const path = relative => fileURLToPath(new URL(relative, import.meta.url))
const mocked = ['stores/web3', 'stores/chain', 'stores/common', 'types', 'apis/axios', 'config', 'utils/wallets', 'utils/contract']
export default {
  root: path('../../'),
  plugins: [vue()],
  resolve: { alias: [
    ...mocked.map(name => ({ find: `@/${name}`, replacement: path('./fixtures.ts') })),
    { find: '@', replacement: path('../../src') },
  ] },
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
}
