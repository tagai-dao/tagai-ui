# BSC V19 普通创建模式

默认普通创建由 V14 切到已部署 V19；勾选 Binance 选项仍用 V18；RH 保持 V14。历史 V14/V18 代币继续使用各自地址和 ABI 交易、登记和恢复，不重标版本。

正式地址已写入 `src/config/chains.ts`，BSC `latestPumpVersion=19`：

| 合约 | 地址 |
| --- | --- |
| Pump19 | `0x94c5293001C57727291fd4865107F0B34eED471F` |
| Token19 模板 | `0x63386f6BFa34a3341509312023dDF5dcEFA14fFB` |
| Hook19 | `0x28D5dA2FD4d0AAAdb72F48540CE2Ff2426950cc1` |
| BuybackRouter19 | `0x93220081F6c98AfFC673CB2584C2e123d88a8E87` |

地址与 ABI 对应 `TagAI-contract-V2/deployments/56/version19.json` 和最终编译产物。共享 Registry / NutboxRouter 也按部署记录回填。V18 的合约地址、handle 校验和购买模式保留。

V19 无 handle 检查，保留自动创建 IPShare 和每代币/每地址累计 1000 万枚买入上限（预买计入、卖出不恢复）；上市前普通公共转账受限，bonding curve 买卖和向本代币自己 Nutbox 社区的转入允许。普通合约钱包仍受 IPShare 创建约束。

创建配置、模板、salt、预买、广播、回执登记/重试、详情、报价、上市快照和回购识别 V19。API 未就绪时只用固定区块 Multicall 查询链上 V19 配置，不切回 V14/V18。模板、Router operator 和 Registry forwarder 未就绪时拒绝创建。

转账白名单读取链上 `nutboxCommunity()`；前 15 秒内外均生效。转账弹窗以固定区块 Multicall 同时读取余额、上市状态及社区，提交前复核。直接转入只增加社区余额，`inject` 才登记释放计划。

发布由用户执行。先更新 API 和后台服务，再发布前端；生产环境或多签权限未由本次修改自动变更。Graph 继续使用同一子图 ID，确认新版已同步即可。新旧创建模式、交易与转账的验证命令可运行 `scripts/test-creation-mode.mjs`、`test-v15-eligibility.mjs` 和 `test-v19-transfer.mjs`；完整前端构建为 `npm run build`。

## 2026-11-04 验证结果

前端定向回归 160 项通过；`npm run build`（含类型检查）通过。
