# BSC V17 创建切换（2026-10-26）

新建社区的普通模式继续使用 V14，Binance 模式（`binanceWalletOnly=true`）改用 V17。RH 继续使用 V14。创建配置、CREATE2 地址预测、salt、预买报价、交易广播和回执登记均使用所选版本，不能再请求 V16 新建。历史 V16 的交易、详情、回购和已经广播的创建补登记继续使用原 V16 地址及接口。

可信 BSC 配置：

| 合约 | 地址 |
| --- | --- |
| Pump17 | `0x01B2308653c7e371B28A862444a40c12ca18b353` |
| Token17 模板 | `0x309E55BB49cE073227F8a2F67bE659dFeA3d691f` |
| Hook17 | `0xfF107D782cb2699F617aD96a4ccA39F8D6800cc1` |
| BuybackRouter17 | `0xA906917D83D47526e4c8a212606dE63a778f4151` |

`src/utils/v17` ABI 来自实际部署源码提交 `f9eb071` 的 Pump/Token artifact。创建前仍检查链上模板及 Router/Registry 权限。所有批量链上读取使用 Multicall，依赖阶段固定同一区块。

V17 创建预买最多 1000 万枚；后续内盘买入报价读取买家 `innerMarketBought` 和 `INNER_MARKET_BUY_LIMIT`，按实际可成交数量检查累计额度。卖出或转出不恢复额度。Binance Handle 买入检查沿用原路径，最终权限及额度由合约执行。

发布顺序：先发布支持 `/pump/v17` 的 API，再发布 UI，同时发布后台的 V17 上市 keeper/账号同步支持。此代码变更未发布生产服务，也未执行新的链上或数据库写入。
