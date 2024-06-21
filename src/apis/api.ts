import { get, post, put } from "./axios"
import { BACKEND_API_URL } from '@/config'

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
