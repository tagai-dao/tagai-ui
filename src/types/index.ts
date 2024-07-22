export enum GlobalModalType {
  CreateCoin,
  CreateTweet,
  CreateTweetSpace,
  Login,
  Register,
  BondEth,
  ChoseWallet
}

export enum ListType {
  Trending,
  New
}

export type IPShareHolder = {
  assetId?: bigint | string;
  holder?: string;
  amount?: bigint | string;
  supply?: bigint | string | number;
};

export type IPShare = {
  assetId?: bigint | string;
  assetType?: bigint | string | number;
  ownerBtc?: string;
  ownerEth?: string;
  insId?: bigint | string | number;
  supply?: bigint | string | number;
  l1Address?: string;
  l2Address?: string;
  price?: number;
  formatPrice?: string;
  feeAmount?: string | bigint;
  createAtBlock?: number;
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
  vp?: number;
  lastUpdateVpStamp?: number;
  op?: number;
  lastUpdateOpStamp?: number;
};

export type Space = Account & {
  spaceId?: string;
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

export type Commerce = Account & {
  commerceId?: string;
  token?: string;
  buyCount?: number;
  feeAmount?: number;
};

export type Tweet = OnchainTokenInfo & Space &
  Curation &
  Commerce & {
    tweetId: string;
    content: string;
    tags?: string | undefined | null;
    pageInfo?: string | undefined | null;
    retweetInfo?: string | undefined | null;
    onchainSteemId?: string | undefined | null;
    retweetId?: string | undefined | null;
    spaceId?: string | undefined | null;
    tweetTime?: string | number | Date;
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
  };

export type Comment = {
  replyId?: string;
  parentId?: string;
  steemId?: string;
  content?: string;
  supply?: number;
  commentTime?: string;
  twitterId?: string;
  btcAddr?: string;
  ethAddr?: string;
  assetId?: string;
  twitterName?: string;
  twitterUsername?: string;
  profile?: string;
};

export type OnchainTokenInfo = {
  marketCap?: number;
  listed?: boolean;
  bondingCurveSupply?: number;
  totalClaimedSocialRewards?: number;
  price?: number
}

export type Community = OnchainTokenInfo & {
  name: string;
  description: string;
  logo: string;
  creator: string; // ethAddr
  tick: string;
  token: string;
  tags?: string | string[];
  twitter?: string | undefined | null;
  telegram?: string | undefined | null;
  official?: string | undefined | null;
  createAt?: string | number | null | undefined;
};

export type CreateCommunity = {
  desc: string,
  logoUrl: string,
  tick: string,
  token: string,
  createHash?: string,
  twitterId?: string,
  twitter?: string,
  sendPubKey?: string,
  sendNonce?: string,
  pwd?: string,
  salt?: string,
  tags?: Array<string>,
  identityInfo?: string,
  ethAddr?: string,
  initAmount?: bigint // this is token amount
  initBtc?: bigint // this is btc amount
}

export type TokenHoldingList = {
  community: Community,
  ethAddr: string,
  amount: number
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
