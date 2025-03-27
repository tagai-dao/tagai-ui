export enum GlobalModalType {
  CreateCoin,
  CreateTweet,
  CreateTweetSpace,
  CreateIPShare,
  Login,
  Register,
  BondEth,
  ChoseWallet,
  ModifyCoin
}

export enum ListType {
  MarketCap,
  Trending,
  New
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

export type Account = {
  twitterId: string;
  twitterName: string;
  twitterUsername: string;
  profile: string;
  followers: number;
  followings: number;
  accessToken?: string;
  expiresAt?: string | number;
  btcAddr?: string | null | undefined;
  ethAddr?: string | null | undefined;
  steemId?: string | null | undefined;
  authLike?: boolean;
  authPost?: boolean;
  lastReadMessageTime?: string,
  vp?: number;
  lastUpdateVpStamp?: number;
  op?: number;
  lastUpdateOpStamp?: number;
  fid?: string | null | undefined;
  isAuthFarcaster?: boolean;
  farcasterName?: string | null | undefined
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
  version?: number | null | undefined
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
  token?: string,
  marketCap?: number;
  listed?: boolean;
  bondingCurveSupply?: number;
  totalClaimedSocialRewards?: number;
  price?: number;
  pair?: string;
  listedDayNumber?: number | null | undefined;
  distributionEnded?: boolean | null | undefined;
}

export type Community = OnchainTokenInfo & {
  name: string;
  description: string;
  logo: string;
  creator: string; // ethAddr
  tags?: string | string[];
  token: string,
  version?: number | null | undefined,
  tick: string,
  twitter?: string | undefined | null;
  telegram?: string | undefined | null;
  official?: string | undefined | null;
  createAt?: string | number | null | undefined;
  createdByAi?: number | null | undefined;
  distribution: string;
  isImport?: boolean;
  deboxConversationId?: string;
};

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
}

export type TokenHoldingList = {
  community: Community,
  ethAddr: string,
  amount: number,
  followers?: number | null | undefined,
  followings?: number | null | undefined,
  profile?: string | null | undefined,
  twitterId?: string | null | undefined,
  twitterName?: string | null | undefined,
  twitterUsername?: string | null | undefined,
  steemId?: string | null | undefined,
}

export type CommunityCredit = {
  credit: number,
  ethAddr: string,
  followers?: number | null | undefined,
  followings?: number | null | undefined,
  profile?: string | null | undefined,
  twitterId?: string | null | undefined,
  twitterName?: string | null | undefined,
  twitterUsername?: string | null | undefined,
}

export type TokenTrade = {
  tick: string,
  trader: string,
  amount: string,
  timestamp: number | string | Date,
  ethAmount: string,
  isBuy: boolean
}

export enum WalletType {
  Okx,
  Unisat,
}

export enum ConnectState {
  Disconnect,
  WrongAddress
}
