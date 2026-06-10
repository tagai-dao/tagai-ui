# TagAI（tagai.fun）UI/UX 优化方案 v2

> **📋 执行状态（2026-06-11 凌晨更新）：方案已基本执行完毕，详见文末「九、执行状态总表」与《验收报告-2026-06-11.md》。**

> 本版整合三方信息：① 线上站点实地走查（桌面 1280px / 移动 375px，中英双语）；② `tagai-ui` 前端源码核对；③ `tiptag-api` 后端能力盘点。
> **本版新增**：API 能力对照（哪些数据后端已有、哪些需要新增）+ 布局与控件尺寸级的 UI 细节规范。
> 取代 `UI-UX-优化方案.md`（v1）。优先级：P0 = 转化与信任；P1 = 多语言与增长；P2 = 打磨。

---

## 一、问题诊断摘要（v1 已逐项核对源码，此处只列结论）

| # | 问题 | 严重度 | 根因位置 |
|---|------|--------|----------|
| 1 | Home/Coin/Prediction 切换不改 URL，无法分享/刷新丢状态 | 🔴 | `LeftSidebar.vue:56-83` 用 Pinia 状态代替路由 |
| 2 | 顶栏无登录入口；Privy 与钱包直连双轨并存无解释；钱包仅 2 种 | 🔴 | `TopBar.vue`、`ChoseWallet.vue` |
| 3 | 币卡片缺 24h%、持有人、进度、sparkline 等决策信息 | 🔴 | `TagListItem.vue` + **API 未聚合**（见下文二） |
| 4 | ticker 显示 `STNK$$6,153`（双美元符） | 🟡 | `HomeView.vue:282` 模板与 `helper.ts:89` formatPrice 双写 `$` |
| 5 | 仅中英二元切换；`<html lang>` 恒为 en；63 个文件硬编码中文；时间英文硬拼接 | 🔴 | `lang/index.ts`、`TopBar.vue:103-113`、`helper.ts:305-325` |
| 6 | K 线用 DexScreener iframe，风格割裂（原生 Kline.vue 已存在却只用于内盘） | 🟡 | `BuyAndSellView.vue:455`、`RecordList.vue:71` |
| 7 | OG/SEO 全站静态单一，分享回 X 无预览卡 | 🔴 | `index.html:13-17` |
| 8 | 导航非语义化、图标无 label、禁止缩放 | 🟡 | `LeftSidebar.vue`、`index.html:6` |
| 9 | 测试币/垃圾币与正经币混排 | 🟡 | 列表接口无过滤参数（见二） |
| 10 | 布局与控件尺寸问题（本版新增，详见三） | 🟡 | 散落各组件 |

---

## 二、API 能力盘点（tiptag-api）—— 前端要的数据，后端有多少

> 后端：Express + MySQL（读写分离）+ Redis 缓存，Swagger 文档在 `GET /api-docs`。
> 结论：**前端方案所需数据 80% 已存在，缺的只是"在列表接口上聚合"**，不需要新建数据管道。

### 2.1 已有、前端直接可用
| 数据 | 来源 | 说明 |
|------|------|------|
| marketCap（实时） | `server/communityTrending.js` 周期缓存，list 接口已附带 | 现已在用 |
| OHLC 历史 | `bsc_trade_data` 表；`GET /community/getTokenTradeData`（`routes/community.js:1091`） | **24h% 与 sparkline 的原料已齐** |
| 持有人列表 | `GET /community/holderList`（`routes/community.js:656`，Redis 缓存 + 账户信息合并）、`/holderListOfImported`（NodeReal） | 详情页可直接用 |
| 成交记录 | `GET /community/tradeList`、`bsc_trade_list` 表 | 详情页 Trades tab 在用 |
| listed 状态/天数、official、isImport、createdByAi、createAt | community list SQL 已返回（`src/db/api/community.js:93-108`） | 徽章/排序/过滤的字段现成 |
| 搜索 | `GET /community/search`、`/searchTickOnly` | 需扩展支持 CA 地址（见 2.2） |
| 预测市场 | `routes/predict.js` FPMM 全套 | 无缺口 |

