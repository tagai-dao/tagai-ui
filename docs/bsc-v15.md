# BSC V15 UI 接入

2026-10-21：本次只修改代码与本地验证，不执行生产发布或链上交易。BSC 创建默认不勾选“内盘仅限 Binance 钱包购买”，使用 V14；勾选后使用 V15。RH 仍使用 V14，历史代币按各自版本选址。

## 地址与行为

| 项目 | BSC 地址 |
| --- | --- |
| Pump15 | `0x97f35B4631F4FFBF8050B17fAd6579D6F60A289D` |
| Token implementation15 | `0x8851D281f76951d41C9ff5c820D2D387f820f073` |
| TagAISwapHook15 | `0x9A60808605f291e632e9AdbBAb4E4343f43A0CC1` |
| BuybackRouter15 | `0x5375010a9ea81293FbfbB95853Ae4305429beEa0` |
| HandleRegistry | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |

地址保存在 `src/config/chains.ts`。Pump15 / Token15 ABI 从合约仓库归档源码 `886309b` 对应的编译 artifact 导出。不会复用 V14 Token 模板或旧上架 Hook。

- 创建页只在 BSC 显示 `binanceWalletOnly` 复选框，默认 false：未选 V14、选中 V15。选项仅决定新币部署，不能修改已创建代币的规则。V15 创建与原子预买不检查创建者 handle。
- 创建配置按选择请求 `/pump/v14/creation/:creator` 或 `/pump/v15/creation/:creator`。API 不可用时，链上 fallback 分阶段 Multicall 读取，固定同一区块；新模板、Nutbox operator、Basket creator forwarder 必须匹配。
- 费用、白名单、salt 搜索/缓存、本地地址预测与实际部署固定使用所选 Pump 和模板。切换选项重新读取配置，迟到响应不能覆盖新选择；错误版本的 API 响应必须在同一所选版本的链上 Multicall fallback 校验。广播回调立即持久化所选 version 与 binanceWalletOnly，收据确认后调用对应 `/pump/v14/register` 或 `/pump/v15/register`；刷新和 API 暂时失败不丢失待入库记录。V13/V14 历史收据仍走各自端点。
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

## 推送前合入远端更新

已合入远端 main 的 `7510d32b` 回购修复：BSC 按可信 Pump 注册表识别 Token，不调用不存在的 Token.getPump()。候选集同时包含 V13/V14/V15，全部通过固定区块 Multicall 读取，并拒绝未知或归属不唯一的代币；RH 保留独立 getPump ABI。

## 可选内盘购买资格（2026-10-21）

- UI `main`：默认 V14，勾选走 V15。RH 隐藏此选项，继续 V14。
- API 验证 `binanceWalletOnly` 为布尔值且与请求端点的版本一致；真实收据必须来自对应可信 Pump，入库版本取验证结果，不能用前端参数覆盖。
- 历史待入库记录未带新字段时，仍按已保存的 version 走对应端点恢复。
- 新增 `node --test scripts/test-creation-mode.mjs`，验证实际 createCoin 的配置、salt、广播、回执路径，以及真实 viem transport 的 Multicall 目标、完整子调用集合、固定区块、错误版本 fallback 和失败子调用拒绝。
- 未执行生产发布、链上创建或数据库写入。无需新增数据库列，已有 version=14/15 就是长期购买规则的依据。

验证：UI 类型检查及生产构建通过；创建模式、配置、salt、队列恢复、V14/V15 与 RH 等相关脚本共 73 项测试通过。

## V15 内盘买入按钮提示

按用户确认的合约规则判断连接地址的 `handleOf`，不按钱包应用名称或 provider 标志判断。
BSC V15、尚未上市、买入页、已连接地址且代币链上状态已确认时，立即以固定区块
Multicall 读取注册状态，不依赖输入购买金额。空字符串在购买按钮下显示
“只有Binance钱包可以在内盘购买”，检查中、未注册或读取失败时禁用购买并阻止提交。
任意非空字符串（包含空白）均通过；失败单独显示暂时无法确认，不推断为未注册。

切换地址、Token、链、买卖方向或上市状态时立即更新；迟到的旧请求与卸载后的结果
不能污染新状态。现有刷新报价按钮也会重查资格，成交报价与合约仍会验证当前地址。
V14、上市后交易、卖出和未连接时的钱包连接入口不受该资格检查限制。

`node --test scripts/test-v15-buyer-prompt.mjs scripts/test-v15-eligibility.mjs scripts/test-trade-listing.mjs`
覆盖真实 Multicall 的目标/子调用/区块、空与非空 Handle、节点失败、换地址竞态、
上下文失效与销毁、重试恢复，以及按钮下的中文文案和提交拦截。
