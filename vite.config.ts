import { fileURLToPath, URL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver, VantResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
// @ts-ignore
import veauryVitePlugins from "veaury/vite/esm"

// https://vitejs.dev/config/
export default defineConfig( (): any => {
  return {
    plugins: [
      // vue(),
      // vueJsx(),
      // vueDevTools(),
      // react(),
      veauryVitePlugins({
        type: 'vue'
      }),
      AutoImport({
        resolvers: [
          ElementPlusResolver(),
          VantResolver(),
          IconsResolver({
            prefix: 'Icon',
          }),
        ],
      }),
      Components({
        resolvers: [
          ElementPlusResolver(),
          VantResolver(),
          IconsResolver({
            enabledCollections: ['ep'],
          }),
        ],
      }),
      Icons({
        autoInstall: true,
      }),
      VueI18nPlugin({
        /* options */
        // locale messages resource pre-compile option
        include: resolve(dirname(fileURLToPath(import.meta.url)), './src/lang/locales/**'),
      }),
      viteCommonjs(),
      VitePWA({
        // disable: true,
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        devOptions: {
          enabled: false
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          globPatterns: ['**/*.{react_vue_utils,css,html}']
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
        },
        includeAssets: ['favicon.ico'],
        manifest: {
          id: 'TagAI',
          name: 'TagAI',
          short_name: 'TagAI',
          description: '',
          background_color: '#FE913F',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      }),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true
        }
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '~@': fileURLToPath(new URL('./src', import.meta.url)),
        // Mock React Native dependencies for web
        '@react-native-async-storage/async-storage': fileURLToPath(new URL('./src/mocks/async-storage.ts', import.meta.url))
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.vue', '.mjs']
    },
    build: {
      target: "es2022",
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          comments: true,
        },
        mangle: true,
      },
    },
    esbuild: {
      target: "es2022"
    },
    optimizeDeps:{
      include: ['react', 'react-dom'],
      esbuildOptions: {
        target: "es2022",
      }
    },
    server: {
      port: 5173,
      strictPort: false
    }
  }
})