### 2.2 需要后端新增（全部是小改造，随 P0/P1 排期）
| 新增项 | 实现建议 | 服务的前端功能 |
|--------|----------|----------------|
| ① list 接口附加 `priceChange24h` | 在 `communityTrending.js` 既有缓存周期内，从 `bsc_trade_data` 取 24h 前 close 对比当前价，随 marketCap 一起写入 Redis（同一个 `attachCommunityMarketCap` 调用链） | 币卡片涨跌%、ticker 涨跌色 |
| ② list 接口附加 `holderCount` | `getTokenHolders` 数据源加 COUNT 聚合，缓存 5 分钟 | 币卡片持有人数 |
| ③ list 接口附加 `sparkline`（可选） | 24 个小时级 close 数组，与 ① 同一次查询产出 | 卡片迷你走势图 |
| ④ bonding curve 进度 | 链上可读（Pump 合约），但建议后端在缓存周期统一算好下发，省前端 multicall | 卡片/详情进度条 |
| ⑤ `GET /community/search?q=0x...` 支持 CA | `searchTick` 加一个 `token =` 分支（`getCommunityByCA` 已存在，`src/db/api/community.js:278`） | 搜索框粘贴合约地址 |
| ⑥ 轻量 OG meta 接口 `GET /meta/og?type=tag\|post&id=` | 复用 `/community/detail` 与 post 查询，返回 title/desc/image；供 Cloudflare Worker crawler 注入 | 动态分享卡 |
| ⑦ list 接口 `minMarketCap` / `verifiedOnly` query | SQL WHERE 追加，默认值由前端控制 | 垃圾币折叠 |

> 注：①③④ 在同一个后台缓存进程改，一次 PR 可交付；接口字段向后兼容（新增字段，不动老字段）。

---

## 三、布局与控件尺寸规范（本版核心新增）

> 以下尺寸均核对过源码现状，给出「现状 → 目标」。设计语言保持现有橙色系不变。

### 3.1 桌面三栏布局（≥1080px）
**现状**：左栏 `w-[260px]` 固定；中列 `flex-1` **无最大宽度**（超宽屏上 feed 卡片被拉到 800px+，行长超过可读上限）；右栏组件自适应；整体不居中。顶部搜索框 `max-w-2xl`（672px）过宽。

**目标**：
```
┌────────┬──────────────────┬──────────┐
│ 侧栏    │ 内容列            │ 右栏      │
│ 240px  │ 600px (max)      │ 340px    │
└────────┴──────────────────┴──────────┘
整体 max-width: 1240px，居中；列间距 24px
```
- 侧栏：260px → **240px**（导航项文字最长为韩文场景预留，px-4 不变）；
- 内容列：`flex-1` → `max-w-[600px]`（Twitter/X 同款行长，CJK 每行约 28-32 字，最佳可读区间）；
- 右栏：固定 **340px**（与交易面板 `web:w-[340px]` 对齐，全站统一一个右栏宽度）；
- 搜索框：672px → **360px**（聚焦时可扩展到 480px），右侧腾出空间放「登录/头像」按钮（P0 3.2 需要的位置就从这里来）。

### 3.2 响应式断点
**现状**：只有一个 `web: 804px` 断点，804–1080px 区间三栏硬塞，右栏被压扁。

**目标**：三档
- `<804px`：移动单列 + 底部 TabBar（现状保留）；
- `804–1080px`：**两栏**（侧栏收窄为 72px 纯图标 + tooltip；隐藏右栏，Top TagCoin/Live Spaces 合并进 feed 顶部横滑模块）；
- `≥1080px`：三栏（3.1 规范）。
- 落点：`tailwind.config.js` screens 增加 `lg: 1080px`；`Layout.vue`、`LeftSidebar.vue`、`HomeView.vue` 右栏条件渲染。

### 3.3 字号体系（可读性硬伤）
**现状**（`tailwind.config.js:82-96`）：`xs = 10px/14px`，且 ticker、徽章、Credit 数字等**金额类信息在用 10px**（`HomeView.vue:281-282` `text-[10px]`）。

**目标**：
- **任何与钱相关的数字最小 12px**；10px 仅允许用于纯装饰性标签，逐步废弃 `text-xs` 的数据用法；
- 字号档位收敛为：12（辅助）/ 14（正文）/ 16（强调）/ 20（区块标题）/ 24+（页面标题）；
- CJK 行高：正文 `line-height ≥ 1.6`（现 h4 = 14px/16px，行高 1.14，中日韩文字会贴边，改 14px/22px）；
- h2 的 `letterSpacing: -0.05em` 对 CJK 不适用（汉字挤压明显），按 locale 取消负字距。

