export enum GlobalModalType {
  CreateCoin,
  CreateTweet,
  CreateTweetSpace,
  CreateIPShare,
  CreatePredict,
  Login,
  Register,
  BondEth,
  ChoseWallet,
  ModifyCoin,
  CreateUserInfo,
  PredictTrade,
  PredictLiquidity
}

export enum ListType {
  MarketCap,
  Trending,
  New
}

export enum MindShareType {
  User,
  Project
}

export enum PredictSortType {
  All = 0,
  Online = 1,
  Ended = 2
}

export enum PredictType {
  Battle = 'battle',
  Event = 'event'
}

export enum TwitterTipStatus {
  Pending,
  Success,
  Fail
}

export enum TwitterTipClaimStatus {
  NoNeedClaim,
  PendingClaim,
  ClaimSuccess
}

export enum TwitterTipErrorType {
  Success,
  ExceedMaxPerTx,
  ExceedMaxPerDay,
  InsufficientFee,
  InsufficientAllowance,
  InsufficientBalance,
  NotBoundSocialAddress,
  Closed
}

export type IPShareHolder = {
  ethAddr?: string;
  holder?: string;
  amount?: bigint | string | number;
  shareSupply?: bigint | string | number;
};

export type IPShare = {
  ethAddr?: string;
  shareSupply?: bigint | string | number;
  created?: boolean,
  price?: number;
  formatPrice?: string;
  holdersCount?: number;
  holdingsCount?: number;
  stakedCount?: number,
  feeAmount?: number | bigint | string,
  totalCaptured?: string | bigint | number,
  totalStaked?: string | bigint | number,
  createTime?: number;
  holders?: Array<IPShareHolder>;
};

export type MyHolding = {
  ipshare?: IPShare;
  amount?: bigint | string;
  staked?: bigint | string;
};

export type Trade = {
  transHash?: string;
  trader?: string;
  assetId?: string | bigint;
  assetType?: bigint | string | number;
  insId?: bigint | string | number;
  index?: string | bigint | number;
  isBuy?: boolean;
  shareAmount?: string | bigint;
  ethAmount?: string | bigint;
  time?: number;
  block?: number;
};

export type FeedTrade = {
  timestamp: string | number;
  tick: string;
  token: string;
  name?: string;
  logo?: string;
  amount: string | number;
  ethAmount: string | number;
  isBuy: boolean | number;
  trader: string;
  transHash: string;
  twitterId: string;
  twitterName: string;
  twitterUsername: string;
  profile?: string;
  marketCap?: string | number;
  price?: number;
  priceChange24h?: number | null;
  isImport?: boolean | number;
  version?: number;
  pair?: string;
  dexVersion?: number;
  accountSources?: string[] | string | null;
  accountType?: number | null;
  walletType?: number | null;
}

/** Feed 代币详情 Bottom Sheet 使用的统一展示模型。 */
export type FeedTokenSheetAsset = {
  tick: string;
  token: string;
  name?: string;
  logo?: string;
  price?: number;
  marketCap?: number | string;
  priceChange24h?: number | null;
  sparkline24h?: number[] | null;
  listed?: boolean;
  isImport?: boolean | number;
  version?: number;
  pair?: string;
  dexVersion?: number;
  creatorName?: string;
  creatorUsername?: string;
  creatorProfile?: string;
  sellsman?: string;
}

export type Account = {
  twitterId: string;
  twitterName: string;
  twitterUsername: string;
  twitterReputation?: number;
  profile: string;
  followers: number;
  followings: number;
  accessToken?: string;
  expiresAt?: string | number;
  btcAddr?: string | null | undefined;
  ethAddr?: string | null | undefined;
  steemId?: string | null | undefined;
  inSteemWhiteList?: number | null | undefined;
  authLike?: boolean;
  authPost?: boolean;
  lastReadMessageTime?: string,
  vp?: number;
  lastUpdateVpStamp?: number;
  op?: number;
  lastUpdateOpStamp?: number;
  fid?: string | null | undefined;
  isAuthFarcaster?: boolean;
  farcasterName?: string | null | undefined;
  credit?: number;
  creditFactor?: string | null | undefined;
  walletType?: number | null | undefined; // 0: metamask, 1: privy
  accountType?: number | null | undefined; // 0: twitter, 1: email
  accountSources?: string[] | string | null;
  isNew?: number | null | undefined; // 0: old, 1: new register
  ipShare?: string | null | undefined;
};

