# TagAI（tagai.fun）UI/UX 优化方案

> 基于 2026-06-10 对线上站点（桌面 1280px / 移动 375px、中英双语）的实地走查，
> 并对照本地 `tagai-ui`（Vue 3 + vue-i18n + Element Plus + Vant + klinecharts）代码结构给出落地点。
> 优先级：**P0 = 直接影响转化与信任，先做；P1 = 多语言与增长闭环；P2 = 打磨**。

---

## 一、现状诊断（走查发现的问题清单）

### 1. 路由与深链（最严重的结构性问题）
- 侧边栏切换 Home / Coin / Prediction 时 **URL 始终停留在 `/`**；直接访问 `https://tagai.fun/coin` 渲染的却是首页 Feed。
- 后果：页面无法分享、无法收藏、刷新丢失上下文、浏览器后退行为不可预期、SEO 为零。
- 代码层面（已核对源码）：`/wallet`、`/profile`、`/notification` 等其实有路由；问题出在 **Home / Coin / Prediction 三个主 Tab 是 Pinia 状态**（`stateStore.activeMainMenu`），`LeftSidebar.vue` 的 `goToTag / goToCoin / goToPrediction`（`src/layout/LeftSidebar.vue:56-83`）一律 `router.push('/')` 再改 store。刷新后 store 重置，状态即丢。
- 另外 Wallet 未登录时路由守卫（`src/router/index.ts` `beforeEach` 的 `gotoHome` 分支）会弹登录框并退回原页面——行为合理，但 URL 不带 `?redirect=`，登录成功后无法回跳。

### 2. 登录 / 连接钱包入口缺失且双轨混乱
- 桌面顶栏**没有任何 Login / Connect Wallet 按钮**，右上角只有语言切换。用户必须误打误撞点 Wallet / Profile 才会弹出 Privy 登录框。
- 存在两套并行身份体系且无解释：
  - Privy（Log in with Twitter / Email）→ Wallet、Profile 页；
  - 钱包直连（仅 Binance Wallet、MetaMask 两个选项）→ Create TagCoin、交易。
- 对加密用户而言钱包选项太少：无 WalletConnect、OKX、Bitget、TokenPocket、Trust（BNB Chain 用户主力钱包）。

### 3. 代币信息密度不符合加密用户预期
对照 pump.fun / DexScreener / GMGN 用户习惯，当前缺失关键决策信息：
- Coin 卡片只有「名称 + Mkt Cap + 描述 + 标签」，**没有 24h 涨跌幅、价格 sparkline、持有人数、流动性、bonding curve 进度、创建时间**。
- 首页顶部滚动 ticker 显示为 `STNK$$6,153`（双美元符 bug：ticker 的 `$` 后缀直接拼接金额），且不带涨跌方向与颜色。
- 帖子上的金额徽章 `9,432.94($0.7451)` 没有任何单位/含义说明，新用户无法理解。
- 币详情页 CA 地址展示但无一键复制、无 BscScan / DexScreener / GMGN 外链。
- 列表中测试币与垃圾币（`test91 - Only for test`、`wdhak` 等 prompt-spam 币）与正经币混排，无 listed / 进度 / 流动性过滤。

### 4. 多语言（用户明确要求适配 zh / en / ko / ja）
- 目前仅 `en.json` / `zh.json` 两个 locale，语言开关是**二元 toggle**（中文 ⇄ EN），无法扩展。
- `<html lang>` 恒为 `en`，不随语言切换。
- 中文模式下大量英文残留：`Tipped`、`Space`、`Listed`、`Social Oracle（Bridge）`、About 页的 `{Community}, {coin}, {ATOC Agent}`。
- 时间格式是英文硬拼接（`1 days ago` 本身还是错误英语），中文模式下依然显示英文。
- 数字无本地化格式，无 K/M/B（或 万/亿）缩写规则。

### 5. 图表与空态
- 币详情页 K 线是内嵌 DexScreener iframe：风格与站点割裂、加载慢、空态丑（"No data here" + 灰色火柴人）；未毕业（bonding curve 阶段）的币没有原生价格曲线。注：项目已依赖 `klinecharts`，有现成能力。
- Live Spaces 空态是灰色 logo + "Empty"；评论区空态"没有更多了"——均无引导动作。

