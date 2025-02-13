import i18n from "@/lang";
import errCode from "@/errCode";
import { ElNotification } from "element-plus";
import { ethers } from 'ethers'
import { abis } from './abis'
import _ from 'lodash';

const t = i18n.global.t;

export const handleErrorTip = (e: any) => {
  if (!e) {
    console.log("Null error");
    return;
  }
  console.error(e)
  if (typeof e === "number") {
    return handleServerError(e);
  }

  const errorData = e.data;
  if (errorData) {
    const iface = new ethers.Interface(abis.errors);
    try {
      const decodeError = iface.parseError(errorData);
      notify({
        message: decodeError?.name,
        type: 'error',
        duration: 5000
      })
      return;
    } catch (error) {
      console.log(453, error)
    }
  }
  
  if (
    e.message.indexOf("insufficient funds for intrinsic transaction cost") !==
    -1
  ) {
    notify({
      message: "Insufficient gas, please charge BNB to your Donut address",
      type: "info",
      duration: 5000,
    });
    return t("errMessage.insufficientFee");
  } else if (e.message.indexOf("User denied transaction signature") !== -1) {
    notify({
      message: "User canceled the transaction",
      type: "info",
      duration: 5000,
    });
    return t("errMessage.invalidTransaction");
  } else if (e.message.indexOf("user rejected action") !== -1) {
    notify({
      message: "User canceled the signature",
      type: "info",
      duration: 5000,
    });
    return t("errMessage.userCanceled");
  } else if (e.message.indexOf("User has ipshare") !== -1) {
    notify({ message: "User has created IPShare", type: "info" });
    return "User has created IPShare";
  } else if (e.message.indexOf("IPShare already created") !== -1) {
    notify({ message: "IPShare already created", type: "info" });
    return "IPShare already created";
  } else if (
    e.message.indexOf("invalid nonce") !== -1 ||
    e.message.indexOf("invalid signature") !== -1
  ) {
    notify({ message: "Invalid signature", type: "info" });
    return "Invalid signature";
  } else if (e.message.indexOf("Cannot sell the last 10 share") !== -1) {
    notify({ message: "Cannot sell the last 10 shares", type: "info" });
    return "Cannot sell the last 10 shares";
  } else {
  }
};

