# P0 任务书：TagAI App 壳跑通（Capacitor）

> 执行者：Codex ｜ 分支：`feat/tagai-app` ｜ 上游方案：`APP-PLAN.md`（先通读）
> 完成后开 PR 到 `main`，**不要合并**——将由 Claude (Opus 4.8) 做 code review，再由开发人员合并。

## 目标

在不影响 Web 构建的前提下，把现有 tagai-ui（Vue 3 + Vite SPA）装进 Capacitor 壳，
双端（iOS/Android）能启动、登录、浏览、签名，即 APP-PLAN §6 的 P0。

## 范围（按顺序做）

### 1. Capacitor 接入
- 安装 `@capacitor/core` `@capacitor/cli` `@capacitor/ios` `@capacitor/android`；
- `capacitor.config.ts`：appId `fun.tagai.app`，appName `TagAI`，webDir `dist`；
- `npx cap add ios` / `npx cap add android`，原生工程提交进仓库；
- npm scripts：`app:sync`（build-only + cap sync）、`app:ios`、`app:android`；
- **约束**：`npm run build` / Web 部署产物必须与现状完全一致（可用条件逻辑
  `Capacitor.isNativePlatform()` 区分端，禁止分叉代码库）。

### 2. 启动屏 / 图标 / 安全区
- `@capacitor/splash-screen` + 品牌图标（素材用 `public/` 现有 logo，占位可后换）；
- 全局安全区：`viewport-fit=cover` + `env(safe-area-inset-*)` 适配 `src/layout/`
  的 TopBar / TabBar（刘海与底部 Home 条不遮挡）；
- Android 返回键：接 `@capacitor/app` 的 `backButton`，映射到 vue-router `back()`，
  栈底时最小化 App 而不是退出。

### 3. 登录（P0 核心难点）
- Privy Twitter OAuth 不能在 WebView 内完成（Google/Twitter 禁 embedded webview）：
  - 原生端用 `@capacitor/browser`（iOS SFSafariViewController / Android Custom Tabs）
    打开 OAuth 页；
  - 注册自定义 scheme `tagai://auth-callback` 深链回跳（`@capacitor/app` 的
    `appUrlOpen` 事件），把凭证交回 Privy SDK 完成会话；
  - 改动集中在 `src/react_app/` Privy Provider 层，用平台分支实现，Web 流程零改动；
  - Privy Dashboard 需加移动 redirect URI——在 PR 描述里写清需要配置的值，
    不要提交任何密钥。
- 验收：真机/模拟器上完成 Twitter 登录 → 回到 App → 账号态正常（等价 Web 登录后状态）。

### 4. 钱包冒烟
- 登录后 Privy embedded wallet 在壳内可用：完成一次只读调用 + 一次签名冒烟
  （signMessage 即可，不必真实交易）；
- WalletConnect 外部钱包属 P1，本期不做。

### 5. CI / 文档
- 现有 lint/type-check 通过；`npm run build` 产物不含 Capacitor 运行时膨胀
  （原生插件代码在 Web 端 tree-shake 或动态 import）；
- 新增 `APP-DEV.md`：本地跑 iOS/Android 的环境要求与命令（Xcode / Android Studio、
  cap sync 流程、深链本地测试方法）。

## 明确不做（P1/P2，勿顺手做）

推送（FCM/APNs）、Universal/App Links、OTA 热更新、生物识别、账号删除入口、
商店上架资料、iOS 功能开关。

## 验收清单（PR 描述里逐项打勾）

- [ ] `npm run build` 与 main 分支产物行为一致（Web 零影响）
- [ ] iOS 模拟器 + Android 模拟器可启动进首页，滚动/切 tab 正常
- [ ] 安全区无遮挡；Android 返回键行为正确
- [ ] Twitter 登录经系统浏览器完成并深链回跳成功
- [ ] embedded wallet signMessage 冒烟通过
- [ ] `APP-DEV.md` 齐全；无密钥/证书入库

## 仓库约定

遵循 `CLAUDE.md`（Composition API、`<script setup lang="ts">`、路径别名 `@`）。
提交信息用 conventional commits（`feat(app): ...`）。原生工程内自动生成文件
（Pods、build 产物）按 Capacitor 官方 .gitignore 排除。