### 6. 可访问性与基础规范
- 左侧主导航不是语义化链接：ARIA 树里整页只能识别出 ~7 个可交互元素，导航项是裸 `div`/`text`。键盘不可达、读屏不可用、也不能"新标签页打开"。
- 帖子操作栏 5 个图标按钮（评论/转发/引用/分享/打赏）无文字 label、无 tooltip。
- `viewport meta` 设了 `user-scalable=0, maximum-scale=1`，禁止用户缩放。
- 浅橙背景上浅灰小字、橙渐变按钮上的白字，多处对比度低于 WCAG AA。

### 7. SEO 与社交分享（增长闭环断裂）
- 全站 `title` 恒为 "TagAI"，**无 meta description**，og:title 仅 "TagAI"。
- 帖子页 / 币页没有动态 OG 卡片——这是一个**与 X 同步**的产品，用户把 `tagai.fun/post-detail/xxx` 分享回 X 时没有预览卡，传播效率大打折扣。

### 8. 移动端
- 已有底部 Tab + FAB 的移动布局，基础不错。但：底部 5 个 Tab 仅最后一个有文字（"我的"），其余纯图标；顶栏 `+` 与右下 FAB `+` 功能重复；ticker `$$` bug 同样存在；操作图标触达区偏小（<44px）。

### 9. 内容呈现细节
- Agent 生成的帖子中 Markdown 原样输出（`**Agent Infrastructure**` 未渲染或未剥离）。
- "3人已策展（Curated）"等平台特有概念无任何解释入口。

---

## 二、设计原则（本方案的取舍依据）

1. **像 DEX 一样给数据，像 Twitter 一样给内容**：内容流保持轻，但一切与钱相关的数字必须完整、可验证（CA、曲线进度、涨跌、流动性）。
2. **信任优先**：加密用户默认怀疑一切。每个代币、每笔金额都要可追溯（链上浏览器外链、一键复制、official 标识、垃圾币隔离）。
3. **i18n 是架构而非翻译**：语言数从 2 → 4，必须先把硬编码、拼接字符串、时间/数字格式化收敛到统一层，再谈翻译。
4. **URL 即状态**：所有可见页面必须可分享、可刷新、可后退。

---

## 三、P0：转化与信任（第 1~2 周）

### 3.1 路由重构（范围比想象的小：只需把 3 个主 Tab 提升为路由）
- 新增两条路由 `/coins`、`/predictions` 指向 `HomeView`（带 `meta.mainMenu`），`/` 保持 Feed；进入时由路由 meta 反写 `stateStore.activeMainMenu`，替代现在「push('/') + 改 store」的写法（改 `src/layout/LeftSidebar.vue:56-83` 与移动端 `src/layout/TabBar.vue` 的对应跳转）。
- 子 Tab（Trending/New、TagCoin/IPShare）用 query `?tab=` 同步，`HomeView.vue` 内 watch route 恢复状态。
- 登录守卫补 `?redirect=`：`src/router/index.ts` `beforeEach` 的 `gotoHome` 分支改为记录目标路径，登录成功（mitt `login` 事件）后回跳。
- 旧链接 `/:commerceid?` 兼容保留。
- 导航项从裸 `div @click` 改为 `<router-link>`（同时解决 5.1 的语义化问题，一处改两收益）。

### 3.2 顶栏常驻身份入口
- 顶栏右侧固定一个主按钮：未登录显示 **「Connect / Sign in」**（语言随 locale），点击弹统一登录抽屉；已登录显示头像 + 余额（BNB）下拉（Profile / Wallet / 退出）。
- 统一登录抽屉分两段，一次讲清双轨体系：
  - **「用 X 账号开始」**（Privy：Twitter / Email）——适合内容创作者，自动生成托管钱包；
  - **「连接钱包」**——Binance Wallet、MetaMask、OKX、**WalletConnect v2**（一项覆盖 TP / Trust / Bitget / imToken 等长尾）。
- 记住上次使用的方式，下次置顶并标注 "Recent"。
- 各处触发登录的动作（打赏、Buy、Create、关注）全部复用该抽屉，消灭两套弹窗。
- 落点：现有体系已半成型——全局弹窗走 `useModalStore` + `GlobalModalType`（`src/layout/Layout.vue` 渲染），Privy 在 `src/react_app/`（veaury 嵌入），钱包选择是 `src/components/login/ChoseWallet.vue`（目前只有 Binance Wallet / MetaMask 两项，新增 OKX 与 WalletConnect v2 即在此文件 + `src/utils/wallets.ts` 扩展）。统一抽屉 = 合并 `LoginModal.vue` 与 `ChoseWallet.vue` 为一个双段组件；顶栏按钮加在 `src/layout/TopBar.vue`。