export const handleServerError = (code: number) => {
  switch (code) {
    case errCode.IDENTITY_HAS_USED:
      notify({ message: t("errMessage.idUsed"), type: "info" });
      break;
    case errCode.ETH_AUTH_FAIL:
      notify({ message: t("errMessage.ethAuthFail"), type: "error" });
      break;
    case errCode.ENS_MISMATCH:
      notify({ message: t("errMessage.ensMismatch"), type: "info" });
      break;
    case errCode.TRANSACTION_INVALID:
      notify({ message: t("errMessage.transInvalid"), type: "error" });
      break;
    case errCode.NOT_BOND_ETH:
      notify({ message: t("errMessage.noBondEth"), type: "info" });
      break;
    case errCode.PARAMS_ERROR:
      notify({ message: t("errMessage.paramsError"), type: "info" });
      break;
    case errCode.IPSHARE_NOT_CREATED:
      notify({ message: t("errMessage.ipshareNotCreated"), type: "info" });
      break;
    case errCode.CURATION_NOT_EXIST:
      notify({ message: t("errMessage.curationNotExsist"), type: "error" });
      break;
    case errCode.ETH_ADDRESS_ALREADY_USED:
      notify({ message: t("errMessage.ethAddressAlreadyUsed"), type: "error" });
      break;
    case errCode.INSUFFICIENT_CONTENT:
      notify({ message: t("errMessage.insufficientContent"), type: "error" });
      break;
    case errCode.INSUFFICIENT_OP:
      notify({ message: t("errMessage.insufficientOp"), type: "error" });
      break;
    case errCode.INSUFFICIENT_VP:
      notify({ message: t("errMessage.insufficientVp"), type: "error" });
      break;
    case errCode.SPACE_NOT_FOUND:
      notify({ message: t("errMessage.spaceNotFound"), type: "info" });
      break;
    case errCode.IS_LIKED:
      notify({ message: t("errMessage.isLiked"), type: "info" });
      break;
    case errCode.IS_UNLIKED:
      notify({ message: t("errMessage.isUnliked"), type: "info" });
      break;
    case errCode.IS_RETWEETED:
      notify({ message: t("errMessage.isRetweeted"), type: "info" });
      break;
    case errCode.NOT_COMMUNITY_OWNER:
      notify({ message: t("errMessage.notCommunityOwner"), type: "info" });
      break;
    case errCode.DISTRIBUTION_ENDED:
      notify({ message: t("errMessage.distributionEnded"), type: "info" });
      break;
    case errCode.DB_ERROR:
      notify({ message: t("errMessage.dbErr"), type: "info" });
      break;
    case errCode.BLOCK_CHAIN_ERROR:
      notify({ message: t("errMessage.blockChainErr"), type: "info" });
      break;
    case errCode.INVALID_TRANSACTION:
      notify({ message: t("errMessage.invalidTransaction"), type: "info" });
      break;
    case errCode.USER_NOT_REGISTERED:
      notify({ message: t("errMessage.userNotRegisterd"), type: "info" });
      break;
    case errCode.USER_ORDER_PENDING:
      notify({ message: t("errMessage.userOrderPending"), type: "info" });
      break;
    case errCode.NO_REWARD_TO_CLAIM:
      notify({ message: t("errMessage.noRewardToClaim"), type: "info" });
      break;
    case errCode.TICK_HAS_EXISTS:
      notify({ message: t("errMessage.existTick"), type: "info" });
      break;
    case errCode.TWEET_NOT_FOUND:
      notify({ message: t("errMessage.tweetNotFound"), type: "info" });
      break;
    case errCode.InvalidAccessToken:
      notify({ message: t("errMessage.invalidAccessToken"), type: "info" });
      break;
    case errCode.TokenExpired:
      notify({ message: t("errMessage.tokenExpired"), type: "info" });
      break;
    case errCode.TWEET_NOT_FOUND:
      notify({ message: t("errMessage.tweetNotFound"), type: "info" });
      break;
    case errCode.InvalidAccessToken:
      notify({ message: t("errMessage.invalidAccessToken"), type: "info" });
      break;
    case errCode.InvalidSignature:
      notify({ message: t("errMessage.invalideSignatre"), type: "info" });
      break;
    case errCode.InvalidState:
      notify({ message: t("errMessage.invalidState"), type: "info" });
      break;
    case errCode.UserCancelAuth:
      notify({ message: t("errMessage.userCancelAuth"), type: "info" });
      break;
    case errCode.RegisterOutTime:
      notify({ message: t("errMessage.registerOutTime"), type: "info" });
      break;
    case errCode.HasRegistered:
      notify({ message: t("errMessage.hasRegisted"), type: "info" });
      break;
    case errCode.CANT_LIKE_SELF:
      notify({ message: t('errMessage.cantLikeSelf'), type: 'error'})
      break;
    case errCode.CANT_RETWEET_SELF:
      notify({ message: t('errMessage.cantRetweetSelf'), type: 'error'})
      break;
    case errCode.CANT_CURATE_SELF:
      notify({ message: t('errMessage.cantCurateSelf'), type: 'error'})
      break;
    case errCode.TWITTER_ERR:
      notify({ message: t('errMessage.twitterErr'), type: 'error'});
      break;
    case errCode.LIKE_FREQUENT:
      notify({ message: t('errMessage.likeFrequent'), type: 'error'});
      break;
    case errCode.RETWEET_FREQUENT:
      notify({ message: t('errMessage.retweetFrequent'), type: 'error'});
      break;
    default:
      break;
  }
};

interface NotifyOptions {
  title?: string;
  message?: string;
  type?: "success" | "warning" | "error" | "info";
  duration?: number;
}

export const notify = (options: Partial<NotifyOptions> = {}) => {
  const defaultTitle = "Warning";
  const defaultMessage = "This is a Warning message";
  const defaultType: NotifyOptions["type"] = "warning";

  const {
    title = defaultTitle,
    message = defaultMessage,
    type = defaultType,
  } = options;
  ElNotification({
    title,
    message,
    type,
  });
};
