# 交易附言与置信度

TagAI 交易页使用 `TradeNote.vue` 展示 API 返回的已校验附言。接入位置：买卖页面与代币页共用的 `RecordList.vue`，以及首页、社区动态共用的 `FeedTradeActivity.vue`。

## 数据与显示

交易列表 `/community/tradeList` 和 `/community/tradeFeed` 在原交易行上新增：

| 字段 | 类型 | 显示 |
| --- | --- | --- |
| `noteText` | `string \| null` | 对应交易下方的“交易附言”，保留换行，纯文本转义 |
| `noteConfidence` | `number \| null` | Agent 提交的 0–100 整数百分比，例如“置信度 82%” |

`0%` 正常显示，缺失或无效置信度不显示徽标。已校验的正文或置信度任一存在即可显示；两者均缺失的普通交易不出现空框。前端不把 null 转成 0，也不根据买卖方向或价格计算置信度。组件支持中英文及现有主题变量，长文本/地址在窄屏内换行，HTML 不执行。

API 只从已发布的 `bsc_tagclaw_trade_note` 读取，关联当前索引记录并核对哈希、代币、钱包、买卖方向和日志位置。不展示待校验队列、pending 交易或仅凭同一个交易哈希猜出的附言。缺少事件位置的第三方行情记录维持原展示。

## 发布与验证

API 和 UI 需同步发布，API 可以先发布；旧客户端会忽略新增字段。此改动使用现有数据库表和校验 worker，无新增 SQL 迁移或合约改动。

```bash
node --test scripts/test-trade-notes.mjs
npm run type-check
npm run build-only
```

本地预览使用真实 RecordList / FeedTradeActivity / TradeNote 组件及固定数据，未连接钱包或线上 API。已核对桌面与 390px 手机宽度、中英文、0%/空值、多行与长文本、HTML 转义；手机页面无横向溢出。

## 内盘 Agent 购买表单与完整 Prompt

V15–V18 的 BSC 内盘 Agent 指引改为购买表单。填写 BNB 金额后自动预估接收数量；置信度（0–100 整数，0 有效）与喊单内容（最多 1000 Unicode 字符 / 4000 UTF-8 bytes）独立可选。两项都空时生成普通购买提示词，不要求创建附言。

`agentCurveQuote.ts` 不读取或要求网页钱包。BNB 输入包含交易手续费，先按当前曲线买入费扣费，再向对应版本 Pump 询价，18 位小数均用 bigint。上市/待上市、未登记的代币、超单钱包购买上限或读取失败会拒绝预估。两阶段读取全部走 BSC Multicall3，固定同一区块；用户个人 Handle、余额和已买额度留给 Agent 按实际执行钱包核验。修改金额立即清除旧报价，350ms 防抖后重新请求；报价超过 30 秒则复制时刷新。

`agentTradePrompt.ts` 生成的第一行固定为“执行下面的动作：”（英文界面使用对应英文），包含 Skill、完整 CA、币名/符号、Chain ID、BNB 金额、预估数量、2% 滑点及已填写的选项。喊单和代币文本按 JSON 字符串引用，不能通过换行伪造新的交易参数。实际交易仍需要刷新报价及用户钱包确认。

从交易卡片打开时，`FeedTradeActivity → FeedTokenSheetAsset → FeedTokenTradeSheet → BuyAndSellView → AgentTradeGuide` 传递原交易哈希和 `trade.trader` 钱包。此钱包作为 IPShare 推荐主体；不使用全局 IPShare 合约、代币创建者或残留的全局 sellsman。无来源时省略推荐归属。代币/链/来源变化会清空草稿并取消过期响应，复制期间的异步报价也不能带出旧来源。

“仅填写置信度”需要配套 API 更新：允许空正文加有效置信度的 nonce/commitment，仍拒绝正文和置信度同时为空的附言申请。数据表与签名后缀格式不变，无新增迁移。

```bash
node --test scripts/test-agent-trade-prompt.mjs scripts/test-agent-trade-form.mjs \
  scripts/test-agent-trade-guide.mjs scripts/test-trade-notes.mjs scripts/test-binance-accounts.mjs
```