### 3.3 代币卡片与详情页信息升级（对齐加密用户心智）
**Coin 列表卡片**（`/coins`）每张卡补充一行核心数据：
- `24h 涨跌幅 %`（带颜色）、`bonding curve 进度条`（未毕业币）或 `Listed` 徽章（已上 PancakeSwap）、`持有人数`、`创建时间（相对时间）`、迷你 sparkline（apexcharts 已在依赖中）。
- 列表工具栏：排序（新创建 / 市值 / 24h 涨幅 / 即将毕业）、过滤（隐藏未达最低市值的测试币，默认开启「隐藏垃圾币」开关）。

**币详情页**（`/tag-detail/:id`）：
- 头部信息条：价格 + 24h%、市值、流动性、持有人、CA（**一键复制 + BscScan / DexScreener / GMGN 图标外链**）。
- 图表：**原生 K 线组件已存在**（`src/views/buy-sell/Kline.vue`，基于 klinecharts，目前用于内盘阶段）。方案是毕业后的币也优先走原生 Kline（数据源换 DexScreener API / 自有成交记录），iframe（`BuyAndSellView.vue:455`、`RecordList.vue:71`）仅作降级，统一皮肤与空态。
- 交易面板补三行：**价格影响、预计最低到手（按 slippage 计算）、手续费**；未连接钱包时 Connect 按钮文案改为「连接钱包以交易」，点击直接弹登录抽屉。
- 金额徽章 `9,432.94($0.7451)` 改为明确格式：`9,432.94 BUIDL ≈ $0.75`，hover/tap 显示说明。

### 3.4 ticker 与数字格式统一
- `$$` bug 根因已定位：`src/utils/helper.ts:89` 的 `formatPrice()` 返回值**自带 `$` 前缀**，而 `src/views/HomeView.vue:282` 模板里又写了一个 `${{ formatPrice(...) }}`。修复：去掉模板里的 `$`，并全仓 grep 同类双写。
- ticker 项改为 `$STNK +3.2%`（涨跌色见 4.4 的 locale 偏好）。
- 重构 `formatPrice`（当前手写千分位 + 魔法位数判断）为基于 `Intl.NumberFormat` 的 `formatUsd() / formatToken() / formatCompact()` 三件套，**显示货币符号与数值分离**，供 i18n 复用；`formatBalance` 一并收编。

### 3.5 垃圾内容治理（UI 层）
- 未达阈值（如市值 < $4,000 且无真实交易）的币归入「新币 / 未验证」分组，默认折叠；
- 官方/已验证代币加徽章；搜索框支持**直接粘贴 CA 地址**定位代币（GMGN 习惯）。

**P0 验收标准**：任一页面刷新后状态不变且 URL 可分享；新用户从落地到完成首次连接 ≤ 2 次点击；币卡片上能直接读到 24h%、进度、持有人；ticker 无 `$$`。

---

## 四、P1：多语言四语适配（第 2~4 周，与 P0 并行启动文案收敛）

### 4.1 架构
- `src/lang/locales/` 增加 `ko.json`、`ja.json`，在 `src/lang/index.ts` 注册；语言开关从二元 toggle（现在写死在 `src/layout/TopBar.vue:103-113`，`v-if locale==='zh'` / `v-if locale==='en'` 两个分支）改为**下拉菜单**：`English / 简体中文 / 한국어 / 日本語`，当前语言打勾。
- 首次访问按 `navigator.language` 自动选择（`ko-*`→ko，`ja-*`→ja，`zh-*`→zh，其余→en），写入 localStorage（沿用现有 `language` key）；切换时同步 `document.documentElement.lang`（目前任何地方都没设置过）。
- 清扫硬编码：现有 locale 仅 **105 个 key**，而 `src/views|components|layout` 下有 **63 个文件含硬编码中文**、大量裸英文（`Tipped / Space / Listed / Social Oracle / {Community}…`）。需要一轮全量文案审计入 key；禁止字符串拼接，复数与变量用 vue-i18n 的 ICU 消息格式。顺手补上 zh.json 缺失的 `amount` key。

### 4.2 格式化层（比翻译更重要）
- 相对时间统一用 `Intl.RelativeTimeFormat(locale)` 替换 `src/utils/helper.ts:305-325` 的英文硬拼接（`"x days ago" / "x days left"`）：修掉 "1 days ago"，中文显示「1 天前」、韩文「1일 전」、日文「1日前」。
- 数字缩写按 locale：en `1.2M` / zh 「120万」/ ko 「120만」/ ja 「120万」（或四语统一 K/M/B，但必须一处实现）。
- 日期、百分号、货币符号全部走 `Intl`，不手写。

