import { useAccountStore } from "@/stores/web3";
import { useAccount } from "./useAccount";
import { tweet } from "@/apis/api";
import errCode from "@/errCode";

export const useTweet = () => {
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

  return {
    formatEmojiText,
    userTweet
  }
}
