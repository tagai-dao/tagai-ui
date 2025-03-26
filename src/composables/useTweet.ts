import { useAccountStore } from "@/stores/web3";
import { useAccount } from "./useAccount";
import { tweet, newLike, newRetweet, newReply, newQuote, newCurate } from "@/apis/api";
import errCode from "@/errCode";
import { GlobalModalType, type Tweet } from "@/types";
import { OP_CONSUME, VP_CONSUME } from "@/config";
import { useModalStore } from "@/stores/common";
import { ethers } from "ethers";
import { notify } from "@/utils/notify";
import i18n from "@/lang";

const t = i18n.global.t

export enum OperateType {
  TWEET,
  BLINK,
  LIKE,
  RETWEET,
  QUOTE,
  REPLY,
  CURATE,
  TIP_CURATE
}

const TweetRex = /https:\/\/(twitter|x)\.com\/[0-9a-zA-Z]+\/status\/([0-9]+)(\/\w)?/

export const useTweet = () => {
  const { updateUserVpLocal, udpateUserOPLocal, vp, op, addBackOp, addBackVp } =
    useAccount();
  const formatEmojiText = (str: string) => {
    if (!str || str.trim().length === 0) return "";
    const nStrList = str.split(/\r\n|\r|\n/)
    // @ts-ignore
    const regStr = /[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF][\u200D|\uFE0F]|[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF]|[0-9|*|#]\uFE0F\u20E3|[0-9|#]\u20E3|[\u203C-\u3299]\uFE0F\u200D|[\u203C-\u3299]\uFE0F|[\u2122-\u2B55]|\u303D|[\A9|\AE]\u3030|\uA9|\uAE|\u3030/gi;
    let nStr = ''
    for(let iStr of nStrList) {
      iStr = iStr.replace(regStr, (char: any) => {
        let code = char?.codePointAt(char)?.toString(16);
        if (code.length < 4) code = code + "-20e3";
        return `<img class="w-5 h-5 mx-0.5 inline-block" src="/emoji/svg/${code}.svg" onerror="showAltText(this)" alt="${char}"/><text class="hidden">${char}</text>`;
      });
      nStr += (iStr+`<br>`)
    }
    return nStr;
  };

  const getTweetIdFromUrl = (url: string) => {
    if (!url) return null;
    const group = url.match(TweetRex);
    if (group) {
        const tweetId = group[2]
        return tweetId;
    }
  }

  const preCheckCuration = async (opType: OperateType, tweet?: Tweet, costVp: number = 0) => {
    const account = useAccountStore().getAccountInfo
    if (!account?.twitterId) {
      useModalStore().setModalVisible(true, GlobalModalType.Login)
      return false;
    }
    const accessToken = await useAccount().checkoutAccessToken();
    if (!accessToken) {
      throw errCode.InvalidAccessToken;
    }
    if ([OperateType.TWEET, OperateType.BLINK, OperateType.RETWEET, OperateType.QUOTE, OperateType.REPLY].includes(opType)) {
      if (!account.authPost) {
        notify({
          type: 'warning',
          message: t('loginView.needPostAuth')
        })
        return false;
      }
    }

    if ([OperateType.LIKE, OperateType.CURATE, OperateType.TIP_CURATE].includes(opType)) {
      if (!account.authLike) {
        notify({
          type: 'warning',
          message: t('loginView.needLikeAuth')
        })
        return false;
      }
    }
    switch (opType) {
      case OperateType.TWEET:
        if (op.value < OP_CONSUME.POST) {
          throw errCode.INSUFFICIENT_OP;
        }
        break;
      case OperateType.BLINK:
        if (!useAccountStore().ipshare?.ethAddr) {
          useModalStore().setModalVisible(true, GlobalModalType.CreateIPShare)
          throw errCode.IPSHARE_NOT_CREATED;
        }
        if (op.value < OP_CONSUME.POST) {
          throw errCode.INSUFFICIENT_OP;
        }
        break;
      case OperateType.LIKE:
        if (tweet && tweet.liked) {
          return false
        }
        if (op.value < OP_CONSUME.LIKE) {
          throw errCode.INSUFFICIENT_OP;
        }
 
        if (tweet?.twitterId == account.twitterId) {
          throw errCode.CANT_LIKE_SELF
        }
        // if (!account.steemId) {
        //   useModalStore().setModalVisible(true, GlobalModalType.Register)
        //   return false;
        // }
        break;
      case OperateType.RETWEET:
        if (tweet && tweet.retweeted) {
          return false
        }
        if (op.value < OP_CONSUME.RETWEET) {
          throw errCode.INSUFFICIENT_OP;
        }
        // if (vp.value < VP_CONSUME.RETWEET) {
        //   throw errCode.INSUFFICIENT_VP;
        // }
        if (tweet?.twitterId == account.twitterId) {
          throw errCode.CANT_RETWEET_SELF
        }
        // if (!account.steemId) {
        //   useModalStore().setModalVisible(true, GlobalModalType.Register)
        //   return false;
        // }
        break;
      case OperateType.QUOTE:
        if (op.value < OP_CONSUME.QUOTE) {
          throw errCode.INSUFFICIENT_OP;
        }
        break;
      case OperateType.REPLY:
        if (op.value < OP_CONSUME.REPLY) {
          throw errCode.INSUFFICIENT_OP;
        }
        break;
      case OperateType.CURATE:
        if (tweet && tweet.curated) {
          return false
        }
        if (op.value < costVp) {
          throw errCode.INSUFFICIENT_OP;
        }
        if (vp.value < costVp) {
          throw errCode.INSUFFICIENT_VP;
        }
        if (tweet?.twitterId == account.twitterId) {
          throw errCode.CANT_CURATE_SELF
        }
        if (!ethers.isAddress(account.ethAddr)) {
          useModalStore().setModalVisible(true, GlobalModalType.BondEth)
          return false
        }
        if (!account.steemId) {
            useModalStore().setModalVisible(true, GlobalModalType.Register)
            return false;
          }
        break;
      case OperateType.TIP_CURATE:
        if (op.value < OP_CONSUME.POST) {
          throw errCode.INSUFFICIENT_OP;
        }
        if (vp.value < costVp) {
          throw errCode.INSUFFICIENT_VP;
        }
        if (!account.steemId) {
            useModalStore().setModalVisible(true, GlobalModalType.Register)
            return false;
          }
    }
    return true;
  };

  const userTweet = async (text: string, tick: string) => {
    await tweet(useAccountStore().getAccountInfo.twitterId, text, tick);
    return true;
  };

  const userLike = async (t: Tweet, tick: string) => {
    await newLike(useAccountStore().getAccountInfo.twitterId, t.tweetId, tick);
    udpateUserOPLocal(OP_CONSUME.LIKE);
    // updateUserVpLocal(VP_CONSUME.LIKE);
  };

  const userRetweet = async (t: Tweet, tick: string) => {
    const account = useAccountStore().getAccountInfo;
    await newRetweet(account.twitterId, t.tweetId, tick);
    udpateUserOPLocal(OP_CONSUME.RETWEET);
    // updateUserVpLocal(VP_CONSUME.RETWEET);
  };

  const userCurate = async (t: Tweet, tick: string, vp: number) => {
    const account = useAccountStore().getAccountInfo;
    await newCurate(account.twitterId, t.tweetId, tick, vp);
    udpateUserOPLocal(vp);
    updateUserVpLocal(vp);
  }

  const userReply = async (t: Tweet, text: string, tick: string) => {
    const account = useAccountStore().getAccountInfo;
    await newReply(account.twitterId, t.tweetId, text, tick);
    udpateUserOPLocal(OP_CONSUME.REPLY);
  }

  const userQuote = async (t: Tweet, text: string, tick: string) => {
    const account = useAccountStore().getAccountInfo;
    await newQuote(account.twitterId, t.tweetId, text, tick);
    udpateUserOPLocal(OP_CONSUME.QUOTE)
  }

  return {
    formatEmojiText,
    preCheckCuration,
    getTweetIdFromUrl,
    userTweet,
    userLike,
    userRetweet,
    userReply,
    userQuote,
    userCurate
  };
};
