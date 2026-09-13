# BSC V13 本地拆单交易

本次实现范围是已上市 V13 代币的 BNB 买入、卖出收 BNB。V11 及更早版本沿用原入口。发行页、Basket V4 部署页、LP 玩法页
属于独立升级工作，不由本路由实现代表完成。

## 数据和执行流程

1. UI 请求 `GET /pump/v13/metadata/:token`，链头为 `X-Chain-Id: 56`。
2. API 一次 SELECT 联查现有 community、bsc_token、bsc_pump13_token_index、bsc_pump13_token_component，
   上市只依据 bsc_token.state / community.listed_block，不读取 Graph 上市标记或请求 Graph。
   主池 ID 来自 community.pair；成分币、权重、pair 和 decimals 来自现有 SQL 表。
   路径及中转池固定参数来自进程内 Router 缓存。
   不新增表、不写 SQL、HTTP 请求不触发或等待 RPC；缺失返回 503 / V13_METADATA_PREPARING。
3. API 返回 tickDiscovery=server，附带后台缓存的 tick 清单、bitmap word 和覆盖边界。
   前端只执行一次 Multicall 获取 V2 储备/余额和 V3/V4 价格、流动性、tick 明细、实时 bitmap。
   同一调用也校验 Router 路径、Token 上市状态与执行器绑定；前端不发现或补查 tick。
   首次和后续刷新都只有一轮池子状态读取。缺失清单则在查链前返回准备中。
   Gas 价格独立缓存 60 秒，用于路线费用比较，不代替钱包发送时的实际费用。
4. 同一行情快照在 10 秒内可以复用。Web Worker 本地计算所有金额分配和执行顺序，
   取消旧请求，只有当前金额/方向的结果能进入页面。配置最多缓存 60 秒。
5. 用户提交时：验证链、账号、报价年龄；卖出先检查 allowance，必要时单独授权本次金额；
   完整交易 simulateContract、estimateContractGas 成功后才发送。每次异步阶段后再次
   检查链/账号，避免钱包切换。买卖都传前端原 sellsman 对应的 IPShare subject。
6. 成交沿用交易页的 hash 上报流程。gas 估算比较属于启发式费用模型；发送前使用实际估算。

## tick 边界

后端对每个 CL 池读取当前 bitmap word 前后各两个 word；密集时只保留距离当前 tick 最近
的 128 个初始化 tick，并设置 coverageLower/coverageUpper；每份报价元数据合计最多 512 个 tick。
tick 清单按池配置在 API 进程内存中复用，每 3 分钟刷新，与路由的 1 小时周期独立。
后台同一区块读取 slot0 和 bitmap，不缓存价格或流动性明细供报价使用；失败不覆盖该池旧清单，
也不延长有效期。超过 6 分钟的清单不再提供，API 返回 V13_METADATA_PREPARING。
后台每 5 秒检查待刷新池，单批最多 25 个，失败池按 3 分钟周期重试，避免阻塞其他池。
前端最终 Multicall 若发现新增 tick 或价格移出覆盖范围，提示准备/更新中，不额外查链，
不使用未知流动性计算。交易页同时丢弃旧元数据，下次手动刷新重新请求 API。

覆盖范围外的 tick 完全不处理。若覆盖范围内 bitmap 出现缓存未覆盖的初始化 tick，
整个依赖该池的路线失效；不把未知数据当作空流动性。交易触及覆盖边界后仍有未成交
输入时，该分配失败，优化器减小该路线投入或选择其他路线。全部路线无法完成时提示
刷新或降低金额。

## 本地算法与费用

- 精确 bigint 计算 V2 25 bps 费用和组件 T 转入/转出各 10 bps 税；捐赠余额不能计入用户
  本次投入，但第一次 swap 后储备包含原有余额，后续共享池模拟使用新储备。
- V3/V4 使用 SDK SwapMath/TickMath，逐初始化 tick 和 bitmap word 边界模拟，保留链上
  整数舍入顺序；V4 合并方向性 protocol fee 和 LP fee。