### 4.3 CJK 排版
- 字体栈按 locale 切换：`Inter, Noto Sans SC / KR / JP, sans-serif`；CJK 正文 `line-height ≥ 1.6`，避免英文字体 fallback 导致的混排锯齿。
- 按钮/Tab 预留宽度弹性（韩文动词偏长、日文敬体偏长），禁止固定宽度截断；侧边栏导航词（예측 / 予測 等）需逐项过 UI review。

### 4.4 涨跌颜色本地化（加密交易所惯例）
- **东亚三语（zh/ko/ja）用户主流习惯是红涨绿跌，欧美绿涨红跌**。按 locale 给默认值（zh/ko/ja → 红涨；en → 绿涨），并在设置中提供手动开关（Binance 同款做法）。颜色逻辑收敛到一个 CSS 变量对：`--color-up / --color-down`。

### 4.5 SEO / 分享随语言
- 现状：OG 只有 `index.html:13-17` 的静态四行（og:title 恒为 "TagAI"），全站共用。
- 每个 locale 的 `title` / `meta description`；详情页注入动态 OG（帖子摘要 / 币名 + 市值 + 24h%），可用 Cloudflare Worker（项目已有 `@cloudflare/workers-types`，部署链路现成）做 crawler-only 的 OG 注入，避免上 SSR 大改。
- `hreflang` 四语标注。

**P1 验收标准**：四语切换后无任何英文/中文残留（以页面截图 diff 验收）；`html lang` 正确；相对时间、数字、涨跌色均随 locale；分享帖子链接到 X 有预览卡。

---

## 五、P2：体验打磨（第 4~6 周）

### 5.1 可访问性
- 侧边栏导航改 `<router-link>`（语义 `<nav><a>`，`src/layout/LeftSidebar.vue` 模板全部是 `div @click`），支持键盘 Tab / 新标签页打开（与 3.1 同一次改动）。
- 全部图标按钮加 `aria-label` + tooltip（四语）。
- 移除 `index.html:6` 的 `user-scalable=0, maximum-scale=1.0`；对照 WCAG AA 修正浅灰文字与橙底白字对比度（色值集中在 `tailwind.config.js` 自定义色板，便于统一调）。

### 5.2 移动端
- 底部 Tab 全部加文字标签（首页/币种/预测/钱包/我的，四语）。
- 去掉顶栏 `+` 与 FAB 的重复，保留 FAB 并在滚动时收起为半透明。
- 操作图标触达区扩到 ≥ 44×44px。

### 5.3 空态与新手引导
- Live Spaces 空态：改为「当前没有进行中的 Space — 去 X 发起一个，带上 #TagAI」+ 按钮。
- 评论空态：「成为第一个评论的人」+ 输入框聚焦。
- 「策展（Curate）」「Credit」「IPShare」等平台概念：首次出现处加 `?` 气泡，链接到 About 对应锚点；About 页补四语。
- 新用户首访 Feed 顶部放一条可关闭的「TagAI 是什么 / 三步开始」卡片（替代现在只能去 About 自学）。

### 5.4 内容渲染
- Agent 帖子的 Markdown：要么渲染（粗体/列表，配 DOMPurify——已在依赖中），要么入库前剥离标记，二选一，不允许 `**` 裸奔。
- 长帖折叠「展开」按钮，统一 8 行截断。

### 5.5 视觉一致性
- 主题色 token 化（橙色系已成体系，但绿色 #BUIDL 标签、红/蓝预测按钮游离在体系外），建立 `--brand / --up / --down / --tag` 色板。
- 卡片圆角、阴影、间距收敛为 3 档 spacing scale，清理首页右栏「Top X Creators」头像列表与文字基线不齐的问题。

---

## 六、执行顺序与工作量预估

| 阶段 | 内容 | 预估 |
|------|------|------|
| 第 1 周 | 3.1 路由重构 + 3.4 ticker/格式化工具 + `$$` bug | 路由是后续一切验收的前提 |
| 第 2 周 | 3.2 登录抽屉（含 WalletConnect 接入）+ 3.3 交易面板增强 | 转化核心 |
| 第 2~3 周 | 3.3 卡片信息升级 + 3.5 垃圾币治理 + 4.1/4.2 i18n 架构收敛（文案 key 化先行）| 前后端配合：需要 API 补 24h%、holders 字段 |
| 第 3~4 周 | 4.3~4.5 ko/ja 翻译、CJK 排版、OG 注入 | 翻译建议母语者 review 一轮 |
| 第 5~6 周 | P2 全部 + 四语回归走查（桌面/移动 × 4 locale 截图 diff）| |