export type FarcasterUser = {
  ethAddr: string,
  fid: string,
  signerUuid?: string,
  name?: string,
  avatar?: string,
  username?: string,
}

export type SocialMessage = {
  tweetId: string;
  twitterId: string;
  twitterName: string;
  twitterUsername: string;
  profile: string;
  type: number;
  content: string;
  operateTime: string;
}

export type Space = Account & {
  spaceId?: string;
  tweetId?: string;
  title?: string;
  logo?: string;
  tick?: string;
  hostIds?: string | undefined | null;
  speakerIds?: string | undefined | null;
  state?: number | undefined | null;
  startedAt?: string | number | Date | undefined | null;
  endedAt?: string | number | Date | undefined | null;
  scheduledStart?: string | number | Date | undefined | null;
  participantCount?: number;
};

export type Curation = Account & {
  tweetId: string;
  amount?: number;
  authorAmount?: number;
  curateAmount?: number;
  hostAmount?: number;
  cohostAmount?: number;
  speakerAmount?: number;
  isSettled?: boolean;
  dayNumber?: number;
};

export type CurationReward = {
  logo: string,
  tick: string,
  token: string,
  amount: number,
  price: number,
  version?: number | null | undefined,
  socialPoolAddress?: string,
}

export type Commerce = Account & {
  commerceId?: string;
  token?: string;
  buyCount?: number;
  feeAmount?: number;
};

export type Tweet = OnchainTokenInfo & Space &
  Curation & ClankerToken &
  Commerce & {
    tweetId: string;
    content: string;
    tags?: string | undefined | null;
    videoLink?: string | undefined | null;
    pageInfo?: string | undefined | null;
    retweetInfo?: string | undefined | null;
    onchainSteemId?: string | undefined | null;
    retweetId?: string | undefined | null;
    spaceId?: string | undefined | null;
    tweetTime?: string | number | Date;
    version?: number | null | undefined;
    tick?: string;
    likeCount: number;
    retweetCount: number;
    replyCount: number;
    quoteCount: number;
    dayNumber: number;
    quoted?: number;
    retweeted?: number;
    replied?: number;
    liked?: number;
    curated?: number;
    curateCount?: number;
    spaceCurateCount?: number;
    credit?: number;
    isDeployTweet?: number;
    externalSource?: 'gmgn' | 'fomo' | 'pump';
    externalContentType?: 'x_callout' | 'native_callout';
    originalXTweetId?: string;
    sourceUrl?: string;
    discoveredSources?: string;
    mirrorClaimStatus?: 'unclaimed' | 'claimed';
    rewardEligible?: boolean | number;
  };

export type CurateRecord = Account & {
  tweetId: string,
  curateRecord: number,
  amount: number,
  hostAmount?: number,
  cohostAmount?: number,
  speakerAmount?: number,
  speakerTime?: number,
  createAt: string,
  curationVp?: number,
  replyVp?: number
}

export type Reply = {
  replyId?: string;
  parentId?: string;
  steemId?: string;
  content?: string;
  supply?: number;
  operateTime?: string;
  twitterId?: string;
  btcAddr?: string;
  ethAddr?: string;
  assetId?: string;
  twitterName?: string;
  twitterUsername?: string;
  profile?: string;
};

export type OnchainTokenInfo = {
  tick?: string,
  token: string,
  /** EVM chain ID returned by chain-scoped API instances. */
  chainId?: number | null;
  /** Legacy database-shaped chain ID. */
  chain_id?: number | null;
  marketCap?: number;
  /** 24h 涨跌百分比（来自 list 接口缓存）；null = 新币不足 24h，undefined = 后端未提供 */
  priceChange24h?: number | null;
  /** 24h 小时级收盘价数组（时间升序，≤25 点），供卡片 sparkline */
  sparkline24h?: number[] | null;
  /** 持有人数（NodeReal 聚合，5 分钟刷新）；null/undefined 时不显示 */
  holderCount?: number | null;
  listed?: boolean;
  bondingCurveSupply?: number;
  totalSupply?: number;
  totalClaimedSocialRewards?: number;
  isImport?: boolean;
  price?: number;
  pair?: string;
  listedDayNumber?: number | null | undefined;
  distributionEnded?: boolean | null | undefined;
  dexVersion?: number | null | undefined;
}

