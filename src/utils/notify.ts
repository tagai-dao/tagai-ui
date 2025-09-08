import i18n from "@/lang";
import errCode from "@/errCode";
import { ElNotification } from "element-plus";
import { abis } from './abis'
import _ from 'lodash';
import { useAccount } from "@/composables/useAccount";
import { decodeErrorResult } from 'viem';
import { ContractFunctionExecutionError, decodeAbiParameters } from 'viem';
import { getWalletClient } from "./wallets";

const t = i18n.global.t;

function parseViemRevertReason(error: any): string {
  const hexData = error?.cause?.data;
  let result = ''
  if (typeof hexData === 'string' && hexData.startsWith('0x08c379a0')) {
    try {
      console.log('default error')
      // 切掉 4 字节选择器
      const encoded = `0x${hexData.slice(10)}`;
      // 使用 viem 解码 ABI 参数
      const [reason] = decodeAbiParameters([{ type: 'string' }], encoded as `0x${string}`);
      notify({ message: reason, type: "error" });
      return reason;
    } catch (err) {
      console.warn('ABI decode error:', err);
    }
  }else {// decode custom errors
    const errorData = error.cause?.data || error.cause?.cause?.data || extractRevertReasonFromError(error.shortMessage);
    console.log('custom error', error.details)
    if (errorData) {
      try {
        const decodedError = decodeErrorResult({
          abi: abis.errors,      // 错误 ABI 列表
          data: errorData              // 合约抛出的错误 revert data
        });
        notify({ message: decodedError.errorName, type: "error" });
        return decodedError.errorName;
      } catch (error) {
        console.log('decodeError fail:', error);
      }
    }
  }

  // Fallback
  const message = error.message
  if (
    message.indexOf("insufficient funds for intrinsic transaction cost") !==
    -1
  ) {
    notify({
      message: "Insufficient gas, please charge BNB to your Donut address",
      type: "info",
      duration: 5000,
    });
    return t("errMessage.insufficientFee");
  } else if (message.indexOf("User denied transaction signature") !== -1) {
    notify({
      message: "User canceled the transaction",
      type: "info",
      duration: 5000,
    });
    return t("errMessage.invalidTransaction");
  } else if (message.indexOf("user rejected action") !== -1) {
    notify({
      message: "User canceled the signature",
      type: "info",
      duration: 5000,
    });
    return t("errMessage.userCanceled");
  } else if (message.indexOf("User has ipshare") !== -1) {
    notify({ message: "User has created IPShare", type: "info" });
    return "User has created IPShare";
  } else if (message.indexOf("IPShare already created") !== -1) {
    notify({ message: "IPShare already created", type: "info" });
    return "IPShare already created";
  } else if (
    message.indexOf("invalid nonce") !== -1 ||
    message.indexOf("invalid signature") !== -1
  ) {
    notify({ message: "Invalid signature", type: "info" });
    return "Invalid signature";
  } else if (message.indexOf("Cannot sell the last 10 share") !== -1) {
    notify({ message: "Cannot sell the last 10 shares", type: "info" });
    return "Cannot sell the last 10 shares";
  } else {
    console.log(3, error.shortMessage)
    notify({ message: error.shortMessage || error.message, type: "error" });
    return error.shortMessage || error.message;
  }
}

export const handleErrorTip = (e: any) => {
  if (!e) {
    console.log("Null error");
    return;
  }
  // console.error(e)
  if (typeof e === "number") {
    return handleServerError(e);
  }

  if (typeof e === 'string') {
    notify({ message: e, type: "error" });
    return e
  }

  const revertReason = parseViemRevertReason(e);
  return revertReason;
  
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
    case errCode.USER_SCORE_TOO_LOW:
      notify({ message: t('errMessage.userScoreTooLow'), type: 'error'});
      break;
    default:
      break;
  }
  if (code === errCode.InvalidAccessToken || code === errCode.InvalidState || code === errCode.UserCancelAuth) {
    useAccount().logout()
  }
};

/**
 * viem return a non-standard error string, we need to extract the revert reason from it
 * @param errorString 
 * @returns 
 */
function extractRevertReasonFromError(errorString: string): string | null {
  const errorMatch = errorString.match(/error=({.*}),\s*code=/s);

  try {
    const error = JSON.parse(errorMatch?.[1] || '{}')
    console.log(5, error)
    return error.error?.data;
  } catch (error) {
    console.log(4, error)
    return null;
  }
}

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