### 3.4 触控与控件尺寸（对照 44px 最小触达标准）
| 控件 | 现状 | 目标 |
|------|------|------|
| 滑点输入框 | `w-[100px] h-6`（24px 高，移动端）`web:h-9` | 移动端 **h-10（40px）**，桌面 h-9（36px）；宽 100px → 88px + 独立 `%` 后缀 |
| 快捷金额 chips（0.02/0.05/0.1/0.2 BNB） | 4 个小灰块，视觉弱、命中区小 | 高 **36px**、圆角 8px、选中态橙底白字；**追加一个 `MAX`**（加密用户标配）；卖出方向 chips 换为 25%/50%/75%/100% |
| Pay/Receive 输入框 | `h-full flex-1 w-[120px]` 不定高 | 统一 **48px 高**、右对齐数字、`font-variant-numeric: tabular-nums`（金额列防跳动） |
| Connect/Buy 主按钮 | 高度不一 | 全站主按钮统一 **44px**（移动）/ 40px（桌面），圆角全圆；危险/卖出操作不共用橙色 |
| 帖子操作栏 5 图标 | 图标 ~16px、间距均分、无命中区扩展 | 每个按钮 **44×44px 命中区**（icon 20px + padding）、hover 着色 + tooltip |
| Trending/New 主 Tab | `w-1/4 web:w-1/3 max-w-[200px] h-8/h-9` 宽度随屏抖动 | 固定内容自适应宽（px-5），高 36px，避免百分比宽导致不同页签长短跳动 |
| 移动 ticker 卡 | `144×42px`，名称+金额两行 10px | **160×48px**，币名 12px + 涨跌% 12px（金额让位给涨跌，点进去才看市值） |
| 底部 TabBar | 仅"我的"有文字 | 5 项全部 icon 22px + 11px 标签（四语），高 56px + safe-area |
| 弹窗 | 统一 `max-w-[500px]`，PredictTrade 900px | 保持；但移动端弹窗改 **底部抽屉**（Vant Popup position="bottom"），拇指可达 |

### 3.5 卡片信息布局（币卡片改版，配合 API 2.2 新字段）
**现状**（`TagListItem.vue`）：logo + 名称 + `Mkt Cap $79,066` + 多行描述 + 标签，**一张卡 ~180px 高里 60% 是描述文字**，可决策信息只有市值一项。

**目标**（高度压到 ~120px，信息密度对齐 pump.fun）：
```
┌──────────────────────────────────────┐
│ [logo] $BUIDL  ·Listed徽章   +12.4% ↗ │  ← 名称 16px粗体；涨跌 14px 红/绿
│ MC $79.0K · 31 holders · 2d ago      │  ← 12px 灰，一行三项
│ ▂▃▅▆▇ sparkline      [██████░░] 87%  │  ← 已毕业显示 sparkline，内盘显示进度条
│ 描述截断一行…          #TagAI #AI     │
└──────────────────────────────────────┘
```
- 网格：`web:grid-cols-3` 保持，卡间距 `gap-2`(8px) → **gap-3(12px)**；
- 描述从 3-4 行截为 **1 行**（hover 浮层显全文），把高度还给数据行。

### 3.6 帖子卡片（feed 流）
- 金额徽章 `9,432.94($0.7451)` 右上角橙色长条挤压作者行 → 改两段式短徽章：`9.4K 🪙` + hover/tap 展开 `≈ $0.75`；徽章 12px、tabular-nums。
- 帖子正文行宽随 3.1 收到 600px 内；截断从字符数改为 **8 行 line-clamp + 展开**。
- `**markdown**` 裸奔：入库前剥离或前端渲染（DOMPurify 已有），二选一。
- 操作栏触达区见 3.4；转发/引用两个相邻图标语义不清，给 tooltip。

### 3.7 交易面板（`BuyAndSellView.vue`）
- 面板宽随右栏统一 340px；Buy/Sell 主 Tab 下补三行信息（字号 12px，右对齐）：
  `价格影响 0.42% / 最低到手 1,234 BUIDL（按滑点）/ 平台费 1%`；
- 未连接钱包时主按钮文案 = 「连接钱包以交易」，点击直接弹统一登录抽屉（不是 disabled）；
- Balance 行加钱包图标 + 点击填充 MAX；
- 滑点设置从常驻输入框改为 **预设 chips（0.5% / 1% / 3%）+ 自定义**，默认 1%，>5% 时黄字警告（防呆）。

