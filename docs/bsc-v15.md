# BSC V15 UI 接入

2026-10-21：本次只修改代码与本地验证，不执行生产发布或链上交易。BSC 新币默认使用 V15；RH 仍使用 V14，历史代币按各自版本选址。

## 地址与行为

| 项目 | BSC 地址 |
| --- | --- |
| Pump15 | `0x97f35B4631F4FFBF8050B17fAd6579D6F60A289D` |
| Token implementation15 | `0x8851D281f76951d41C9ff5c820D2D387f820f073` |
| TagAISwapHook15 | `0x9A60808605f291e632e9AdbBAb4E4343f43A0CC1` |
| BuybackRouter15 | `0x5375010a9ea81293FbfbB95853Ae4305429beEa0` |
| HandleRegistry | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |

地址保存在 `src/config/chains.ts`。Pump15 / Token15 ABI 从合约仓库归档源码 `886309b` 对应的编译 artifact 导出。不会复用 V14 Token 模板或旧上架 Hook。

- 新币创建调用 V15，支持成分配置及可选交易策展池；创建与原子预买不检查创建者 handle。
- 创建配置优先请求 API `/pump/v15/creation/:creator`。API 不可用时，链上 fallback 分阶段 Multicall 读取，固定同一区块；新模板、Nutbox operator、Basket creator forwarder 必须匹配。
- 本地 salt 预测使用新 Pump 和新模板。广播回调立即将 V15 元数据持久化，收据确认后调用 `/pump/v15/register`；刷新和 API 暂时失败不丢失待入库记录。V13/V14 历史收据仍走各自端点。
- 普通内盘买入报价在同一区块读取供给、费用、报价和当前钱包的 `handleOf`。只判断返回字符串是否非空，不 trim、不验证格式；RPC 或必需子调用失败时不提供买入报价。
- 包含创建者在内的后续买入均受限制；卖出及上市后交易不新增 handle 检查。换钱包不得沿用旧钱包资格报价，提交前仍执行真实合约模拟。
- 页面显示注册要求，并将 `HandleNotRegistered(address)`（包括裸 revert selector）转为可读提示。注册后刷新报价即可重试。

## 上线边界

区块 `128871842` 的固定区块 Multicall 已确认：新 Pump 的 Nutbox/Basket 核心授权为 true；owner 已为多签 `0x871fb7006C5964B21695Ba20006021777A26146C`，pendingOwner 为零。

核心授权不等于所有外围入口已激活。上市后的多池交易仍实时检查共享 TradeRouter 的 `supportsToken`；owner 需登记新 Pump。旧 V13 流动性助手不会用于 V15。评论代买的共享 Adapter 不能代替最终用户的内盘资格检查，仍需独立适配。本次没有修改这些链上合约或授权。

API 的收据入库和内盘成交上报支持 V15；Graph/Substreams 对 V15 的持续事件采集、上市状态和历史行情回填须另行接入。本次没有把索引器发布或外围入口适配标为完成。发布时先更新 API，再发布 UI。

## 验证

- `npm run build`：类型检查与生产构建通过。
- 本次相关 UI 回归共 96 通过、0 失败（原组合 95 项，以及新增的裸 revert selector 提示测试）。
- `node --test scripts/test-v15-eligibility.mjs`：真实 viem transport 验证 eth_call 目标仅为 Multicall、子调用集合及固定区块、空/非空 handle、必需读取失败和创建广播回调持久化。
- 相关创建、队列、salt、生命周期、历史版本/RH、回购、路由及成交回报回归见本次运行记录。
