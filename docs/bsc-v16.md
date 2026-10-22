# BSC V16 UI 接入（2026-10-22）

创建页的 `binanceWalletOnly` 默认 false，未勾选使用 V14；勾选“Bonding Curve（内盘）阶段：仅 AI Agent（Binance Agentic Wallet）可购买。”使用 V16。RH 保持 V14。

| 合约 | BSC 地址 |
| --- | --- |
| Pump16 | `0xee8D16f44c89B5F858e223Ab77c6091E184AaDf8` |
| Token16 implementation | `0x2eD2ac896392f2C1a4585da277c2095E2C975583` |
| Hook16 | `0x2a540ee894689d1820e95Feb26a8529a7AbA0CC1` |
| BuybackRouter16 | `0x2f71b84808d1F6cA4A6179C2A32615C2f408817d` |

地址来自合约仓库 `deployments/56/version16.json`，ABI 由部署源码提交 `cb694b648482c33d4ea0f983fb6b37a7af6bbe71` 对应的 Solidity 0.8.26 artifact 导出。

费用、资产、Token 模板、salt 缓存、预买估算、广播与回执登记始终跟随选择的版本。API 配置若版本/地址不符，则通过固定区块分阶段 Multicall 读取选择的 Pump；必需读取失败、模板不匹配或 Nutbox/Basket 权限未激活时拒绝创建。创建时的原子预买继续按合约豁免 Handle 检查。

V15 与 V16 的普通内盘买入沿用非空 `handleOf(account)` 规则和按钮下方资格提示，卖出与上市后交易不检查 Handle。V16 内盘转账限制由 Token16 合约执行。新版本同时接入代币分类、Agent 标识、报价、上市 Hook 和回购归属识别；旧 V15 地址与 ABI 保留。

登记队列分别通过 `/pump/v14/register`、`/pump/v15/register`、`/pump/v16/register` 重试原始交易，不会把 V15 历史收据转为 V16。

发布前需完成合约仓库 `version16.safe.json` 对应的链上多签激活，先发布 API 再发布 UI。上市聚合交易还受现有 MultiPump Router 的链上准入约束；Graph/后台索引的 V16 数据源需独立接入。本次不执行生产发布或链上授权。

验证覆盖创建选择、预买/广播版本、历史登记恢复、API 错配回退、Handle 资格、V15/V16 报价与 Hook 隔离，以及回购和原有 RH/V13/V14 回归；Multicall 测试检查目标、子调用与固定区块。
