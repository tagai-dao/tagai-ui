# tiptag-ui-vue

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

## 本地调试模式速查

以下命令均在 `tiptag-ui` 仓库根目录执行。这些模式都启动本机前端，不会部署上线；是否使用真实资金取决于连接的链，而不是页面是否在 localhost。

| 模式 | 启动命令 | 默认访问地址 | API / 链 / 资金 |
| --- | --- | --- | --- |
| 正式环境开发（热更新） | `npm run dev` | `http://127.0.0.1:5173/bsc` | 默认正式 API + BSC 主网 56，真实资金；环境变量可覆盖 API |
| 本地 fork 人工测试（热更新） | `npm run dev:fork` | `http://127.0.0.1:15173/bsc` | 临时 API + fork 链 560013，测试资金 |
| 生产构建预览（无热更新） | `npm run build` 成功后 `npm run preview` | `http://localhost:4173/bsc` | 由构建时配置决定；连接正式环境时使用真实资金 |
| 本地 API 联调（可选） | `npm run dev:local-api` | `http://127.0.0.1:5173/bsc` | API 为 `http://127.0.0.1:9900`，链仍是主网配置，不是 fork |

普通 dev / preview 遇到端口占用可能换端口，以终端输出为准；下方明确指定端口的命令使用 `--strictPort`，占用时直接报错。普通 dev 与本地 API 联调不要共用同一浏览器 origin 的会话；切换后核对 API 地址和钱包网络。

### 正式环境开发：快速启动

```sh
npm run dev
```

默认连接正式 API 和主网，可边修改边查看。若担心 `.env`、`.env.local` 或终端变量残留了测试地址，使用下一节的显式配置命令。

### 本地连接正式环境

以下命令在 `tiptag-ui` 仓库根目录执行，不启动 fork、临时 API 或本地 keeper，也不要求运行本地数据库和索引。

日常查看、修改正式页面（带热更新）：

```sh
VITE_APP_BACKEND_API_URL=https://bsc-api.tagai.fun VITE_USE_MOCK_QUOTE=false npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

打开 `http://127.0.0.1:5173/bsc`。这里使用普通 Vite 配置和真实钱包 / BSC 主网 RPC，不会加载 `local-fork/vite.config.ts`。

查看当前代码的生产构建效果（推荐用于上线前验收，无热更新）：

```sh
VITE_APP_BACKEND_API_URL=https://bsc-api.tagai.fun VITE_USE_MOCK_QUOTE=false npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

仅在构建成功后运行预览，打开 `http://127.0.0.1:4173/bsc`。这是当前代码构建后的 `dist/`，不是拉取线上已部署版本；构建会更新本地 `dist/`，预览不会部署任何内容。环境变量在构建时写入，改完配置必须重新构建，仅重启 preview 不会改变 API 地址。不要误用 `dev:fork` 或 `dev:local-api`。

- 这些命令显式指定正式 API 并关闭强制 mock 开关；仍需核对其他环境变量与部署环境一致。旧 SwapToken / 1inch 功能缺少所需配置时仍可能回退 mock，不能仅凭该开关认定所有功能都是真实报价；这不是 V13 路由报价逻辑。
- 本机正式模式并非只读沙箱。BSC 钱包应切换到主网（chain ID 56），不能使用 fork 的 560013；创建、买卖、授权、加减 LP 会使用真实 BNB / 代币，上传和 API 写入也会影响正式环境。只查看时不必确认任何交易。
- 真实登录还受 Privy / OAuth 允许域名和回调、正式 API 的 CORS 限制。`127.0.0.1` 与 `localhost`、5173 与 4173 是不同 origin，需要分别获准；本地失败时不要绕过登录校验，应在已配置的地址或真实部署域名验收。
- 生产预览不会复刻部署平台的 HTTPS、响应头和域名配置；相关功能仍需真实域名验收。各模式固定使用不同端口，避免混用浏览器存储和 Service Worker。

### 本地 fork：原页面人工测试

依赖已安装的 Foundry / Anvil、前端依赖、同工作区 `TagAI-contract-V2` 部署文件及 `tagai-api` 的 ethers v6 依赖。启动器从环境变量或合约仓库 `.env` 读取 `BSC_RPC_URL`；不需要主网私钥，不启动正式 API、数据库、索引或服务。

```sh
npm run dev:fork
```

打开 `http://127.0.0.1:15173/bsc`，使用装有钱包扩展的浏览器：

1. 在橙色管理面板点击「连接 / 添加本地链」，确认链 ID 为 **560013**，钱包 RPC 为 `http://localhost:18545`。
2. 点击「补到 1000 BNB」领取本地测试资金。
3. 按需下载面板提供的测试 PNG，在原创建弹窗中选择、裁剪和上传；表单校验不跳过。
4. 自己操作原页面完成创建、买卖等流程；进入 pendinglist 后，用面板的 List / Keeper 操作推进上市，再测试外盘交易、LP、质押及奖励功能。自动 keeper 默认关闭。

正常启动会恢复 `.local-fork/checkpoint.json`；按 `Ctrl+C` 会尝试保存快照并停止本次启动的本地服务。只有明确需要从新的主网状态开始时才使用：

```sh
npm run dev:fork -- --fresh
```

`--fresh` 会归档旧测试状态并新建 fork，不是普通重启命令。重建测试链后若钱包缓存旧 nonce，需要清除该本地网络的活动记录。`.local-fork/` 中的快照、图片和日志不提交、不部署。

fork 使用同一套正式页面和交易算法，但真实登录、DexScreener、正式 API / 索引 / keeper 的集成不算在 fork 内验收完成，详见 [fork 环境与独立验收清单](local-fork/README.md)。

### 本地 API 联调：不是 fork

仅在需要调试本地后端时使用；先自行启动监听 9900 端口的 API，再启动前端：

```sh
npm run dev:local-api
```

这个命令只替换 API 地址，不会启动 Anvil、发放测试 BNB 或把钱包切到测试链。链上交易仍可能使用主网真实资金；API 是否操作正式数据库取决于该后端自身配置，不能将此模式视为隔离沙箱。

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
