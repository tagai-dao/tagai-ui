# BSC ImportHelper V3 切换（2026-11-02）

V3：`0xDcCc7428338Db3a7480bEcAa9dAc2965425E0EDF`。BSC 多签交易 `0x9ed6b5022bcb1374eec47fcd21455659bce02e8080f0da9b83b4dd9e5fc3b69b` 在区块 `131204085` 同时将 AgentSwapWrapper operator 和普通 ImportedTokenSwapWrapper registrar 设置为 V3；固定区块 `131205034` Multicall 已确认两项配置。

本次切换 BSC 默认 Helper 地址，并让费用查询明确要求 Helper `VERSION() == 3`；RH 保持 V2 地址及 `VERSION() == 2`。两者共用默认奖励池计费和 `createCommunityAndPool(token, address(0))` selector，导入仍不要求 IPShare 或 Binance Handle。新 BSC 导入由 V3 原子登记同一社区到两个 Wrapper，Agent Nutbox 代币费默认 0。普通 Wrapper 的原费率不变。

费用查询保持同一固定区块 Multicall，校验目标 Helper 版本和默认奖励池数量，失败时不降级为独立 RPC。地址/版本不一致（例如仍覆盖旧 V2 地址）会明确拒绝继续。

部署新的 UI 构建；如构建环境设置了 `VITE_BSC_IMPORT_HELPER`，将其改为 V3 地址或删除覆盖项。旧 V2 已不再是普通 Wrapper registrar，新创建会回滚。创建回执与待提交注册记录仍应保留，通过 API 历史 Helper 白名单核验，不重发创建交易。此次不改变交易用 Wrapper 地址，也未迁移历史社区或开启 Agent Nutbox 费。

验证：`node --test scripts/test-import-helper-v2.mjs`，覆盖真实 viem 编码的 Multicall 目标/完整子调用/固定区块、BSC V3 成功、RH V2 成功、版本交叉错误和子调用失败拒绝。
