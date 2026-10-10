# RH Basket USDG 股票路由（2026-10-10）

独立 Basket V3 创建窗口此前仍使用旧 native ETH/股票预设，费率为 1% 或
5%，且统一误标为 WETH。本次更新推荐目录和相应创建读取，不改变已部署合约。
Pump V14 创建目录与独立 Basket 目录是两个入口；既有 Basket 的不可变路由保留。

## 推荐与实时校验

- 从 RH V14 的 52 个股票/ETF 身份目录取资产，读取已部署 Nutbox 的 USDG
  路由并补充固定 Uniswap V3 Factory 的 USDG 100/500/3000/10000 费率池。
- 生成脚本在区块 84825375 使用 Multicall3 发现 161 个候选池；公开数据确认
  70 个池的流动性超过 $50,000，覆盖 52 个资产。完整 PoolKey/池地址和时间
  保存在 src/utils/baskets/rh-usdg-presets.json。目录刷新脚本为
  scripts/discover-rh-basket-usdg-presets.mjs，不发送交易。
- 创建窗口通过 GeckoTerminal 多池接口刷新池 TVL，并匹配链、资产、USDG
  和 Uniswap 身份，再以固定区块的 Multicall 校验 canonical Factory、初始化、
  活跃流动性及 Hook 权限。每资产优先较低池费率，同费率优先较深池。
- 深度指标使用 reserve_in_usd；不把 V4 虚拟储备当作真实美元流动性。
  数据来源与接口说明：https://apiguide.geckoterminal.com/changelogs 。
- 完成的深度读取可在重新打开窗口时缓存最多 120 秒，链上状态仍重新校验；
  创建前不使用该缓存，再检查所选推荐池的深度。接口不可用、池失效或深度
  不达标时拒绝相应结果并显示重试，不退回旧 ETH/5% 股票推荐。

## 创建、报价和草稿

- USDG 成分直接从 USDG 预算买入，避免先转换 ETH；TagAgent、WETH 等
  非 USDG 对子仍使用该 Basket 协议的 Nutbox 桥接。
- V3/V4/V2 成分和桥接报价以 Multicall 分阶段执行，同一次报价的所有阶段
  和分片固定同一区块；读失败不退回逐个 eth_call。使用真实 DEX Quoter，
  V2 使用已验证 canonical Pair 的储备及对应链费率。
- 创建时批量检查 registrar/forwarder；所有成分包括推荐项均重新校验路由。
  费用、各腿报价、输出保护和合约路由编码保留输入顺序。
- RH 自定义资产报价校验使用 1 USDG（6 位小数），修正原先按 18 位数量
  传入 USDG 的问题。Basket V3 使用 spot，不再错误要求 V1 的 5 分钟 TWAP。
- 草稿恢复保留报价币和完整 PoolKey，RH USDG 对子不再被重建为 native ETH。
  旧 ETH 股票预设草稿迁移到新 USDG 预设；显式 USDG/自定义路由保留。
- 显示真实报价币：address(0) 显示 ETH/BNB，wrappedNative 显示 WETH/WBNB，
  settlementToken 显示 USDG/USDT。公司图标仍复用两链公司目录。

## 验证与上线

- 44 项相关回归测试通过，含 USDG 推荐、费率/深度筛选、跨链和失败处理、
  固定区块 Multicall 目标/子调用、混合桥接、草稿、BSC 交易报价/再平衡回归。
- 类型检查通过。真实浏览器显示 52 个 USDG 股票推荐；NVDA/GOOGL 选择、
  50/50 权重及关闭/重新打开后的恢复通过。BSC 创建窗口仍显示 USDT 股票池。截图：/tmp/rh-basket-usdg-preview.png。
- 真实 RH 只读验证：NVDA、AAPL、GOOGL 为 0.05% USDG 池，MSFT 为
  0.3%；META 为 USDG V4 池。包含 TagAgent、WETH 的混合成分报价全部返回正数。
- 区块 84831676 的额外 Multicall 验证全部 52 个目录推荐池的 10 USDG 买入
  报价返回正数；公开深度接口当时限流，这次额外检查明确使用目录深度快照，
  不声称重新验证了实时 TVL。记录：docs/rh-basket-usdg-live-validation.json。
  scripts/check-rh-basket-usdg.mjs 默认验证实时推荐；显式 --catalogue-only 仅
  验证目录的当前链上报价，该参数不影响生产创建流程。
- 区块 84836699 的 Multicall 确认独立 Basket V3 Hook 0x7103…8aA88 的
  approvedRegistrars 与 Router 0x9b5e…4653 的 approvedCreatorForwarders 均为 true。
  暂存内容独立导出后，类型检查和上述 44 项测试同样通过；其他本地任务的改动未纳入。
- 仅需部署前端；不需要部署合约、修改 API/server 或迁移数据库。钱包实际
  创建、首次买入和后续买卖仍由用户执行；本地没有发送资金交易。
