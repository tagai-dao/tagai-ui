import { useAccountStore } from "@/stores/web3";
import { useAccount } from "./useAccount";
import { tweet, newLike } from "@/apis/api";
import errCode from "@/errCode";
import type { Tweet } from "@/types";
import { OP_CONSUME, VP_CONSUME } from "@/config";

export const useTweet = () => {
  const { updateUserVpLocal, udpateUserOPLocal, vp, op, addBackOp, addBackVp } = useAccount();
  const formatEmojiText = (str: string) => {
    if (!str || str.trim().length===0) return ''
    const regStr = /[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF][\u200D|\uFE0F]|[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF]|[0-9|*|#]\uFE0F\u20E3|[0-9|#]\u20E3|[\u203C-\u3299]\uFE0F\u200D|[\u203C-\u3299]\uFE0F|[\u2122-\u2B55]|\u303D|[\A9|\AE]\u3030|\uA9|\uAE|\u3030/ig;
    str = str.replace(regStr, (char: any) => {
      let code = char?.codePointAt(char)?.toString(16)
      if(code.length<4) code = code + '-20e3'
      return `<img class="w-5 h-5 mx-0.5 inline-block" src="/emoji/svg/${code}.svg" onerror="showAltText(this)" alt="${char}"/><text class="hidden">${char}</text>`
    });
    return str
  }

  const userTweet = async (text: string, tick: string) => {
    // check access token
    const accessToken = await useAccount().checkoutAccessToken()
    if (!accessToken) {
      throw errCode.InvalidAccessToken;
    }
    await tweet(useAccountStore().getAccountInfo.twitterId, text, tick);
    return true;
  }

  const userLike = async (t: Tweet, tick: string) => {
    const accessToken = await useAccount().checkoutAccessToken()
    const account = useAccountStore().getAccountInfo;
    if (!accessToken) {
      throw errCode.InvalidAccessToken;
    }
    // if (t.twitterId === account.twitterId) {
    //   throw errCode.CANT_LIKE_SELF
    // }
    // check vp op
    
    if (op.value < OP_CONSUME.LIKE){
      throw errCode.INSUFFICIENT_OP
    }
    if (vp.value < VP_CONSUME.LIKE) {
      throw errCode.INSUFFICIENT_VP
    }
    
    await newLike(useAccountStore().getAccountInfo.twitterId, t.tweetId, tick)
    udpateUserOPLocal(OP_CONSUME.LIKE)
    updateUserVpLocal(VP_CONSUME.LIKE)
  }

  return {
    formatEmojiText,
    userTweet,
    userLike
  }
}
