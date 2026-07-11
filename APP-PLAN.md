# TagAI App 方案：PWA 内核 + Capacitor 原生壳

> 状态：待评审 ｜ 2026-07
>
> 背景：crypto 进入消费应用时代，TagAI 需要一款可从 App Store / Google Play 分发、带系统推送的 App。本方案基于现有 PWA（Vue 3 + Vite + vite-plugin-pwa）给出落地路径。

## 1. 目标

- 一套代码三端交付（Web / iOS / Android），Web 端现状零影响；
- 补齐消费级 App 的关键能力：**系统推送、深链直达、商店分发、生物识别**；
- 保持现有周级迭代节奏（非原生改动不经商店审核）；
- 5~7 周内双端可下载。

## 2. 路线对比与选择

| 路线 | 成本 | 评估 |
|---|---|---|
| A. 纯 PWA 增强（安装提示、TWA 上 Google Play） | 极低 | iOS 无法进 App Store、无系统推送权重、留存差——只能当过渡 |
| **B. Capacitor 壳 + 现有 Web 代码（推荐）** | 低~中 | 现有 tagai-ui 代码直接进商店；补原生插件；2~4 周出首版 |
| C. React Native / Flutter 重写 | 高 | 全量重写 UI + 钱包逻辑，数月起步，现阶段 ROI 低 |

**选 B**。消费应用拼迭代速度；等 App DAU 验证后，再评估对核心页（信息流/交易）做原生化（见 P3）。

## 3. 总体架构

```
tagai-ui（现有 Vue3 SPA，不分叉）
   ├─ Web / PWA        → tagai.fun（现状不变）
   ├─ iOS App          → Capacitor WebView 壳 + 原生插件
   └─ Android App      → 同上
原生能力层（Capacitor 插件）：
   推送(FCM/APNs)、深链(App/Universal Links)、系统浏览器 OAuth、
   生物识别、系统分享、触感、Keychain/Keystore 安全存储
OTA 热更新（Capgo 或自建）：
   JS/CSS 包不经商店审核直接更新；原生壳变更才走审核
tiptag-api：
   推送通道扩展 —— 现有 VAPID Web Push（src/utils/push-notification.js）
   之外新增 FCM/APNs token 注册与下发
```

## 4. 关键技术改造点（对应现有代码）

### 4.1 登录（最大改造点）
Privy 的 Twitter OAuth 在 WebView 内会被 Google/Twitter 拦截（禁 embedded webview 登录）。改为：
- iOS `ASWebAuthenticationSession` / Android Custom Tabs 打开系统浏览器完成 OAuth；
- deep link（`tagai://auth-callback`）回跳 App 携带凭证；
- Privy 官方支持移动流；改动集中在 `src/react_app/` 的 Privy Provider 层加平台分支，Web 端逻辑不动。

### 4.2 钱包
- **主路径（消费级用户）**：Privy embedded wallet 在壳内可用，无感签名，保持现状；
- **外部钱包**：补 WalletConnect deep link（`viem` 已兼容），连接 OKX/Binance Web3/MetaMask 移动端。

### 4.3 推送（留存核心）
- 后端已有 Web Push（VAPID）；新增 FCM（Android）/ APNs（iOS）通道 + token 注册接口；
- 推送场景直接复用现有事件：被 tip、预测开奖、社区新预测事件、价格异动、被回复/提及；
- 通知偏好设置沿用现有 notification 页扩展。

### 4.4 深链 / 分享闭环（增长主环）
- X 上分享出去的 `tagai.fun/post-detail/...`、`/predict/event/...`、`/tag-detail/...` 配置
  Universal Links（iOS）/ App Links（Android），点开直达 App 内对应页；
- 已装 App 的用户从 X 回流即进 App；未装用户落 Web/PWA，并展示装机引导。

### 4.5 移动 UX
底子已好（mobile-first、Vant、`web:804px` 断点、已修点击缩放）。壳内需补：
- 安全区适配（刘海/底部 Home 条，`env(safe-area-inset-*)`）；
- Android 返回手势/键与路由栈对齐；
- 原生启动屏 + App 图标；
- 关键操作触感反馈（买入/投票/开奖）。

### 4.6 OTA 热更新
- 集成 Capgo（或自建）：现有 push → PR → merge → 构建 后，产物分钟级推到端上；
- 商店审核仅在原生壳变更（新插件/权限）时触发。

## 5. 上架合规（必须正视）

- **iOS 对 crypto 交易 / 预测市场审核敏感**（Guideline 3.1.5(b)；预测玩法可能被判定为博彩类）。对策：
  1. **Android（Google Play）先行**：风险低，且 TagAI 用户盘（BSC/亚洲）与 Android 重合度高；
  2. iOS 首版做**功能开关**：隐藏「买卖 / 预测下注」入口（保留社交、行情、投票、领取奖励），过审后灰度放开——Coinbase/OKX 均为此打法；
  3. 预测市场对外文案统一 **predict / vote**，避免 bet / gambling 词汇。
- 硬性前置：公司主体 Apple 开发者账号、Google Play 开发者账号、隐私政策页、**账号删除入口**（两店均强制）。

## 6. 阶段计划

| 阶段 | 内容 | 周期 |
|---|---|---|
| **P0 壳跑通** | Capacitor 接入（iOS/Android 工程）、启动屏/图标、安全区、OAuth 系统浏览器 + deep link、embedded 钱包壳内验证 | 1~2 周 |
| **P1 可上架** | FCM/APNs 推送（端 + 后端）、Universal/App Links、账号删除、隐私政策、Google Play 内测轨上架 | +2 周 |
| **P2 体验 + iOS** | OTA 热更新、生物识别解锁、原生分享、触感；iOS TestFlight → 送审（功能分级版） | +2~3 周 |
| P3（视数据） | 核心页原生化评估、桌面 Widget（行情/持仓）、App 专属功能（如通知驱动的秒级开奖体验） | 后续 |

**合计 ≈ 5~7 周双端可下载。** 人力：前端 1~2 人 + 后端 0.5 人（推送通道）。

## 7. 成功指标

- 装机 → 注册转化率；
- 推送开启率、推送点击回流率；
- D1/D7 留存（对比 PWA 基线）；
- X 深链进 App 占比（分享闭环效率）；
- App 端交易 / 投票渗透率（对比 Web）。

## 8. 风险清单

| 风险 | 等级 | 缓解 |
|---|---|---|
| iOS 审核拒绝（crypto/预测） | 高 | Android 先行；iOS 功能分级；文案合规 |
| OAuth 回跳在部分机型失败 | 中 | Privy 移动流官方方案 + 兜底 Web 登录 |
| WebView 性能（低端 Android） | 中 | 首屏体积治理；关键列表虚拟滚动；P3 原生化 |
| OTA 与商店政策冲突 | 低 | 仅更新 JS/资源，不改变 App 宣称功能（政策允许范围） |
