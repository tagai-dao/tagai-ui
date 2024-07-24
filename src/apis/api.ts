import { get, post, put } from "./axios"
import { BACKEND_API_URL } from '@/config'
import type { CreateCommunity } from '@/types'

/************************************ common **********************************/
export const getBtcPrice = async () =>
  get('https://bevm-api.dnt.social/donut/getETHPrice')

export const getUserBitip = async (btcAddress: string) =>
  get("https://api.bitip.social/inscription/listByHolder", {btcAddress})

/************************************ twitter auth **********************************/
export const checkAccessToken = async (twitterId: string) =>
  post(BACKEND_API_URL + '/auth/checkAccessToken', {twitterId})

export const twitterRefreshAccessToken = async (twitterId: string) =>
  post(BACKEND_API_URL + '/auth/refresh', {twitterId})

export const twitterAuth = async (referee?: string | null | undefined) => 
  get(BACKEND_API_URL + '/auth/login', { referee })

export const twitterLogin = async (state: string) =>
  get(BACKEND_API_URL + '/user/login', { state })

export const twitterLogout = async (twitterId: string) =>
  get(BACKEND_API_URL + '/auth/logout', {twitterId})

export const registerSteem = async (params: any) => 
  post(BACKEND_API_URL + '/register', params)

export const checkRegister = async (twitterId: string) =>
  post(BACKEND_API_URL + '/register/check', { twitterId })

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

/************************************ tweets **********************************/
export const getCommunityNewTweets = async (tick: string, twitterId?: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/communityTweets', {tick, twitterId, pages})

export const getUserTweets = async (twitterId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/userTweets', {twitterId, pages})

export const getTweetById = async (tweetId: string, twitterId?: string) =>
  get(BACKEND_API_URL + '/curation/getTweetById', {tweetId, twitterId})

export const tweet = async (twitterId: string, text: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/tweet', {twitterId, text, tick})

export const newLike = async (twitterId: string, tweetId: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/like', {twitterId, tweetId, tick})

export const newRetweet = async (twitterId: string, tweetId: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/retweet', {twitterId, tweetId, tick})

export const newReply = async (twitterId: string, tweetId: string, text: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/reply', { twitterId, tweetId, text, tick })

export const newQuote = async (twitterId: string, tweetId: string, text: string, tick: string) =>
  post(BACKEND_API_URL + '/curation/quote', { twitterId, tweetId, text, tick })

/************************************ community **********************************/
export const createCommunity = async (params: CreateCommunity) => 
  post(BACKEND_API_URL + '/community/createCommunity', params)

export const trade = async (tick: string, twitterId: string) =>
  post(BACKEND_API_URL + '/community/trade', {tick, twitterId})

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

/************************************ curation **********************************/
export const getOnlineSpaces = async () =>
  get(BACKEND_API_URL + '/space/onlineSpaces')

export const getTweetCurateList = async (tweetId: string, pages?: number) =>
  get(BACKEND_API_URL + '/curation/tweetCurateList', {tweetId, pages})

/************************************ ipshare **********************************/
export const getIpshareInfo = async (ethAddr: string) =>
  get(BACKEND_API_URL + '/user/ipshare', {ethAddr})
