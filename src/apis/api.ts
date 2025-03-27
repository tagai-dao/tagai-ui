import { get, post, put } from "./axios"
import { BACKEND_API_URL } from '@/config'
import type { Community, CreateCommunity } from '@/types'

/************************************ common **********************************/
export const getEthPrice = async () =>
  get(BACKEND_API_URL + '/tiptag/getETHPrice')

export const getUserBitip = async (btcAddress: string) =>
  get("https://api.bitip.social/inscription/listByHolder", {btcAddress})

export const uiLog = async (info: any) =>
  get(BACKEND_API_URL + '/tiptag/ui-log', info)

/************************************ twitter auth **********************************/
export const checkAccessToken = async (twitterId: string) =>
  post(BACKEND_API_URL + '/auth/checkAccessToken', {twitterId})

export const twitterRefreshAccessToken = async (twitterId: string) =>
  post(BACKEND_API_URL + '/auth/refresh', {twitterId})

export const twitterAuth = async (referee?: string | null | undefined, authLike: boolean = true, authPost: boolean = true) => 
  get(BACKEND_API_URL + '/auth/login', { referee, authLike, authPost })

export const needLogin = async (twitterId: string) =>
  post(BACKEND_API_URL + '/auth/needLogin', {twitterId})

export const twitterLogin = async (state: string) =>
  get(BACKEND_API_URL + '/user/login', { state })

export const twitterLogout = async (twitterId: string) =>
  get(BACKEND_API_URL + '/auth/logout', {twitterId})

export const registerSteem = async (params: any) => 
  post(BACKEND_API_URL + '/register', params)

export const checkRegister = async (twitterId: string) =>
  post(BACKEND_API_URL + '/register/check', { twitterId })

export const checkFarcaster = async (fid: string) =>
  get(BACKEND_API_URL + '/user/checkFarcasterUsed', { fid })

export const bondEth = async (ethAddr: string, twitterId: string, signature: string, infoStr: string) =>
  post(BACKEND_API_URL + '/user/bondEth', { ethAddr, twitterId, signature, infoStr })

/************************************ user api **********************************/
export const getUserProfile = (twitterId: string) =>
  get(BACKEND_API_URL + '/user/getUserProfile', {twitterId})

export const checkEthUsed = async (ethAddr: string) =>
  get(BACKEND_API_URL + '/user/checkEthUsed', { ethAddr })

export const checkEns = async (ethAddr: string) => 
  get(BACKEND_API_URL + '/user/getENS', {ethAddr})

export const getVPOP = async (twitterId: string) => 
  post(BACKEND_API_URL + '/user/getVPOP', {twitterId})

export const getHoldingList = async (twitterId: string, ethAddr: string, pages?: number) =>
  post(BACKEND_API_URL + '/community/holdingList', { twitterId, ethAddr, pages })

export const getNewMessageCount = async (twitterId: string, lastReadMessageTime?: string) =>
  post(BACKEND_API_URL + '/user/getNewMessageCount', { twitterId, lastReadMessageTime})

export const getMessages = async (twitterId: string) =>
  post(BACKEND_API_URL + '/user/getMessages', { twitterId })

export const readAllMessage = async (twitterId: string) =>
  post(BACKEND_API_URL + '/user/readAllMessage', {twitterId})
