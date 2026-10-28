# BSC V18 创建切换（2026-10-28）

新建代币仅支持 V14 和 V18：普通模式使用 V14，`binanceWalletOnly=true` 使用 V18；RH 继续使用 V14。创建配置、CREATE2 salt 和地址预测、预买报价、广播、回执登记与失败重试均使用所选版本。创建辅助函数拒绝 V15/V16/V17，包括过期的默认版本配置。

历史版本的交易、详情、回购和已广播交易的补登记仍使用各自的可信部署地址。V18 属于 BSC Agent Launch，内盘买入沿用 Handle 校验和累计 1000 万枚买入上限，上市交易沿用受信任的多 Pump 执行器及其链上准入检查。

| 合约 | 地址 |
| --- | --- |
| Pump18 | `0x3B174dB24A44d7172C1f4Fb8Ab387F3931681C24` |
| Token18 模板 | `0x02DC3D9bd600C147F347e584167b58953353BDbF` |
| Hook18 | `0x4dA421377b1dbf739f409919a07EAa7284BE0Cc1` |
| BuybackRouter18 | `0x3468210f9d4522d20d120F122fcCd56c0C5e5074` |

`src/utils/v18` ABI 从 TagAI-contract-V2 的实际 Pump/Token artifact 导出，导出前核对 `deployments/56/version18.json` 的全部 `SourceFilesSha256`，对应部署源码提交 `6eae99ebc812250ce4b70b4ab11b1105c6944037`。

API 优先使用 `/pump/v18/creation/:creator`，不可用时按同一版本进行固定区块的 Multicall 回退。模板不匹配、必要子调用失败、Router operator 或 Registry forwarder 权限未激活时拒绝创建。IPShare 自动创建由已部署 Token18 执行。

151 项前端回归测试通过。验证覆盖创建模式、被禁用版本、回执重试、Handle/累计限额、Multicall 目标及子调用和固定区块、回购 Pump 识别、上市交易准入及可信执行器选择；类型检查和生产构建通过。

先发布支持 V18 的 API，再发布 UI，并使用包含 V18 的 Graph 与 keeper。此记录对应本地代码更新，不代表生产发布或多签激活完成；没有执行链上或数据库写入。
