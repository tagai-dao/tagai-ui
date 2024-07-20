import { useAccountStore } from "@/stores/web3";
import { useAccount } from "./useAccount";
import { tweet, newLike, newRetweet, newReply } from "@/apis/api";
import errCode from "@/errCode";
import { GlobalModalType, type Tweet } from "@/types";
import { OP_CONSUME, VP_CONSUME } from "@/config";
import { useModalStore } from "@/stores/common";

export enum OperateType {
  TWEET,
  LIKE,
  RETWEET,
  QUOTE,
  REPLY,
}

export const useTweet = () => {
  const { updateUserVpLocal, udpateUserOPLocal, vp, op, addBackOp, addBackVp } =
    useAccount();
  const formatEmojiText = (str: string) => {
    if (!str || str.trim().length === 0) return "";
    const regStr =
      /[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF][\u200D|\uFE0F]|[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF]|[0-9|*|#]\uFE0F\u20E3|[0-9|#]\u20E3|[\u203C-\u3299]\uFE0F\u200D|[\u203C-\u3299]\uFE0F|[\u2122-\u2B55]|\u303D|[\A9|\AE]\u3030|\uA9|\uAE|\u3030/gi;
    str = str.replace(regStr, (char: any) => {
      let code = char?.codePointAt(char)?.toString(16);
      if (code.length < 4) code = code + "-20e3";
      return `<img class="w-5 h-5 mx-0.5 inline-block" src="/emoji/svg/${code}.svg" onerror="showAltText(this)" alt="${char}"/><text class="hidden">${char}</text>`;
    });
    return str;
  };

  const preCheckCuration = async (opType: OperateType, tweet?: Tweet) => {
    const account = useAccountStore().getAccountInfo
    if (!account?.twitterId) {
      useModalStore().setModalVisible(true, GlobalModalType.Login)
      return false;
    }
    const accessToken = await useAccount().checkoutAccessToken();
    if (!accessToken) {
      throw errCode.InvalidAccessToken;
    }
    switch (opType) {
      case OperateType.TWEET:
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
        if (vp.value < VP_CONSUME.LIKE) {
          throw errCode.INSUFFICIENT_VP;
        }
        if (tweet?.twitterId == account.twitterId) {
          throw errCode.CANT_LIKE_SELF
        }
        break;
      case OperateType.RETWEET:
        if (tweet && tweet.retweeted) {
          return false
        }
        if (op.value < OP_CONSUME.RETWEET) {
          throw errCode.INSUFFICIENT_OP;
        }
        if (vp.value < VP_CONSUME.RETWEET) {
          throw errCode.INSUFFICIENT_VP;
        }
        if (tweet?.twitterId == account.twitterId) {
          throw errCode.CANT_RETWEET_SELF
        }
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
    updateUserVpLocal(VP_CONSUME.LIKE);
  };

  const userRetweet = async (t: Tweet, tick: string) => {
    const account = useAccountStore().getAccountInfo;
    await newRetweet(account.twitterId, t.tweetId, tick);
    udpateUserOPLocal(OP_CONSUME.RETWEET);
    updateUserVpLocal(VP_CONSUME.RETWEET);
  };

  const userReply = async (t: Tweet, text: string, tick: string) => {
    const account = useAccountStore().getAccountInfo;
    await newReply(account.twitterId, t.tweetId, text, tick);
    udpateUserOPLocal(OP_CONSUME.REPLY);
  }

  return {
    formatEmojiText,
    preCheckCuration,
    userTweet,
    userLike,
    userRetweet,
    userReply
  };
};
