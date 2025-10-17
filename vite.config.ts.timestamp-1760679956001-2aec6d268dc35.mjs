// vite.config.ts
import { fileURLToPath, URL } from "node:url";
import { resolve, dirname } from "node:path";
import { defineConfig } from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/vite/dist/node/index.js";
import AutoImport from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/unplugin-auto-import/dist/vite.js";
import Components from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/unplugin-vue-components/dist/vite.js";
import { ElementPlusResolver, VantResolver } from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/unplugin-vue-components/dist/resolvers.js";
import Icons from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/unplugin-icons/dist/vite.js";
import IconsResolver from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/unplugin-icons/dist/resolver.js";
import VueI18nPlugin from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/@intlify/unplugin-vue-i18n/lib/vite.mjs";
import { viteCommonjs } from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/@originjs/vite-plugin-commonjs/lib/index.js";
import { nodePolyfills } from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { VitePWA } from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/vite-plugin-pwa/dist/index.js";
import veauryVitePlugins from "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/node_modules/veaury/vite/esm/index.mjs";
var __vite_injected_original_import_meta_url = "file:///Volumes/Extreme%20Pro/wangxi/work/tiptag/tiptag-ui/vite.config.ts";
var vite_config_default = defineConfig(() => {
  return {
    plugins: [
      // vue(),
      // vueJsx(),
      // vueDevTools(),
      // react(),
      veauryVitePlugins({
        type: "vue"
      }),
      AutoImport({
        resolvers: [
          ElementPlusResolver(),
          VantResolver(),
          IconsResolver({
            prefix: "Icon"
          })
        ]
      }),
      Components({
        resolvers: [
          ElementPlusResolver(),
          VantResolver(),
          IconsResolver({
            enabledCollections: ["ep"]
          })
        ]
      }),
      Icons({
        autoInstall: true
      }),
      VueI18nPlugin({
        /* options */
        // locale messages resource pre-compile option
        include: resolve(dirname(fileURLToPath(__vite_injected_original_import_meta_url)), "./src/lang/locales/**")
      }),
      viteCommonjs(),
      VitePWA({
        // disable: true,
        registerType: "autoUpdate",
        strategies: "injectManifest",
        devOptions: {
          enabled: false
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          globPatterns: ["**/*.{react_vue_utils,css,html}"]
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
        },
        includeAssets: ["favicon.ico"],
        manifest: {
          id: "TagAI",
          name: "TagAI",
          short_name: "TagAI",
          description: "",
          background_color: "#FE913F",
          theme_color: "#ffffff",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
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
      })
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
        "~@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
      },
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".vue", ".mjs"]
    },
    build: {
      target: "es2022",
      commonjsOptions: {
        transformMixedEsModules: true
      },
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        },
        format: {
          comments: true
        },
        mangle: true
      }
    },
    esbuild: {
      target: "es2022"
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
      esbuildOptions: {
        target: "es2022"
      }
    },
    server: {
      host: "0.0.0.0"
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVm9sdW1lcy9FeHRyZW1lIFByby93YW5neGkvd29yay90aXB0YWcvdGlwdGFnLXVpXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVm9sdW1lcy9FeHRyZW1lIFByby93YW5neGkvd29yay90aXB0YWcvdGlwdGFnLXVpL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Wb2x1bWVzL0V4dHJlbWUlMjBQcm8vd2FuZ3hpL3dvcmsvdGlwdGFnL3RpcHRhZy11aS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IHsgcmVzb2x2ZSwgZGlybmFtZSB9IGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSdcbmltcG9ydCB2dWVKc3ggZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlLWpzeCdcbmltcG9ydCB2dWVEZXZUb29scyBmcm9tICd2aXRlLXBsdWdpbi12dWUtZGV2dG9vbHMnXG5pbXBvcnQgQXV0b0ltcG9ydCBmcm9tICd1bnBsdWdpbi1hdXRvLWltcG9ydC92aXRlJ1xuaW1wb3J0IENvbXBvbmVudHMgZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZSdcbmltcG9ydCB7IEVsZW1lbnRQbHVzUmVzb2x2ZXIsIFZhbnRSZXNvbHZlciB9IGZyb20gJ3VucGx1Z2luLXZ1ZS1jb21wb25lbnRzL3Jlc29sdmVycydcbmltcG9ydCBJY29ucyBmcm9tICd1bnBsdWdpbi1pY29ucy92aXRlJ1xuaW1wb3J0IEljb25zUmVzb2x2ZXIgZnJvbSAndW5wbHVnaW4taWNvbnMvcmVzb2x2ZXInXG5pbXBvcnQgVnVlSTE4blBsdWdpbiBmcm9tICdAaW50bGlmeS91bnBsdWdpbi12dWUtaTE4bi92aXRlJ1xuaW1wb3J0IHsgdml0ZUNvbW1vbmpzIH0gZnJvbSAnQG9yaWdpbmpzL3ZpdGUtcGx1Z2luLWNvbW1vbmpzJ1xuaW1wb3J0IHsgbm9kZVBvbHlmaWxscyB9IGZyb20gJ3ZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzJ1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCB2ZWF1cnlWaXRlUGx1Z2lucyBmcm9tIFwidmVhdXJ5L3ZpdGUvZXNtXCJcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyggKCk6IGFueSA9PiB7XG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgLy8gdnVlKCksXG4gICAgICAvLyB2dWVKc3goKSxcbiAgICAgIC8vIHZ1ZURldlRvb2xzKCksXG4gICAgICAvLyByZWFjdCgpLFxuICAgICAgdmVhdXJ5Vml0ZVBsdWdpbnMoe1xuICAgICAgICB0eXBlOiAndnVlJ1xuICAgICAgfSksXG4gICAgICBBdXRvSW1wb3J0KHtcbiAgICAgICAgcmVzb2x2ZXJzOiBbXG4gICAgICAgICAgRWxlbWVudFBsdXNSZXNvbHZlcigpLFxuICAgICAgICAgIFZhbnRSZXNvbHZlcigpLFxuICAgICAgICAgIEljb25zUmVzb2x2ZXIoe1xuICAgICAgICAgICAgcHJlZml4OiAnSWNvbicsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIENvbXBvbmVudHMoe1xuICAgICAgICByZXNvbHZlcnM6IFtcbiAgICAgICAgICBFbGVtZW50UGx1c1Jlc29sdmVyKCksXG4gICAgICAgICAgVmFudFJlc29sdmVyKCksXG4gICAgICAgICAgSWNvbnNSZXNvbHZlcih7XG4gICAgICAgICAgICBlbmFibGVkQ29sbGVjdGlvbnM6IFsnZXAnXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAgSWNvbnMoe1xuICAgICAgICBhdXRvSW5zdGFsbDogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICAgVnVlSTE4blBsdWdpbih7XG4gICAgICAgIC8qIG9wdGlvbnMgKi9cbiAgICAgICAgLy8gbG9jYWxlIG1lc3NhZ2VzIHJlc291cmNlIHByZS1jb21waWxlIG9wdGlvblxuICAgICAgICBpbmNsdWRlOiByZXNvbHZlKGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKSwgJy4vc3JjL2xhbmcvbG9jYWxlcy8qKicpLFxuICAgICAgfSksXG4gICAgICB2aXRlQ29tbW9uanMoKSxcbiAgICAgIFZpdGVQV0Eoe1xuICAgICAgICAvLyBkaXNhYmxlOiB0cnVlLFxuICAgICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgICAgc3RyYXRlZ2llczogJ2luamVjdE1hbmlmZXN0JyxcbiAgICAgICAgZGV2T3B0aW9uczoge1xuICAgICAgICAgIGVuYWJsZWQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogMTUgKiAxMDI0ICogMTAyNCxcbiAgICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57cmVhY3RfdnVlX3V0aWxzLGNzcyxodG1sfSddXG4gICAgICAgIH0sXG4gICAgICAgIGluamVjdE1hbmlmZXN0OiB7XG4gICAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDE1ICogMTAyNCAqIDEwMjRcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbyddLFxuICAgICAgICBtYW5pZmVzdDoge1xuICAgICAgICAgIGlkOiAnVGFnQUknLFxuICAgICAgICAgIG5hbWU6ICdUYWdBSScsXG4gICAgICAgICAgc2hvcnRfbmFtZTogJ1RhZ0FJJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJycsXG4gICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNGRTkxM0YnLFxuICAgICAgICAgIHRoZW1lX2NvbG9yOiAnI2ZmZmZmZicsXG4gICAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLFxuICAgICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICAgICAgcHVycG9zZTogJ2FueSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIG5vZGVQb2x5ZmlsbHMoe1xuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgQnVmZmVyOiB0cnVlLFxuICAgICAgICAgIGdsb2JhbDogdHJ1ZSxcbiAgICAgICAgICBwcm9jZXNzOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIF0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksXG4gICAgICAgICd+QCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKVxuICAgICAgfSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLmpzJywgJy5qc3gnLCAnLnRzJywgJy50c3gnLCAnLmpzb24nLCAnLnZ1ZScsICcubWpzJ11cbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICB0YXJnZXQ6IFwiZXMyMDIyXCIsXG4gICAgICBjb21tb25qc09wdGlvbnM6IHtcbiAgICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXG4gICAgICB9LFxuICAgICAgbWluaWZ5OiAndGVyc2VyJyxcbiAgICAgIHRlcnNlck9wdGlvbnM6IHtcbiAgICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsXG4gICAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZm9ybWF0OiB7XG4gICAgICAgICAgY29tbWVudHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIG1hbmdsZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBlc2J1aWxkOiB7XG4gICAgICB0YXJnZXQ6IFwiZXMyMDIyXCJcbiAgICB9LFxuICAgIG9wdGltaXplRGVwczp7XG4gICAgICBpbmNsdWRlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgdGFyZ2V0OiBcImVzMjAyMlwiLFxuICAgICAgfVxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiAn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
