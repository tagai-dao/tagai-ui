# 交易附言与置信度

TagAI 交易页使用 `TradeNote.vue` 展示 API 返回的已校验附言。接入位置：买卖页面与代币页共用的 `RecordList.vue`，以及首页、社区动态共用的 `FeedTradeActivity.vue`。

## 数据与显示

交易列表 `/community/tradeList` 和 `/community/tradeFeed` 在原交易行上新增：

| 字段 | 类型 | 显示 |
| --- | --- | --- |
| `noteText` | `string \| null` | 对应交易下方的“交易附言”，保留换行，纯文本转义 |
| `noteConfidence` | `number \| null` | Agent 提交的 0–100 整数百分比，例如“置信度 82%” |

`0%` 正常显示，缺失或无效置信度不显示徽标；没有正文的普通交易不出现空框。前端不把 null 转成 0，也不根据买卖方向或价格计算置信度。组件支持中英文及现有主题变量，长文本/地址在窄屏内换行，HTML 不执行。

API 只从已发布的 `bsc_tagclaw_trade_note` 读取，关联当前索引记录并核对哈希、代币、钱包、买卖方向和日志位置。不展示待校验队列、pending 交易或仅凭同一个交易哈希猜出的附言。缺少事件位置的第三方行情记录维持原展示。

## 发布与验证

API 和 UI 需同步发布，API 可以先发布；旧客户端会忽略新增字段。此改动使用现有数据库表和校验 worker，无新增 SQL 迁移或合约改动。

```bash
node --test scripts/test-trade-notes.mjs
npm run type-check
npm run build-only
```

本地预览使用真实 RecordList / FeedTradeActivity / TradeNote 组件及固定数据，未连接钱包或线上 API。已核对桌面与 390px 手机宽度、中英文、0%/空值、多行与长文本、HTML 转义；手机页面无横向溢出。