/************************************ tweets **********************************/
export const getCommunityNewTweets = async (tick: string, twitterId?: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/communityTweets', {tick, twitterId, pages})

export const getCommunityTippedTweets = async (tick: string, twitterId?: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/communityTippedTweets', {tick, twitterId, pages})

export const getAgentTweets = async (tick: string) =>
  get(BACKEND_API_URL + '/curation/agentTweets', {tick})

export const getUserTweets = async (twitterId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/userTweets', {twitterId, pages})

export const getUsernameTweets = async (username: string) =>
  get(BACKEND_API_URL + '/curation/usernameTweets', {username})

export const getUserBlinks = async (twitterId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/userBlinks', {twitterId, pages})

export const getTweetById = async (tweetId: string, twitterId?: string) =>
  get(BACKEND_API_URL + '/curation/getTweetById', {tweetId, twitterId})

export const getTweetBySpaceId = async (spaceId: string, twitterId?: string) =>
  get(BACKEND_API_URL + '/curation/getTweetBySpaceId', {spaceId, twitterId})

export const getReplyOfTweet = async (tweetId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/getReplyOfTweet', {tweetId, pages})

export const tweet = async (twitterId: string, text: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/tweet', {twitterId, text, tick})

export const tweetWithSpace = async (twitterId: string, text: string, tick: string, spaceId: string) =>
  post(BACKEND_API_URL + '/curation/tweetWithSpace', {twitterId, text, tick, spaceId})

export const newLike = async (twitterId: string, tweetId: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/like', {twitterId, tweetId, tick})

export const newRetweet = async (twitterId: string, tweetId: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/retweet', {twitterId, tweetId, tick})

export const newCurate = async (twitterId: string, tweetId: string, tick: string, vp: number) =>
  post(BACKEND_API_URL + '/curation/curate', {twitterId, tweetId, tick, vp})

export const newReply = async (twitterId: string, tweetId: string, text: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/reply', { twitterId, tweetId, text, tick })

export const newQuote = async (twitterId: string, tweetId: string, text: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/quote', { twitterId, tweetId, text, tick })

/************************************ community **********************************/
export const createCommunity = async (params: CreateCommunity) => 
  post(BACKEND_API_URL + '/community/createCommunity', params)

export const updateCommunityInfo = async (community: Community, twitterId: string) =>
  post(BACKEND_API_URL + '/community/updateInfo', {...community, twitterId})

export const getCommunityCredits = async (tick: string, pages?: number) =>
  get(BACKEND_API_URL + '/community/communityCredits', {tick, pages})

export const trade = async (tick: string, twitterId: string, transHash?: string, commerceId?: string, token?: string) =>
  get(BACKEND_API_URL + '/community/trade', {tick, twitterId, transHash, commerceId, token})

export const searchCommunity = async (tick: string) =>
  get(BACKEND_API_URL + '/community/search', { tick })

export const getCommunityByMarketCap = async (pages?: number) =>
  get(BACKEND_API_URL + '/community/communityByMarketCap', { pages })

export const getCommunitiesByTrending = async (pages?: number) =>
  get(BACKEND_API_URL + '/community/communitiesByTrending', { pages })

export const getCommunitiesByNew = async (pages?: number) =>
  get(BACKEND_API_URL + '/community/communitiesByNew', { pages })

export const getCommunityDetail = async (tick: string) =>
  get(BACKEND_API_URL + '/community/detail', { tick })

export const getCreatedList = async (twitterId: string, ethAddr: string) =>
  post(BACKEND_API_URL + '/community/createdList', {twitterId, ethAddr})

export const getHolderList = async (token: string, pages?: number) =>
  get(BACKEND_API_URL + '/community/holderList', { token, pages })

export const getTokenTradeList = async (token: string, pages?: number) =>
  get(BACKEND_API_URL + '/community/tradeList', { token, pages })

export const isTokenExist = async (tick: string) =>
  get(BACKEND_API_URL + '/community/isTokenExist', { tick })

export const getTokenTradeData = async (tick: string, timestamp: number | undefined, isNew: boolean) =>
  get(BACKEND_API_URL + '/community/getTokenTradeData', {tick, timestamp, isNew})

export const getConversationId = async (token: string) =>
  get(BACKEND_API_URL + '/community/getDeboxConversationIds', {token})

/************************************ commerce **********************************/
export const newCommerce = async (text: string, twitterId: string, tick: string, token: string) => 
  post(BACKEND_API_URL + '/commerce/newCommerce', {text, twitterId, tick, token})

export const redirectTweet = async (commerceId: string) =>
  get(BACKEND_API_URL + '/commerce/redirectTweet', { commerceId})

/************************************ curation **********************************/
export const getOnlineSpaces = async () =>
  get(BACKEND_API_URL + '/space/onlineSpaces')

export const getSpaceInfoById = async (twitterId: string, spaceId: string) =>
  post(BACKEND_API_URL + '/space/getSpaceInfoById', {twitterId, spaceId})

export const getTweetCurateList = async (tweetId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/tweetCurateList', {tweetId, pages})

export const getSpaceCurateList = async (tweetId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/spaceCurateList', {tweetId, pages})

export const getSpaceCurationList = async (tweetId: string) =>
  get(BACKEND_API_URL + '/curation/spaceCurationList', {tweetId})

export const getMyCurationRewards = async (twitterId: string) =>
  post(BACKEND_API_URL + '/curation/userCurationRewards', {twitterId})

export const userUnclaimableCurationRewards = async (twitterId: string) =>
  post(BACKEND_API_URL + '/curation/userUnclaimableCurationRewards', {twitterId})

export const getClaimSignature = async (twitterId: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/getUserClaimTagRewardSignature', {twitterId, tick})

export const setOrderClaimed = async (twitterId: string, orderId: string, hash: string, version: number) =>
  post(BACKEND_API_URL + '/curation/setOrderClaimed', {twitterId, orderId, hash, version})

/************************************ ipshare **********************************/
export const getIpshareInfo = async (ethAddr: string) =>
  get(BACKEND_API_URL + '/user/ipshare', {ethAddr})

/************************************ clanker **********************************/
export const getClankerTickers = async () =>
  get(BACKEND_API_URL + '/clanker/ticks')

export const getClankerTickTweets = async (contract: string, pageIndex?: number) =>
  get(BACKEND_API_URL + '/clanker/tickTweets', {contract, pageIndex})
