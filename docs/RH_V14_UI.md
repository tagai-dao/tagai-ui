# RH V14 UI 接入记录

RH（4663）新创建使用 V14；BSC V13/V14 和 RH V9/V11 的历史部署保留。
API 已部署并验证；本次 UI 已完成开发、测试和构建；生产部署仍由用户执行。

## 已实现

- RH V14 Pump、代币模板、Hook、Nutbox/Trade/Liquidity/Buyback Router、交易矿池工厂地址来自已确认的部署记录；ABI 使用 API 已验证的 RH 部署 ABI。
- 创建表单使用当前链的 `/pump/v14/creation/:creator` 和 `X-Chain-Id`，校验 Pump、模板、工厂和资产数据。RH 候选为部署清单的 52 个资产：50 股票、2 ETF；实际选项只取 API/链上批准结果。
- API 不可用时，前端配置回退为两次固定区块 Multicall。资产名称、中文搜索和图标使用 RH 目录。支持 1–4 个组件、权重、手续费和可选交易矿池；费用按组件池和可选池总数计算。RH 费用示例显示 USDG，原生币金额显示 ETH。
- 注册回执队列分别按 API 环境和链保存，支持 RH V14 与 BSC 历史 V13/V14 的恢复；同一交易哈希不能跨链覆盖。已提交创建交易不因 API 暂时失败而重复发送。
- 曲线报价读取当前链的生命周期和实际 Pump。链或钱包改变时拒绝过期报价。上市后的普通交易使用前端可信部署中的 TradeRouter，拒绝 API 指定外部执行器。
- RH 主池和外部 Uniswap V4 池采用五字段 PoolKey、extsload 和 v4-core StateLibrary 存储布局：pools=6、liquidity=3、ticks=4、bitmap=5；正确读取负 tick/word 和有符号 liquidityNet。
- 完整交易状态、路由注册检查及 tick/bitmap 校验通过 Multicall，并固定 blockNumber；超过 100 子调用时分片 Multicall。路由哈希使用当前 chainId。缺失/失效的 tick 不推测流动性，等待缓存刷新。
- Token 生命周期/价格列表、LP 余额/奖励、矿池校验、奖励日程/APR、回购状态和工厂检查等本次涉及的批量读取均使用 Multicall。子调用失败无逐个合约 RPC 降级。
- RH LP 面板支持查询、增减流动性、质押和领取；ETH zap 使用 RH LiquidityRouter 与其 TradeRouter 绑定。BSC 旧 V13 的不可变流动性执行器保持原有绑定，不能用它处理 V14 zap。
- 回购状态和列表按 native 字段显示 ETH。报价校验实际 Pump 的 BuybackRouter 和 Basket 引擎，使用真实可执行模拟及每个组件的下限，不提交 discovery Multicall 给钱包。
- RH V14 关联的 Basket 仍登记为 V3，但有独立的新 Hook/Executor/SwapRouter。前端按链上 engine 从固定白名单选择这套部署，保留旧 RH V3；详情、列表估值、授权、交易和再平衡使用对应部署。
- RH 交易历史读取 `/pump/v14/trades/:token`，uint256 原始数量保留字符串，显示转换采用 formatUnits。此接口覆盖曲线/主池，不能声称覆盖组件池所有外部成交；Router 原始成交仍可在 API 的 events/TradeExecuted 接口读取。

## 规则与边界

Multicall 强制规则已保存在全局、工作区和 UI 的 AGENTS.md，约束所有 agent。
不得用 Promise.all 独立 eth_call、JSON-RPC 数组或逐个 RPC 作为批量读取的替代。

RH 交易矿池可以在创建时配置；交易奖励计算、订单、签名及领取后台尚未完成，
表单明确提示奖励暂未开放，现有交易奖励 intent 仍只在 BSC 请求。
RH AI 发币入口保持关闭，等待独立后台接入。
链上 Buyback Hook 的 getter 仍叫 buybackBnbReserve；在 RH 返回的单位是 ETH，
API/MySQL 使用 native_reserve/total_native_spent，不能据函数名按 BNB 显示。

## 验证

