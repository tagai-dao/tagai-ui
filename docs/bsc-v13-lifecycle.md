# BSC V13 / Basket V4 功能接入

2026-09-08。本次 UI 在 `bsc-version13`、API 在 `bsc` 开发。代码未提交、未广播新合约、未发布生产。

## 创建与恢复

BSC 创建入口使用 Pump13 和对应 Token implementation，保留旧版本地址与 RH 配置。创建表单增加指数名称、符号、1–4 个委员会已批准资产、权重、指数交易费率、创建者分成和社区管理权限。

权重合计 10000 bps；指数费率 100–300 bps；创建者分成 0–3000 bps，是指数交易费的内部份额。名称最多 64 UTF-8 字节，符号最多 16 字节。固定费用为 Pump fee + 尚未创建时的 IPShare fee + Community fee + 成分数量 × settings fee；初始买入另计。实际创建前重新读费用、校验 salt 和模拟交易。

钱包返回 hash 后、等待确认前，保存 `createTokenForm:<chainId>:<account>`。确认成功后提交 `POST /pump/v13/register`，API 只使用真实 receipt 里的合约地址及配置。恢复记录仅在登记成功或确认交易回滚后清除；RPC 超时、API 失败、刷新页面都保留原 hash，不重复部署。Basket 创建使用 `basket-registration:<chainId>:<account>`，恢复时使用原来的协议版本。

## 详情、交易与矿池

- V13 详情显示内盘供应进度、等待上市、指数配置、成分目标权重、Pair/矿池链接、关联指数、协议回购统计和持币人列表。协议累计统计可能滞后；个人分红直接读 `pendingBuybackReward` 并调用 `claimBuybackReward`。
- 未上市报价读取同一区块的供给与动态费率，调用 Pump 曲线；买卖用 Token13。等待上市禁用内盘交易。上市后沿用 `bsc-v13-routing.md` 的 API metadata + 单次 aggregate3 + Worker 模式，不发现额外 tick。
- 玩法新增 LP 矿池入口，显示两侧储备、总质押、个人 LP、个人质押、待领取奖励及协议操作费。链上验证组件 Pair、stakeToken 和 Community 关联后才允许操作。
- 现有 ERC20Staking 仅为调用者质押，合约保持不变。LP 授权后用户直接 deposit；解押 withdraw；领取 Community.withdrawPoolsRewards。页面默认质押，支持 Max LP，重开页面仍可使用钱包已有 LP。
- 添加流动性支持已有两侧资产和 BNB。新增 `TagAILiquidityRouter` 校验 Pump 创建记录、Token 上市状态、成分、Factory 和基础设施；按实际储备配比添加，以实际 LP 到账检查下限；双资产加池原币退回余量，BNB 加池将余量换回 BNB。移除按税后实际到账检查下限。
- BNB 模式固定从 V4 主池购买 T，从 NutboxRouter 注册路径购买所选成分资产。Worker 只搜索两边的 BNB 分配比例，先以 10% 粗搜，再按 1%、0.1%、0.01% 在较优候选附近细搜。模拟顺序为主池买 T、买成分资产、添加 LP、卖余量 T、卖余量成分资产；复用同一份池状态，包含费用、税、余量卖出和估算 Gas。主池不可用时不回退到其他池购买 T。独立代币买卖仍保留原多池聚合算法。
- BNB 加池在一笔交易中执行 TradeRouter 主池买 Token（包含 IPShare subject）、NutboxRouter 买成分资产、生成 LP；剩余 T 通过 TradeRouter 主池卖回 BNB，剩余成分资产通过 NutboxRouter 反向路径卖回 BNB，统一退给用户。辅助合约内部构造唯一的主池交易腿，前端不能传入其他买 T 路径。LP 直接到用户钱包，页面预填本次获得的 LP，用户再发独立质押交易。
- 成分 Pair 交易税按 Token13 的 `amount / 1000` 向下取整，报价和实际最低到账保护均考虑此税。底层池状态变化可能使模拟失败，需重新报价。

旧 Token 页面与交易仍按原版本派发。V13 只使用通用持币人列表，不展示旧社交矿池的固定分发量。

### 输入金额后的 LP 预估

