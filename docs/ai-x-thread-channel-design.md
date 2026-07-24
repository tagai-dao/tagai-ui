# X Thread as AI Channel

Status: implemented. The companion API shipped in tagai-api (#63); database
migration is applied there. Real-data integration follows the API deployment.

## Goal

Turn an X thread involving a community's Tag Agent into a Slack-like channel in
the community AI tab:

- The left pane lists channels.
- The right pane presents the root X post and the related conversation.
- Signed-in users can reply to the latest channel message on Steem.
- Signed-in users can quote an X post from the feed into an existing channel and
  publish their comment on Steem.

This design applies to both BNB Chain and Robinhood communities. Channel data is
global social data and must not be duplicated per chain.

## Channel identity and qualification

The recommended channel identity is:

```text
(tick, rootTweetId)
```

`rootTweetId` is the root post of the X conversation.

A channel becomes visible only after both conditions are met:

1. A descendant of the root post mentions the community Tag Agent.
2. That Tag Agent has replied inside the same X thread.

Additional users mentioning the Agent, and additional Agent replies, do not create
new channels for the same root post. A mention without an Agent reply does not
qualify as a channel.

Mention matching uses the X username grammar `[A-Za-z0-9_]{1,15}` and requires
non-username boundaries on both sides of `@username`. The SQL materializer and
the JavaScript timeline filter use the same rule, so values such as
`email@TagAgentX` and `@TagAgentX_extra` do not qualify.

If more than one active Tag Agent qualifies in the same root thread, ownership is
assigned deterministically to the Agent with the earliest reply. Equal timestamps
are resolved by reply record ID and then Agent Twitter ID. Re-running
materialization therefore does not depend on database row iteration order.

The community `tick` is globally unique. The channel identity therefore does not
include an EVM chain ID.

## Included messages

The timeline must not include every unrelated reply under the X root post. It
contains only:

1. The root X post.
2. Posts that mention the community Tag Agent.
3. Replies from that Tag Agent.
4. Ancestors required to preserve the reply context for those posts.
5. Replies published from the TagAI channel to Steem.
6. X posts referenced by those Steem replies.

Messages are deduplicated by their source identity:

```text
X post:       x:{tweetId}
Steem reply:  steem:{author}/{permlink}
```

The right pane renders the resulting set in chronological order. Direct reply and
quote relationships are shown as lightweight context labels, such as `Replying to
@user` and `Quoted from X`, rather than as a deeply nested tree.

## Desktop layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ AI Channels                                                          │
├──────────────────────┬───────────────────────────────────────────────┤
│ Channel list         │ # Channel summary                  Open in X  │
│                      ├───────────────────────────────────────────────┤
│ Search channels      │ Root topic                                    │
│                      │ ┌───────────────────────────────────────────┐ │
│ AI market outlook    │ │ Author · @username · time                 │ │
│ 12 messages · 2m     │ │ Root X post, media and links              │ │
│                      │ └───────────────────────────────────────────┘ │
│ Robinhood launch     │                                               │
│ 8 messages · 1h      │ User B · mentions @TagAgentX                  │
│                      │   Agent reply                                 │
│ Uniswap V4           │                                               │
│ 5 messages · 1d      │ User D · mentions @TagAgentX                  │
│                      │   Agent reply                                 │
│                      │                                               │
│                      │ Signed-in user · Steem reply                  │
│                      ├───────────────────────────────────────────────┤
│                      │ Replying to latest message                    │
│                      │ [Optional quoted X post]                      │
│                      │ [Write a reply…                        Send]  │
└──────────────────────┴───────────────────────────────────────────────┘
```

Recommended behavior:

- Channel list width: 280-320 px; the detail pane consumes the remaining width.
- The root post stays at the top and may collapse to a compact header after scroll.
- The message timeline scrolls independently.
- The composer stays at the bottom of the detail pane.
- The old desktop AI sidebar remains hidden while the AI tab is active, preventing
  duplicate Agent content.

## Channel list summary

The Tag Agent summarizes only the root X post, so the channel label remains stable
as replies arrive.

- Chinese target: 20-40 characters.
- English target: 60-100 characters.
- Preserve the root post language.
- On generation failure, use the first 80 characters of the root post.
- Generate once when the channel qualifies; retry failed summaries asynchronously.
- Sort channels by `lastActivityAt` descending.

Each row shows the summary, root author, message count, and last activity time.
Search and unread state can be added after the initial release.

The list endpoint is read-only. Qualification/materialization and summary
generation run from the low-frequency `ai-channel:refresh:*` commands, not from a
page request. A summary claim left in `processing` for more than 15 minutes is
eligible for recovery by the next refresh run.

`messageCount` means the root plus exact Agent mentions, replies by the owning
Agent, and replies created from the TagAI channel. Context-only ancestors may be
rendered in the detail timeline but do not increase this count.

The UI loads the first page (default 30 channels) and fetches further pages on
demand with the opaque `nextCursor`. Client-side search filters only the loaded
pages. A deep link whose `channel` id is not in the loaded pages is resolved by
fetching the messages endpoint directly and building the detail-pane header from
its `channel` payload, so shared links keep working for older channels.

## Reply composer

Replies from this UI publish to Steem only; they do not automatically publish to X.
The composer must make this explicit with a `Publishing to Steem` label.

Requirements:

- The user must be signed in and have a Steem account.
- OP is global and must not be calculated per EVM chain.
- Suggested maximum length: 2,000 characters.
- The composer keeps the draft on failure so the user can retry. One draft uses
  one idempotency key: the key is generated on the first submit attempt, reused
  by every retry of that draft, and discarded after a successful send or a
  channel switch. A retry can therefore never create a duplicate reply.
- After a successful POST the timeline reloads; the new Steem reply renders with
  its server-reported `publishState` (publishing / confirmed / failed).

The API receives `expectedLatestMessageId`. If a new message arrives between load
and submit, it returns `409 CHANNEL_UPDATED`. The UI refreshes the timeline and
asks the user to review the new messages before sending. This prevents a reply
from silently attaching to an unexpected parent.

## Quote an X post into a channel

The existing quote action keeps its current behavior. Add an explicit action:

```text
More → Quote to AI Channel
```

Flow:

1. Select an X post from the home or community feed.
2. Choose `Quote to AI Channel`.
3. Select an existing channel scoped to the current community.
4. Show the selected X post as a removable card above the composer.
5. Publish the user's comment as a Steem reply to the latest channel message.
6. Persist the referenced X post as structured data, not only as text.

The channel composer may also offer an `Add X post` action for selecting from the
recent feed.

## Responsive behavior

Desktop uses the two-pane layout. Mobile uses two navigation levels:

1. The AI tab initially shows the channel list.
2. Selecting a channel opens a full-screen channel detail.
3. Back returns to the list.
4. The composer respects the PWA keyboard and safe-area insets.

Deep-link state is stored in the URL:

```text
/tag-detail/BUIDL?tab=ai
/tag-detail/BUIDL?tab=ai&channel=123
```

## Data model

The existing `ai_reply_thread` table already identifies a root X post and Agent,
and the reply relation stores both the root and direct parent IDs. Do not overload
the existing thread scheduler status as a product-facing channel state. Add a
separate global registry:

```text
ai_channel
- id
- tick
- root_tweet_id
- agent_twitter_id
- chain_id (source-table routing attribute; not part of channel identity)
- summary
- summary_status
- last_message_id
- last_activity_at
- message_count
- created_at
- updated_at

UNIQUE (tick, root_tweet_id)
```

Store Steem publication, idempotency, direct-parent, and optional X-reference
metadata separately. The reply body remains in the existing relation table:

```text
ai_channel_reply_meta
- id
- channel_id
- reply_id
- twitter_id
- parent_message_id
- quoted_tweet_id
- idempotency_key
- publish_state
- publish_error
- created_at

UNIQUE (reply_id)
UNIQUE (twitter_id, idempotency_key)
```

Tweet and reply bodies remain in their existing source tables. The API normalizes
them into:

```ts
type ChannelMessage = {
  id: string
  channelId: number
  source: 'x' | 'steem'
  type: 'root' | 'mention' | 'agent_reply' | 'user_reply'
  parentId?: string
  author: AccountSummary
  content: string
  createdAt: string
  quotedTweet?: TweetSummary
  publishState?: 0 | 1 | 2 // Steem replies: 0 publishing, 1 confirmed, 2 failed
}
```

## API contract

Add global social endpoints:

```text
GET  /ai/channels?tick=BUIDL&cursor=&limit=30
GET  /ai/channels/:channelId/messages
POST /ai/channels/:channelId/replies
```

The list response is:

```json
{
  "items": [],
  "nextCursor": "opaque-base64url-cursor-or-null"
}
```

The opaque cursor contains both `lastActivityAt` and `id`, matching the database
order `last_activity_at DESC, id DESC`. Clients must return it unchanged.

Reply body:

```json
{
  "content": "My reply",
  "expectedLatestMessageId": "x:123456",
  "quotedTweetId": "987654",
  "idempotencyKey": "uuid"
}
```

The reply middleware verifies that the supplied Twitter user ID matches the
authenticated access token before the service consumes OP or writes a reply.

Use global social cache keys, for example:

```text
tagai-social:ai-channel:list:{tick}
```

Do not use BSC- or Robinhood-specific business cache prefixes for channel data.
Only list pages are cached. Non-first cursor/limit variants rely on the short
15-second TTL; the common first page is also invalidated after a UI reply.

## Delivery plan

1. Add the channel registry, qualification/materialization logic, historical
   backfill, and read APIs.
2. Build the read-only desktop two-pane UI and mobile navigation.
3. Add Steem replies, OP checks, optimistic status, idempotency, and concurrency
   handling.
4. Add `Quote to AI Channel` and structured X references.
5. Add search, unread state, real-time refresh, and summary administration.

Database migrations must be reviewed separately before execution.

## Acceptance cases

1. B mentions the Agent in A's thread and the Agent replies: one channel appears.
2. B and D both mention the Agent and the Agent replies to both: still one channel.
3. A mention exists but the Agent has not replied: no channel appears.
4. Unrelated replies under A's post are excluded.
5. Root, mentions, required ancestors, Agent replies, and Steem replies appear once
   in chronological order.
6. A stale composer cannot silently reply to an outdated latest message.
7. Quoting an X post creates a structured attachment on the Steem reply.
8. Switching between BNB Chain and Robinhood does not duplicate or hide a channel.
9. Global login, Steem identity, and OP behavior remain the same on both chains.
