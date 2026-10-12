# RH ImportHelperV2 前端接入

2026-10-12：本地完成，前端部署与真实钱包验收待操作员执行。

RH 使用新 Helper `0x70eD7C79d80dEDE1828a09B3c526df283111Cb82`；Wrapper 保持原地址。
与 BSC 使用相同 `createCommunityAndPool(token,address(0))`，默认奖励池取链上配置。
导入不创建/检查 IPShare、不收 IPShare 创建费；交易佣金仍由既有 Wrapper 按已部署规则分配，
无 IPShare 时直接支付部署者地址。

费用由 `readImportFee` 使用链上 Multicall3 在一个固定区块读取 Committee 两项费用、VERSION、
defaultPoolCount。总额 = 社区创建费 + 设置费 * 默认池数量，池数严格限定 1–6。
BSC/RH 均采用此路径；必需调用失败立即拒绝，不改为独立 RPC。
已有历史 Helper 路径保留；历史 importerOf/IPShare 读取也使用固定回执区块 Multicall。
导入前与钱包写入前检查 chain/account 是否变化；回执固定到原链客户端，只解析目标 Helper 的事件，
核对 success、token、creator。原有交易成功后 API 重试/草稿恢复保留。

4 项测试检查真实 eth_call 的 Multicall3 目标、子调用顺序、地址、固定块、失败行为及 RH selector。
类型检查与生产构建通过。部署顺序：索引 -> MySQL v47 -> server/reward worker -> API -> UI。
上线验收应使用无 IPShare 账户真实导入，确认默认 TradeCuration 社区、注册重试、买卖和奖励闭环。
未执行真实钱包导入或替操作员部署。