### 3.8 预测卡（Prediction 页）
- `Buy Yes (0.75)` / `Buy No (0.25)` 双按钮 50/50 全宽保持，但概率改为主视觉：按钮内 **概率大字 16px + "Yes/No" 12px**，外加一条 Yes/No 占比双色进度条（Polymarket 习惯）；
- 已结束市场的 `Winner: No` 徽章从橙色（与 CTA 同色）改为灰底 + ✓，避免误读为可点击；
- 卡片标题（问题）限 2 行，规则全文折叠进「详情」。

---

## 四、P0：转化与信任（第 1~2 周）

### 4.1 路由重构
新增 `/coins`、`/predictions` 路由指向 `HomeView`（meta 驱动 `stateStore.activeMainMenu`），子 Tab 用 `?tab=`；登录守卫补 `?redirect=` 回跳；导航改 `<router-link>`。
落点：`src/router/index.ts`、`LeftSidebar.vue:56-83`、`TabBar.vue`、`HomeView.vue`。

### 4.2 登录入口（按产品负责人决定调整：保留原有流程，不加顶栏登录按钮）
- 保留原有登录流程：点击 Profile → Twitter 授权（Privy）。
- 未登录时侧边栏/底栏的「Profile / 我的」显示为「登录 / Log in」，作为唯一显性登录入口（已实现）。
- 钱包扩展（OKX + WalletConnect v2，`ChoseWallet.vue` + `src/utils/wallets.ts`）保留在后续批次，仅用于交易/创建场景的钱包选择，不与账号登录混合。

### 4.3 币卡片与详情页信息升级
- 依赖 API 2.2 ①②③④⑦：卡片按 3.5 改版；列表工具栏加排序（新创建/市值/24h 涨幅/即将毕业）与「隐藏未验证」开关（默认开）。
- 详情页头部信息条：价格 + 24h%、市值、流动性、持有人、CA（一键复制 + BscScan / DexScreener / GMGN 外链）。
- 图表：原生 `Kline.vue` 扩展为毕业币默认图表，iframe 降级保留。
- 交易面板按 3.7。

### 4.4 格式化统一与 `$$` 修复
- 修 `HomeView.vue:282`；重构 `formatPrice/formatBalance` 为 `Intl.NumberFormat` 三件套（货币符号与数值分离，供 i18n）；ticker 改 `$STNK +3.2%`。

### 4.5 搜索增强
- 搜索框支持粘贴 CA 直达币页（依赖 API 2.2 ⑤）；搜索结果分组（Token / 用户 / 帖子）。

**P0 验收**：任一页面可刷新可分享；落地到完成连接 ≤2 次点击；币卡片可读 24h%/holders/进度；ticker 无 `$$`；滑点框/操作栏触达 ≥40px。

---

## 五、P1：四语 i18n + 增长闭环（第 2~4 周）

### 5.1 i18n 架构
- `lang/locales/` 增加 `ko.json`、`ja.json`，`lang/index.ts` 注册；`TopBar.vue:103-113` 二元 toggle 改四语下拉（当前语言打勾）；
- 首访按 `navigator.language` 自动选择，沿用 localStorage `language` key；切换同步 `document.documentElement.lang`；
- 文案审计：现 locale 仅 105 key、63 个文件硬编码中文 —— 全量入 key，禁拼接，复数用 ICU；补 zh.json 缺失的 `amount`。

### 5.2 格式化层
- `Intl.RelativeTimeFormat` 替换 `helper.ts:305-325`（修 "1 days ago"）；数字缩写按 locale（en `1.2M` / zh·ja「120万」/ ko「120만」）；日期、百分号全走 `Intl`。

### 5.3 CJK 排版
- 字体栈按 locale：`Inter + Noto Sans SC/KR/JP`；行高与负字距修正见 3.3；按钮/Tab 宽度弹性，韩日长词不截断；侧边栏导航词四语逐项 UI review。

### 5.4 涨跌颜色 locale 化
- zh/ko/ja 默认**红涨绿跌**，en 默认绿涨红跌，设置页可手动切换（Binance 同款）；色值收敛为 `--color-up/--color-down` CSS 变量（`tailwind.config.js` 色板接入）。

### 5.5 SEO / 动态分享卡
- Cloudflare Worker 对 crawler 注入动态 OG（依赖 API 2.2 ⑥）：帖子 = 摘要 + 作者；币 = 名称 + 市值 + 24h%；
- 四语 `title/description` + `hreflang`；移除 `index.html` 写死的单一 OG。

**P1 验收**：四语切换零残留（截图 diff）；`html lang` 正确；时间/数字/涨跌色随 locale；分享链接到 X 有预览卡。

---

## 六、P2：打磨（第 4~6 周）