export type Community = OnchainTokenInfo & {
  name: string;
  description: string;
  logo: string;
  creator: string; // ethAddr, can be tagai deployer if the token deployed by tagai
  ipshare?: string | null; // ethAddr, can be null if the token deployer does not create ipshare
  tags?: string | string[];
  version?: number | null | undefined,
  tick: string,
  twitter?: string | undefined | null;
  telegram?: string | undefined | null;
  official?: string | undefined | null;
  createAt?: string | number | null | undefined;
  createdByAi?: number | null | undefined;
  distribution: string;
  creditPolicy?: string;
  predictionCreditPolicy?: string;
  deboxConversationId?: string;
  feePath?: string | object | null | undefined,
  communityAddress?: string;  // v10: Nutbox Community 合约地址
  socialPoolAddress?: string; // v10: SocialCuration Pool 地址
};

export type CommunityMember = {
  twitterId: string,
  communityId: string,
  predictVP: number,
  lastUpdateVPStamp: number
}

export type ClankerToken = OnchainTokenInfo & {
  logo?: string,
  name?: string,
  pool?: string,
  totalSupply?: number
}

export type CreateCommunity = {
  desc: string,
  logoUrl: string,
  tick: string,
  token: string,
  pair?: string,
  decimals?: number,
  createHash?: string,
  twitterId?: string,
  twitter?: string,
  telegram?: string,
  docs?: string,
  sendPubKey?: string,
  sendNonce?: string,
  pwd?: string,
  salt?: string,
  tags?: Array<string>,
  identityInfo?: string,
  ethAddr?: string,
  initAmount?: bigint // this is token amount
  initEth?: bigint // this is eth amount
  distributionPeriod?: '1week' | '1month' | '1year', // 分发策略时间周期
  distributionAmount?: number, // 分发策略代币数量
  transferHash?: string,
  infoStr?: string,
  signature?: string,
  dexVersion?: number,
  communityAddress?: string,  // Nutbox Community 地址（V10 导入代币）
  socialPoolAddress?: string, // SocialCuration Pool 地址（V10 导入代币）
  version?: number, // 新建代币的 Pump 版本；导入流程由 API 固定为 V10
}

export type TokenHoldingList = {
  community: Community,
  ethAddr: string,
  amount: number | bigint,
  followers?: number | null | undefined,
  followings?: number | null | undefined,
  profile?: string | null | undefined,
  twitterId?: string | null | undefined,
  twitterName?: string | null | undefined,
  twitterUsername?: string | null | undefined,
  steemId?: string | null | undefined,
  price?: number | null | undefined,
  accountSources?: string[] | string | null,
  accountType?: number | null,
  walletType?: number | null,
}

export type CommunityCredit = {
  credit: number,
  ethAddr: string,
  accountSources?: string[] | string,
  tokenBalance?: number,
  ipShareMarketCap?: number,
  twitterReputation?: number | null,
  followers?: number | null | undefined,
  followings?: number | null | undefined,
  profile?: string | null | undefined,
  twitterId?: string | null | undefined,
  twitterName?: string | null | undefined,
  twitterUsername?: string | null | undefined,
  creditFactor?: string | null | undefined,
}

export type TokenTrade = {
  tick: string,
  trader: string,
  username?: string | null,
  twitterId?: string | null,
  twitterName?: string | null,
  twitterUsername?: string | null,
  profile?: string | null,
  amount: string,
  timestamp: number | string | Date,
  ethAmount: string,
  isBuy: boolean,
  quoteToken?: string,
  quoteSymbol?: string,
  accountSources?: string[] | string | null,
  accountType?: number | null,
  walletType?: number | null,
}

export type SocialAccountTokens = {
  token: string,
  tick: string,
  logo: string,
  maxPerTx: number,
  maxPerDay: number,
  spentToday: number,
  lastUpdatedDay: number,
  allowance: number,
  balance: number
}

export type PendingClaimToken = {
  token: string,
  amount: number,
  logo: string,
  tick: string
}

export type TwitterTipRecord = {
  fromTwitterId: string,
  fromTwitterName: string,
  fromTwitterUsername: string,
  fromProfile: string,
  fromFollowers: number,
  fromFollowings: number,
  fromEthAddr: string,
  toTwitterId: string,
  toTwitterName: string,
  toTwitterUsername: string,
  toProfile: string,
  toFollowers: number,
  toFollowings: number,
  toEthAddr: string,
  tick: string,
  token: string,
  transHash: string,
  tweetId: string,
  amount: number,
  status: TwitterTipStatus, // 0:pending,1.success, 2.fail
  claimStatus: TwitterTipClaimStatus, // 0,无须cliam， 1，待claim， 2.claim成功
  time: string,
  errorType: TwitterTipErrorType
}

