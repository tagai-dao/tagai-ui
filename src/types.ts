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