- 类型检查和生产构建通过（npm run build）。
- 237 个 UI 相关单元/回归测试通过，覆盖创建、注册、曲线、路由、负 tick、LP、回购、钱包链隔离和旧版本显示。
- 新增 scripts/test-rh-v14.mjs 的 12 个测试，覆盖 RH 的 52 资产、API/注册链头、Multicall 回退、工厂隔离、两链队列、Uniswap 存储布局、动态路由哈希、真实 Multicall 编解码及钱包切链拒绝。
- 直接使用编译后的 UI readCreationOptions 对公网验证：BSC 返回 43 个批准资产，RH 返回 52 个，均为两次固定区块 Multicall。
- 单次链上 Multicall 的 10 个子调用核实 RH TradeRouter 注册和 LiquidityRouter/BuybackRouter 绑定，与 UI 配置一致。
- 链上模板常量核对：RH COMPONENT_POOL_TAX_BPS=10、V4_NATIVE_ALLOCATION=3 ETH、V4_TOKEN_ALLOCATION=120,000,000。原曲线参数保留，合计约 5 ETH 上市规模。
- 浏览器验证真实创建组件：52 个候选、股票代码/中文名称搜索、组件切换、权重均分、80% 交易矿池上限及 LP 分配、ETH/USDG 文案。未登录创建入口仍要求连接钱包。
- 本地完整页面还出现一条旧 RH 导入币（0xfb2bb4bfb97a796abfae750113086b83173b0dcc）的 RH_V4_POOL_KEY_UNAVAILABLE，以及 Privy iframe 加载超时。没有证据将它们归因于本次 V14 改动；未绕过池校验或登录。生产旧导入币与实际登录仍需分别复验。
- 临时组件预览没有创建或交易按钮，不发送链上交易；验收后清理。截图保存在本机 /tmp/rh-v14-ui-creation-preview.png。

## 用户部署后验收

按一次一条命令继续更新和部署 UI，不需要新增 SQL 或 V14 开关。
部署后由用户用钱包验收真实创建、注册重试、曲线买卖、上市、股票路径、LP 操作、
回购/领取和新关联 Basket；同时检查 BSC V13/V14 与 RH V9/V11 的历史页面。
本地没有发送资金交易，不能把只读配置和模拟测试当作实际交易验收。

## 股票公司 Logo（2026-10-10）

RH 的 52 个股票/ETF 使用公司或基金 Logo；同公司与 BSC 共用相同资源，
不使用 Robinhood 发行方图标。创建列表、LP 池卡片、Basket 资产图标均按链和
合约地址查找静态目录，不依赖代币符号推断或 DexScreener 的发行方图片。
SKYHY（RH）与 SKHY（BSC）显式归为海力士，原 DexScreener 非公司图标
改成两链共用的官方 Logo： https://www.skhynix.com.cn/prCi.jsp 。
新增 20 个 RH 独有公司的本地图标，复用项目已有来源
（https://github.com/nvstly/icons 、Parqet、Financial Modeling Prep）。
其余现有本地资源和 BSC 的远程公司 Logo 保留；新增图标下载脚本为
scripts/download-rh-stock-logos.mjs ，仅下载缺失文件，校验 PNG。
新增 scripts/test-stock-logos.mjs 验证跨链同公司资源一致、海力士/Reddit
映射、52 个 RH 地址解析、链隔离及本地图片格式。浏览器实际加载 52/52。

## 提交前复验

2026-10-10 将本次暂存内容导出到独立目录复验：类型检查、178 项
V13/V14/RH/公司图标回归测试和生产构建均通过。未包含本地其他任务的
BSC ImportHelper 更新、导入策展池字段/文案及 output/ 文件。

## 首次上线复验与股票社区图标补充（2026-10-10）

用户已部署首个 UI 提交 366567b7。公网 API 创建配置返回 RH 52 个批准资产、
BSC 43 个；RH 目录引用的 49 个本地图标与线上文件逐字节一致。
实际首页验收发现股票社区卡片和详情仍使用社区/发行方图片，创建选择器的
公司图标映射没有覆盖这些入口，因此补充统一 stockArtwork 地址目录。

首页桌面/移动卡片、热门/近期代币、社区详情、顶部栏和 Feed 详情图标按
chainId + token 地址选择公司 Logo；同公司复用 BSC 资源。普通社区自定义图标
和 OSS 缩略图行为保留，不根据可编辑的名称或 ticker 判断公司身份。
另补充 GLD、SGOV、JNJ、SLV、USO、MRVL、NU、CRWV 八个已导入 RH
股票/ETF 的展示元数据；它们不在当前 52 个批准候选中，不改变创建资格或路由白名单。

补充修复的类型检查和 17 项相关回归测试通过。浏览器使用真实 API 数据验证
RH 首页 51 个股票/ETF 的 102 个桌面/移动图标全部加载，AAPL 详情显示 Apple
Logo；BSC 首页 56 个本地图标全部加载，两链 Apple 等公司共用资源。
本地截图为 /tmp/rh-stock-home-company-logos.png 和
/tmp/rh-stock-detail-company-logo.png。补充提交仍需用户再次部署前端。
真实钱包交易验收、RH 交易奖励后台和 RH AI 发币仍待后续完成。