export enum WalletType {
  Okx,
  Unisat,
}

export enum ConnectState {
  Disconnect,
  WrongAddress
}

export type IpShareUser = {
  twitterId: string,
  btcAddr: string | null,
  ethAddr: string | null,
  steemId: string | null,
  twitterName: string,
  twitterUsername: string,
  profile: string
  followers: number
  followings: number
  lastReadMessageTime: string
  supply: number,
  price?: number | null | undefined,
}

export type CommunityMiniTag = {
  id: number,
  name: string,
  type: number,
  tick: string,
  tag: string
}

export type MindShare = Account & {
  dayNumber: number,
  mindSharePercent: number, // 最近一天的mindshare
  percents: number[],        // 最近7天的mindshare
  delta24h: number,
  delta7d: number,
  chart: Array<{
    date: Date,
    value: number
  }>
}

export type BattleData = {
  chainId?: number | null,
  marketMaker: string,
  tick: string,
  token: string,
  reserveA: number | undefined | null,
  reserveB: number | undefined | null,
  amounta: number | undefined | null,  // community members vote volume by prediction credit
  amountb: number | undefined | null,
  solvedBalances: Array<number> | undefined | null,
  title: string,
  predictAID: string,
  predictBID: string,
  winner: 'left' | 'right' | null,
  questionId: string,
  status: number,
  positionAID: string,
  positionBID: string,
  conditionID: string,
  fee: number | undefined | null,  // 当前费率
  /** 累计交易社区代币数量（swap+LP，由 graph 同步写入 DB） */
  tradeVolume?: number | null,
}

export type EventPredictOutcome = {
  outcomeIndex: number
  label: string
  positionId?: string
  voteTotal?: number
}

export type EventPredictData = Tweet & {
  marketMaker: string,
  tick: string,
  token: string,
  reserveA: number | undefined | null,
  reserveB: number | undefined | null,
  /** Event V2：各 outcome 池子储备（与 outcomes 顺序一致） */
  outcomeReserves?: number[]
  /** 交易结束（end_time）时刻各 outcome FPMM 边际概率快照 */
  endOutcomePercents?: number[]
  /** 交易结束时刻各 outcome 池子储备快照（可选） */
  endOutcomeReserves?: number[]
  voteYes: number | undefined | null,  // community members vote volume by prediction credit
  voteNo: number | undefined | null,
  solvedBalances: Array<number> | undefined | null,
  voteResult?: number | undefined | null,
  /** Event V2 用户已投 outcome（0-based） */
  voteOutcomeIndex?: number | null,
  title: string,
  winner: 'yes' | 'no' | null,
  questionId: string,
  status: number,
  endTime: number,
  positionAID: string,
  positionBID: string,
  conditionID: string,
  fee: number | undefined | null,  // 当前费率
  factoryVersion?: number,
  outcomeCount?: number,
  outcomes?: EventPredictOutcome[],
  /** 赛事标签: 2026FWC-KO-R32, 2026FWC-Champion 等 */
  eventTag?: string | null,
  /** 累计交易社区代币数量（swap+LP，由 graph 同步写入 DB） */
  tradeVolume?: number | null,
}

export type MarketData = {
  battle: BattleData,
  tweets: { [key: string]: Tweet }
}

export type FPMMLPTRADE = {
  ethAddr: string,
  fpmm: string,
  amounts: Array<number> | string,
  collateralRemoved: number
}

export type FPMMTrade = FPMMLPTRADE & {
  ethAddr: string,
  fpmm: string,
  outcomeIndex: number,
  amount: number,
  outcomeTokensAmount: number,
  isBuy: number,
  transTime: number,
  transHash: string,
  twitterId: string,
  twitterName: string,
  twitterUsername: string,
  profile: string,
  followers: number,
  followings: number,
  opType: number,  // 1: 交易记录， 2: 流动性记录
}

export type FPMMUserHolding = {
  ethAddr: string,
  balance: number,
  twitterId: string,
  twitterName: string,
  twitterUsername: string,
  profile: string,
  followers: number,
  followings: number
}

export type KlineData = {
  fpmm: string,
  timestamp: number,
  high: number,
  low: number,
  open: number,
  close: number,
  volume?: number,
  outcomeIndex?: number,
}