- **可访问性**：导航语义化（与 4.1 合并）；图标 `aria-label` + tooltip 四语；移除 `index.html:6` 的 `user-scalable=0`；对比度过 WCAG AA（色值集中在 tailwind 色板，统一调）。
- **移动端**：TabBar 文字标签；顶栏 `+` 与 FAB 去重（保留 FAB，滚动收起）；弹窗改底部抽屉（3.4）。
- **空态**：Live Spaces →「去 X 发起一个 Space，带上 #TagAI」+按钮；评论 →「成为第一个评论的人」；策展/Credit/IPShare 概念加 `?` 气泡链接 About 锚点；新用户 feed 顶部「三步开始」可关闭卡片。
- **视觉一致性**：spacing 收敛 8/12/16/24 四档；卡片圆角统一 12px、弹窗 20px；`--brand/--up/--down/--tag` 色板 token 化；Top X Creators 头像与文字基线对齐。

---

## 七、执行排期（前后端联动）

| 周 | 前端（tagai-ui） | 后端（tiptag-api） |
|----|------------------|---------------------|
| 1 | 4.1 路由 + 4.4 格式化/`$$` + 3.1/3.2 布局栅格 | 2.2 ①③④（trending 缓存加 24h%/sparkline/进度，一个 PR） |
| 2 | 4.2 登录抽屉（WalletConnect/OKX）+ 3.7 交易面板 | 2.2 ②⑤⑦（holderCount、CA 搜索、过滤参数） |
| 2-3 | 4.3 卡片改版（3.5/3.6）+ 4.5 搜索 + 5.1 文案 key 化启动 | 2.2 ⑥ OG meta 接口 |
| 3-4 | 5.2-5.5：ko/ja 翻译、CJK 排版、Worker OG | 配合联调 |
| 5-6 | P2 全部 + 四语 × 双端回归走查（截图 diff） | — |

**风险与依赖**：① 韩日翻译需母语 review（外部依赖，第 2 周就要启动）；② WalletConnect v2 需注册 projectId；③ Worker OG 需要 Cloudflare 路由权限；④ 后端三个 PR 都是缓存层小改，但 `communityTrending.js` 是单点（改坏影响全站市值显示），需补集成测试（`yarn test:integration`）。

## 八、不做什么
- 不改产品机制（Proof-of-Brain、策展、打赏、FPMM 模型）；
- 不上 SSR；不做暗色模式（色板 token 化为其铺路）；
- 不重做视觉风格（橙色系/卡片语言保留，只做规范化）；
- API 不做破坏性变更（全部新增字段/参数，向后兼容）。

---

## 附录 A：v1 问题 → 代码落地点对照表（沿用，已核对）

| # | 问题 | 文件 / 位置 |
|---|------|-------------|
| 1 | 主 Tab 不改 URL | `src/layout/LeftSidebar.vue:56-83`、`src/router/index.ts`、`src/stores/common.ts` |
| 2 | 登录不回跳 | `src/router/index.ts` beforeEach `gotoHome` 分支 |
| 3 | ticker `$$` | `src/views/HomeView.vue:282` + `src/utils/helper.ts:89` |
| 4 | 英文硬拼时间 | `src/utils/helper.ts:305-325` |
| 5 | 语言 toggle | `src/layout/TopBar.vue:103-113`、`src/lang/index.ts` |
| 6 | 钱包仅 2 项 | `src/components/login/ChoseWallet.vue`、`src/utils/wallets.ts` |
| 7 | 登录双轨 | `src/components/login/LoginModal.vue`、`src/react_app/`、`src/layout/Layout.vue` |
| 8 | iframe 图表 | `src/views/buy-sell/BuyAndSellView.vue:455`、`RecordList.vue:71`；原生 `Kline.vue` 已有 |
| 9 | 禁缩放/静态 OG | `index.html:6`、`index.html:13-17` |
| 10 | 币卡片 | `src/components/home/TagListItem.vue`、`HomeView.vue` 网格 |
| 11 | 字号/断点 | `tailwind.config.js:82-100`（fontSize、screens） |
| 12 | 三栏布局 | `src/layout/Layout.vue:140-165`（搜索 max-w-2xl、中列 flex-1）、`LeftSidebar.vue:120`（w-[260px]） |
| 13 | 交易面板尺寸 | `src/views/buy-sell/BuyAndSellView.vue:459`（w-[340px]）、`:538`（滑点 h-6）、`:48`（快捷金额） |

## 附录 B：API 改造点（tiptag-api）