前端沿用 Worker 链下报价，无需新增合约 view 报价接口。BNB 输入停止 400 毫秒后自动更新，展示预计 LP、按所选滑点计算的最低 LP 和预计 BNB 退款；另保留手动刷新，每 20 秒在空闲时刷新报价。输入/成分/账户/链变更时清除旧结果并取消尚未完成的报价，离开页面终止 Worker。滑点变化只重算本地最低 LP，不触发新的 RPC。报价未完成、执行器未配置或滑点无效时不能提交。

LP 预估使用兑换后的资产数量和池子储备，计入加池转账税，按两侧可支持的 LP 中较小值估算。最终以交易执行结果为准，合约仍校验实际 LP 余额增加不少于 minLP。

### BNB 余量退款保护

新版 `addWithBNB` 仅接收 Zap struct，包含两个购买路径 hash 和两种余量资产的 `min*RefundRateX128`；前端 ABI 已与编译输出同步。退币最低金额按实际余量乘以受滑点保护的单位最低 BNB 价格计算，避免因余量变化而把固定退款目标套到错误金额上。前端用购买后状态下全量反向报价生成保守单位价格，再计算预计余量退款；价格下限不承诺实际成交价。

卖出检查实际 BNB 余额增长、原资产消费量，授权仅本次金额，成交后归零。无法达到最低到账则整笔回滚，包括已生成的 LP。最低可兑换金额不足 1 wei BNB 的舍入零头原币返还并发 DustRefund 事件；不会无限留在合约，也不会为零输出强行提交兑换。最终 NativeRefund 事件记录本次原生币退款，不包含合约原有余额。

本轮仅更新前端和流动性辅助合约；API metadata 接口不变。尚未部署的辅助合约应使用这一版 ABI/字节码。

## Basket V4

UI 与 API 的 BSC 默认创建版本为 4；V2/V3 地址映射保留。V4 的交易、调仓路由和费用路径使用对应部署；共有 ABI 函数和事件已逐项对照 V4 编译 artifact 的 selector 与返回类型。完整 ABI 位于 `src/utils/v13/Basket*4.json`。

创建前读 Registry.approvedRegistrars 与 Hook.approvedCreatorForwarders，未配置授权则显示失败，不提交无法成功的创建交易。API 支持可信旧版 receipt 的补登记，避免升级导致历史创建无法恢复。

## 数据库与发布

本次没有新增 SQL 迁移，使用已执行的 `tiptag-server/src/db/sql/v35-bsc-pump13-basket4-graph.sql` 及其既有前置表。API 的创建事务、接口字段和索引接管规则见 API 仓库同名文档。

发布前需要完成：

1. 部署并核验含 subject 的 TagAITradeRouter，再部署 TagAILiquidityRouter；脚本分别为 `DeployBSCTagAITradeRouter.s.sol` 与 `DeployBSCTagAILiquidityRouter.s.sol`。两者均在 TagAI-contract-V2/script。
2. API 配置 `BSC_V13_TRADE_ROUTER` 和 `BSC_V13_LIQUIDITY_ROUTER`。前端从 API 读取地址。未配置时对应操作保持禁用，已存在的质押操作不依赖辅助合约。
3. 核验 Basket V4 Registry/Hook/Router 链上授权，再发布 API 与 UI。不要将历史部署 JSON 中的授权状态当作当前链上状态。
4. 在可控环境完成钱包全流程：创建 → 索引前可见 → 内盘买卖 → listing pending → 上市交易 → BNB/双资产加池 → 质押/领取/解押/移除，同时回归旧 Token/Basket 和 RH。

## 已完成验证与边界

- API receipt 与事务回滚/冲突测试、路由集成测试、V13 metadata、Basket/RH 相关测试。
- UI 路由/税/共享池 zap 数学测试、创建配置校验和历史部署选择、Basket V4 ABI 对照、类型检查和生产构建。
- Solidity 交易执行器与流动性辅助合约本地单测，覆盖滑点回滚、退款、历史余额隔离、subject、LP 收款人和配比 fuzz。
- 浏览器实际渲染新创建配置组件并检查中文表单。未连接真实钱包、未签名、未把本地模拟等同于链上端到端验收。

上述发布与钱包联调尚未执行，因此不能将本次代码完成表述为“已经上线并完整验收”。
