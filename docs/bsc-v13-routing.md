# BSC V13 本地拆单交易

本次实现范围是已上市 V13 代币的 BNB 买入、卖出收 BNB。UI 和 API 均在
`bsc-version13` 分支。V11 及更早版本沿用原入口。发行页、Basket V4 部署页、LP 玩法页
属于独立升级工作，不由本路由实现代表完成。

## 数据和执行流程

1. UI 请求 `GET /pump/v13/metadata/:token`，链头为 `X-Chain-Id: 56`。
2. API 提供 Token/Pump/Nutbox/执行器、主池、组件池、中转池、注册路径、费用规则、
   decimals、tick 列表及覆盖边界。API 首次加载会自行发现这些数据并缓存 60 秒，
   同 token 的并发请求合并；浏览器不承担发现工作。
3. 前端调用一次 Multicall3.aggregate3 获取该轮当前状态：V2 储备及余额、CL 价格、
   流动性、费用、API 所列 ticks/bitmap、路线配置和 Token 上市状态、执行器绑定。
   区块号和区块时间也在同一次调用返回；没有自动分包、前置发现或补读。
   `eth_gasPrice` 单独获取，它不是池子状态读取。
4. 同一行情快照在 10 秒内可以复用。Web Worker 本地计算所有金额分配和执行顺序，
   取消旧请求，只有当前金额/方向的结果能进入页面。配置最多缓存 60 秒。
5. 用户提交时：验证链、账号、报价年龄；卖出先检查 allowance，必要时单独授权本次金额；
   完整交易 simulateContract、estimateContractGas 成功后才发送。每次异步阶段后再次
   检查链/账号，避免钱包切换。买卖都传前端原 sellsman 对应的 IPShare subject。
6. 成交沿用交易页的 hash 上报流程。gas 估算比较属于启发式费用模型；发送前使用实际估算。

## tick 边界

API 每个 CL 池发现当前 bitmap word 前后各两个 word；密集时只返回距离当前 tick 最近
的 128 个初始化 tick，并明确 coverageLower/coverageUpper。总 tick 列表最多 512 个。
前端只读 API 给出的列表，不发现或补读任何额外 tick。

覆盖范围外的 tick 完全不处理。若覆盖范围内 bitmap 出现 API 未提供的初始化 tick，
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
  Tick API 覆盖和可支持 Hook 范围限制。

## 发布配置

TagAITradeRouter（支持 subject 的 `e2fce01` 版本）尚未部署。
API 环境变量 `BSC_V13_TRADE_ROUTER` 未配置时，metadata.executor=null，前端允许报价但
不允许提交。部署后填入执行器地址并重启 API，刷新前端报价即可读取配置，不需要另给
前端维护一份执行器地址。快照还校验执行器 pump/nutboxRouter 与 API 配置一致。

本次不新增数据库迁移；API 查询已有 bsc_token 确认版本，再校验官方 Pump.createdTokens。
未知版本/其他链不进入本路由。ABI 文件 `src/utils/v13/TradeRouter.json` 与合约导出一致。

## 验证

```bash
npm run type-check
node --test scripts/test-v13-routing.mjs scripts/test-trade-sellsman.mjs
npm run build-only
```

覆盖单次 multicall、未知 tick 无补读、失败读取/路线变更隔离、共享池顺序、税费舍入、
跨 tick SDK 双向对照、gas 选择、报价异步取消、账号/链切换拦截、授权金额及 subject。
测试中的毫秒数只反映本机 Node 计算耗时，不是浏览器/手机/网络性能承诺。
