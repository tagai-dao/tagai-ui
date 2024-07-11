import { get, post, put } from "./axios"
import { BACKEND_API_URL } from '@/config'
import type { CreateCommunity } from '@/types'

export const checkAccessToken = async () =>
  post(BACKEND_API_URL + '/auth/checkAccessToken')

/************************************ tweets **********************************/
export const getTweetsByNew = async (twitterId?: string | null, postTime?: any) =>
  get(BACKEND_API_URL + '/tweets/getTweetsByNew' ,{postTime, twitterId})

export const getTweetsByTrending = async (twitterId?: string | null, pageIndex?: any, pageSize?: any) =>
  get(BACKEND_API_URL + '/tweets/getTweetsByTrending' , { twitterId, pageIndex, pageSize})

export const newComment = async (tweetId: string, content: string) =>
    post(BACKEND_API_URL + '/tweets/comment', {tweetId, content})

export const newLike = async (tweetId: string) =>
    post(BACKEND_API_URL + '/tweets/like', {tweetId})

export const commentsOfTweet = async (tweetId: string, commentTime?: string) =>
    get(BACKEND_API_URL + '/tweets/commentsOfTweet', {tweetId, commentTime})

/************************************ community **********************************/
export const createCommunity = async (params: CreateCommunity) => 
  post(BACKEND_API_URL + '/community/createCommunity', params)

export const getCommunitiesByTrending = async (pages?: number) =>
  get(BACKEND_API_URL + '/community/communitiesByTrending', { pages })

export const getCommunitiesByNew = async (pages?: number) =>
  get(BACKEND_API_URL + '/community/communitiesByNew', { pages })

export const getCommunityDetail = async (tick: string) =>
  get(BACKEND_API_URL + '/community/detail', { tick })

export const getHolderList = async (token: string, pages?: number) =>
  get(BACKEND_API_URL + '/community/holderList', { token, pages })

export const isTokenExist = async (tick: string) =>
  get(BACKEND_API_URL + '/community/isTokenExist', { tick })