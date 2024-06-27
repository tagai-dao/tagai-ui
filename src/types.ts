export enum GlobalModalType {
  CreateCoin,
  CreateTweet ,
  CreateTweetSpace
}

export type Tweet = {
  tweetId?: string,
  supply?: number,
  bitip?: number,
  content?: string,
  pageInfo?: string,
  retweetInfo?: string,
  retweetId?: string,
  tags?: string,
  postTime?: string,
  commentCount?: number,
  likeCount?: number,
  retweetCount?: number,
  quoteCount?: number,
  buyCount?: number,
  liked?: boolean,
  commented?: boolean,
  twitterId?: string,
  btcAddress?: string,
  ethAddress?: string,
  steemId?: string,
  twitterName?: string,
  twitterUsername?: string,
  profile?: string,
  commerceId?: string,
  assetType?: string,
  asset?: string,
  goods?: any
}

export type IPShareHolder = {
  assetId?: bigint | string,
  holder?: string,
  amount?: bigint | string,
  supply?: bigint | string | number,
}

export type IPShare = {
  assetId?: bigint | string,
  assetType?: bigint | string | number,
  ownerBtc?: string,
  ownerEth?: string,
  insId?: bigint | string | number,
  supply?: bigint | string | number,
  l1Address?: string,
  l2Address?: string,
  price?: number,
  formatPrice?: string,
  feeAmount?: string | bigint,
  createAtBlock?: number,
  createTime?: number,
  holders?: Array<IPShareHolder>
}
