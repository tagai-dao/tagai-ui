# Agent ID ATLAS · agent-id.tagai.fun

TagAI 的独立公开只读子站，迁入自已有的 Agent ID ATLAS。保留橙色 UI、名称/钱包/X 搜索、卡片/表格视图、证据来源与评级、CSV、BSC 实时名称查询、内盘/外盘代币交易和 Relic NFT 快照。**本 PR 不配置 DNS，不部署，不替换主站。**

## 目录和运行方式

本目录拥有独立 `package.json` 和锁文件；不要在主站根目录运行它的安装或构建命令。

```sh
cd apps/agent-id
npm ci
npm test
npm run check:data
npm run build
HOST=127.0.0.1 PORT=8790 npm start
```

Node >=22.13。访问 `http://127.0.0.1:8790/`，健康检查 `/healthz`。开发时两个终端分别执行 `npm run dev:api`（需要已有 dist）和 `npm run dev`（5178，代理 /api 到 8790）。程序不会自动载入 `.env`；shell 导出环境变量，或用 `node --env-file=.env server/index.mjs`。

## 技术人员部署步骤

1. 合并本 PR，在服务器取得仓库，在本目录运行 `docker compose up -d --build`。镜像自行构建前端，Node 服务仅映射到宿主 `127.0.0.1:8790`；确认 `curl -f http://127.0.0.1:8790/healthz` 成功。可在部署环境设置 `BSC_RPC_URL`，默认公共 BSC RPC；不要提交带凭证的 RPC URL。
2. 给 `agent-id.tagai.fun` 添加指向该服务器的 A 记录；只有服务器确实配置 IPv6 时才添加 AAAA。不要把子域名仅 CNAME 到旧 ChatGPT Sites 域名：旧平台未配置此自定义 Host/TLS。
3. 将 `deploy/nginx.conf` 接入该服务器 Nginx，执行 `nginx -t`。这是 HTTP 引导配置；技术人员使用已有证书管理流程，或 `certbot --nginx -d agent-id.tagai.fun`，启用有效 HTTPS 和 HTTP→HTTPS 跳转后再向公众开放。
4. 验收 HTTPS 首页、`/healthz`、`/api/directory`、`/activity/manifest.json`、名称查询、X 筛选、CSV、活动详情。不要仅凭容器启动认定 TLS/DNS 完成。
5. 子域名验收后，在 **TagAI 主站的构建环境**设置 `VITE_AGENT_ID_ATLAS_ENABLED=true` 并重新构建发布主站。桌面侧栏与移动端顶部菜单随之出现 Agent ID ATLAS 外链。默认关闭，避免技术人员尚未部署子域名时主站出现失效入口。关闭此变量并重新发布即可撤下入口。

若不用 Docker：运行上面的 npm ci/build/start，以进程管理器维持 Node 服务，再由 Nginx 转发。运行目录必须是本目录；发布需要 `dist/`、`server/`、`src/data/`、`package.json`/锁文件以及 production node_modules。不能只将 dist 放在纯静态主机上，否则 `/api/*` 不可用。

## 架构与边界

- 前端 Vite + React，无 Next/Vinext、ChatGPT 登录或 Sites 绑定。`server/index.mjs` 使用 Node 内置 HTTP、静态文件压缩、缓存和只读 API；无需数据库、钱包密钥或 X API key。
- `/api/directory` 返回仓库快照；`/api/resolve` 使用 BSC Multicall3，固定区块，读取 Registry `ownerOf(keccak256(label))` 或 `handleOf(address)`。不以参考站缓存钱包替代实时归属。解码/网络错误不当成“未注册”。单 IP 每分钟 30 次、最多 16 并发；Nginx 必须覆盖 X-Real-IP，默认仅信任回环代理；Compose 因 Docker bridge 显式设置 TRUST_PROXY=true，前提是端口仅绑定 127.0.0.1 且 Nginx 覆盖 X-Real-IP。不要在直接暴露端口的环境开启 TRUST_PROXY。
- `/api/snapshot` 从 bnb.fan 读取总注册统计，短缓存；参考站不可用不影响本地快照和其他功能。无需 Cookie/认证。
- 写入接口统一返回 405。旧 Sites 的 ChatGPT 登录/D1 不可直接用于此子域名，因此不开放未经鉴权的提交/导入。日后若要开放，须先接入 TagAI 认证、服务端审核、存储和来源校验。
- 当前公共证据 1,826 条、1,782 个名称，Grok 导入 1,732 条；来源报告 3,461 帖、1,563 OCR 图片。高/中/低只是来源评级，不等于 X/钱包控制权验证，最近七天并非全量。
- 链上活动快照截至 BSC 129215977（北京时间 2026-10-23 07:13:40）：1,370 条代币记录、95,000 枚 Relic、24,573 个活动 Agent ID。包含 AIPRO、.ai、GANG、Flaip；活动历史映射使用快照名称，不能证明交易发生时已注册。
- 不会自动访问用户电脑 localhost，也未加入定时采集/自动交易。无任何签名或资金操作。

## 数据更新与回退

`src/data/{registry,evidence,research}.json` 是身份/证据快照；`public/activity/` 包含 manifest、agents、feed 和按地址首字节分桶的钱包记录。维护者应通过 PR 替换已核对数据，保持 id、地址、数量、区块和来源一致，重新运行 `npm run check:data`，构建并部署。此次保留了已有审阅状态及数据校验脚本；不包含本机原始 X 抓取、凭证或整个电脑目录。

回退使用上一个已验收的提交重新构建部署；现有旧公开站点未在本 PR 中更改。主站部署与子站部署相互独立。