| 改造 | 文件 | 性质 |
|------|------|------|
| 24h%/sparkline/进度聚合 | `server/communityTrending.js`（attachCommunityMarketCap 链路）、`src/db/api/community.js`（bsc_trade_data 查询复用 `getNewTradeData`） | 缓存层新增字段 |
| holderCount | `routes/community.js:656` 同源数据 + COUNT 缓存 | 新字段 |
| CA 搜索 | `src/db/api/community.js:278` `getCommunityByCA` 接入 `routes/community.js:249` search | 查询分支 |
| 垃圾币过滤参数 | `routes/community.js` 三个 list 接口 + SQL WHERE | 可选 query |
| OG meta 接口 | 新增 `routes/meta.js`，复用 `/community/detail` 与 post 查询 | 新端点 |
| 文档 | 每个新端点/字段补 `@openapi` 注释（规范见 `config/swagger.js`） | 文档 |

---

## 九、执行状态总表（2026-06-11）

| 方案条目 | 状态 | 说明 |
|----------|------|------|
| 4.1 路由重构（/coins /predictions、?tab=、登录回跳） | ✅ | |
| 4.2 登录入口 | ✅ | 按产品决定保留原 Profile→Twitter 流程，未登录显示「登录」 |
| 4.3 币卡片/详情升级（24h%、进度条、创建时间、CA 外链、sparkline） | ✅ | 24h% 与 sparkline 需部署 tiptag-api 分支后生效 |
| 4.4 格式化统一 + $$ 修复 | ✅ | |
| 4.5 搜索 CA 直达 | ✅ | 复用现有接口，无需后端改动 |
| 3.1 三栏布局（600/340/1240） | ✅ | |
| 3.2 中间档断点（804-1080 图标侧栏） | ✅ | desk:1080 屏档 |
| 3.3 字号/CJK 行高/负字距 | ✅ | 金额最小 12px；CJK 行高 1.6 |
| 3.4 控件尺寸（滑点/快捷金额/MAX/TabBar 标签/触达区） | ✅ | 移动端弹窗改底部抽屉**未做**（modal 系统共用，风险大，列入下期） |
| 3.5 币卡片信息行 | ✅ | holders 数受限于 The Graph 无 count 聚合，**未做** |
| 3.6 帖子徽章/行宽/markdown | ✅ | 正文保留 3 行截断（feed 密度考量，未按方案改 8 行） |
| 3.7 交易面板（min received、滑点 chips、MAX） | ✅ | 价格影响/手续费行**未做**：各合约版本费率不同，待逐版本确认，宁缺毋错 |
| 3.8 预测卡（概率主视觉、双色条、Winner 徽章） | ✅ | |
| 5.1 四语 i18n 架构（ko/ja、下拉、自动检测、html lang） | ✅ | **韩日翻译需母语 review 后再上线** |
| 5.2 Intl 时间/数字格式化 | ✅ | |
| 5.3 CJK 字体栈 | ✅ | 系统字体栈，无 web font 开销 |
| 5.4 涨跌色 locale 化（zh/ko/ja 红涨） | ✅ | |
| 5.5 SEO（四语 title/desc、OG Worker） | ✅ 代码 / ⚠️ 部署 | Worker 在 workers/og-injector/，**需 zone 权限执行 wrangler deploy** |
| P2 可访问性（语义导航、aria-label、缩放、对比度） | ✅ 大部分 | 全站对比度逐项过 AA 未完成（已修主要问题），列入下期 |
| P2 空态/新手引导 | ✅ | |
| API ① 24h%（priceChange24h） | ✅ 代码 | tiptag-api feat/price-change-24h 分支，**待部署** |
| API ③ sparkline | ✅ 代码 | 同上 |
| API ⑥ OG meta（GET /meta/og） | ✅ 代码 | 同上 |
| API ⑦ 列表过滤参数 | ✅ 代码 | 同上 |
| API ② holderCount | ❌ | The Graph 不支持 count 聚合，需改 subgraph schema 或接索引服务 |
| API ④ 后端下发曲线进度 | ➖ 不再需要 | 前端已用链上 multicall 字段（getTokenInfo）直接计算 |
| 文案全量 key 化（63 文件硬编码清扫） | ⚠️ 部分 | 用户可见高频路径已覆盖；长尾组件内剩余硬编码列入下期滚动清理 |
| 暗色模式 / 移动底部抽屉 / 全站对比度审计 | 📋 下期 | 色板已 token 化，为暗色模式铺路 |