### 需要后端/合约侧配合的点（提前排期）
1. API 补字段：24h 涨跌、持有人数、流动性、bonding curve 进度、创建时间；
2. OG 注入用的轻量 meta API（按 post id / tag id 返回摘要）；
3. 垃圾币过滤阈值规则（前端只做展示开关）。

---

## 七、不做什么（明确排除，防止范围蔓延）
- 不改产品机制（Proof-of-Brain、策展、打赏经济模型一概不动）；
- 不上 SSR/重写框架，SEO 用 Worker 注入 OG 的轻方案解决；
- 不做暗色模式（可列入下一期，色板 token 化已为其铺路）；
- 韩/日翻译不机翻直接上线，需母语 review。

---

## 附录：问题 → 代码落地点对照表（已逐项核对源码）

| # | 问题 | 文件 / 位置 | 改法摘要 |
|---|------|-------------|----------|
| 1 | 主 Tab 不改 URL | `src/layout/LeftSidebar.vue:56-83`（goToTag/goToCoin/goToPrediction）、`src/router/index.ts`、`src/stores/common.ts`（stateStore.activeMainMenu） | 新增 `/coins` `/predictions` 路由，meta 驱动 store |
| 2 | 登录后不回跳 | `src/router/index.ts` beforeEach `gotoHome` 分支 | 记录 `?redirect=`，mitt `login` 事件后回跳 |
| 3 | ticker `$$` | `src/views/HomeView.vue:282` + `src/utils/helper.ts:89`（formatPrice 自带 `$`） | 去模板 `$`；重构 format 三件套 |
| 4 | 英文硬拼接时间 | `src/utils/helper.ts:305-325` | `Intl.RelativeTimeFormat(locale)` |
| 5 | 语言二元 toggle | `src/layout/TopBar.vue:103-113`、`src/lang/index.ts` | 四语下拉；注册 ko/ja；同步 `<html lang>` |
| 6 | 文案硬编码 | locale 仅 105 key；views/components/layout 63 个文件含硬编码中文 | 全量文案审计入 key；zh.json 补 `amount` |
| 7 | 钱包仅 2 项 | `src/components/login/ChoseWallet.vue`、`src/utils/wallets.ts` | 增 OKX、WalletConnect v2 |
| 8 | 双轨登录无统一入口 | `src/components/login/LoginModal.vue` + `ChoseWallet.vue` + `src/react_app/`（Privy）、弹窗调度在 `src/layout/Layout.vue` | 合并为双段登录抽屉；TopBar 加常驻按钮 |
| 9 | DexScreener iframe 割裂 | `src/views/buy-sell/BuyAndSellView.vue:455`、`RecordList.vue:71`；原生图表已有 `src/views/buy-sell/Kline.vue`（klinecharts） | 毕业币也走原生 Kline，iframe 降级 |
| 10 | 禁止缩放 | `index.html:6` | 移除 `user-scalable=0` |
| 11 | OG 静态单一 | `index.html:13-17` | Worker crawler-only 动态 OG |
| 12 | 导航非语义化 | `src/layout/LeftSidebar.vue`（全部 `div @click`）、`src/layout/TabBar.vue` | `<router-link>` + aria-label |
| 13 | 币卡片信息密度 | `src/components/home/TagListItem.vue`（Mkt Cap 在 :54-57）、`src/views/HomeView.vue` Coin 网格 | 加 24h%、进度条、holders、sparkline（需 API 配合） |
| 14 | 交易面板缺提示 | `src/views/buy-sell/BuyAndSellView.vue`（含 slippage 逻辑）、`AmountProgressBar.vue` | 加价格影响/最低到手/手续费 |
| 15 | 涨跌色 locale 化 | `tailwind.config.js`（green-\*/red-\* 自定义色）→ 收敛为 `--color-up/--color-down` CSS 变量 | zh/ko/ja 默认红涨，en 默认绿涨，可手动切换 |

> 技术栈备注：Vue 3 + Pinia + vue-i18n（legacy:false，可直接用 ICU）+ Element Plus/Vant 双组件库 + veaury 嵌 React（仅 Privy）+ viem。移动/桌面分界 `web: 804px`。以上对照表均基于当前 `main` 工作区代码核对。