- V13 主池 BNB 端三份 30 bps 费用分别取整；买入先扣，卖出后扣。未知外部 Hook 不套用
  普通 CL 公式，API 排除该路线。当前支持官方 Pancake V2、V3 和无 Hook 的 Infinity CL
  中转，以及 V13 主池；其他 V2 费率、Uniswap V4 中转、未知 Hook 需要独立适配后开放。
- 每次候选评估按整条交易腿实际顺序执行，共享池共用同一份模拟状态。多个初始顺序
  进行粗分配，再用 1/64、1/256、1/1024 输入规模微调，尝试交换相邻腿顺序。可计算
  容量较小时，分配步长二分缩小。上次结果是额外初值，最佳单路线始终保留。
- 买入按 output/(input+gas) 比较，卖出按 output-gas 比较，整数交叉相乘避免价格浮点误差。
  相同时优先少腿。gas 采用路径/跨 tick 启发式估算，不宣称全局最优；实际报价还受
  tick 缓存覆盖和可支持 Hook 范围限制。

## 发布配置

前端执行器取自链配置（当前为 0x7D5480C10A98b0Feb4e5fA77aF3F01aE3a5E86F4），
不会直接信任 API 的 executor。单次 Multicall 还会校验执行器 pump/nutboxRouter。

不需要执行 SQL 迁移，也不需要启动 tiptag-server 新进程；此前 V38 快照表及 worker 方案已撤销。
部署顺序：先发布 API 并等待 tick 缓存预热，再发布 UI。旧 UI 能使用 server tick 清单；\n新 UI 不再为旧 API 的 tickDiscovery=client 自动发现 tick。
API bin/www 随现有后台任务启动 server/v13RouteCache.js，各 API 进程分别持有路由与 tick 内存缓存：

- 启动后立即预热数据库中已上市 V13 代币及其成分币使用的 Router 路径。
- 成功缓存的路径每小时刷新；每次路由扫描结束 60 秒后再扫描新代币或重试失败项。\n- tick 清单独立按 3 分钟周期刷新，共用池只刷新一次；路由慢查询不阻塞 tick 刷新循环。
- 单条路径按同一区块完整构建，失败不替换旧缓存；路径缓存最多保留两小时，tick 清单最多 6 分钟。
- RPC 使用 BSC_RPC_URL 或现有 RPC_NODE，单请求超时 10 秒；不读取钱包私钥，不发送交易。
- 内存不跨进程共享，重启需要预热。DISABLE_BACKGROUND_JOBS=1 时不会预热，冷缓存返回准备中。
- 不扫描 Router 的全部历史事件，只缓存当前数据库内 V13 代币实际使用的完整路径。
- 路由变更后旧路径会被前端实时校验拒绝，后台下一次刷新后恢复；需要立即更新可重启 API 预热。

未知版本/其他链不进入本路由。ABI 文件 `src/utils/v13/TradeRouter.json` 与合约导出一致。

## 验证

```bash
npm run type-check
node --test scripts/test-v13-routing.mjs scripts/test-v13-tick-discovery.mjs scripts/test-trade-sellsman.mjs
npm run build-only
```

覆盖首次/刷新均单轮、后台三分钟缓存、未知 tick 拒绝且无前端补读、失败读取/路线变更隔离、共享池顺序、税费舍入、
跨 tick SDK 双向对照、gas 选择、报价异步取消、账号/链切换拦截、授权金额及 subject。
测试中的毫秒数只反映本机 Node 计算耗时，不是浏览器/手机/网络性能承诺。


创建、内盘、Basket V4 和 LP 矿池的后续接入详见 [bsc-v13-lifecycle.md](./bsc-v13-lifecycle.md)。

API 模块：src/services/v13/metadata.js、route-cache.js、tick-cache.js、server/v13RouteCache.js。
每次元数据 HTTP 请求只有一次 SQL SELECT 和同步内存读取，每 IP 每分钟最多 60 次。
后台缓存刷新与 HTTP 路径分离，公开错误不包含 SQL/RPC 内部异常细节。
