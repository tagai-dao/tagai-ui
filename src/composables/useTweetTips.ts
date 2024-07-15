import { ref, computed, watch, onMounted } from "vue";
import { useAccountStore, useBlockchain } from "@/stores/web3";
import { useStateStore } from "@/stores/common";

export const useTweetTip = (type: string) => {
  const globlType = useStateStore().loginTipType;
  if (globlType) {
    type = globlType
  }
  const accStore = useAccountStore();
  const tipHtml = ref("<p></p>");
  const tipBtnTitle = ref("Confirm");
  const isTwitterLogin = ref(false);
  const postCondition = ref(0)
  const postState = {
    canPost: 0,
    needLoginBtc: 1,
    needIpshare: 2,
    needTwitte: 3
  }

  watch([
    () => type,
    () => accStore.getAccountInfo,
    () => accStore.twitter.twitterId,
    () => accStore.ipshare.assetId
  ], () => {
    if (type === 'comment') {
      let state = postState.canPost
      tipHtml.value = `<P>You can comment to the Twitter after link your Twitter account.</p>`
      if (accStore.getAccountInfo.length == 0) {
        tipBtnTitle.value = 'Connect'
        state = 1
      }else if (!accStore.twitter.twitterId) {
        tipBtnTitle.value = 'Login'
        state = 3
      }
      postCondition.value = state
    }else if (type === 'mint') {
      tipHtml.value = `<p>You can become a recommender of this rune by posting content to Twitter and the blockchain. You need to complete the following actions to become a recommender:</p>`
      let state = postState.canPost
      if (accStore.getAccountInfo.length === 0) {
        tipBtnTitle.value = 'Connect'
        tipHtml.value += `<p class="text-red">1. Log in to Donut by using your BTC wallet;</p>`
        state = 1
      }else {
        tipHtml.value += `<p class="text-green">1. Log in to Donut by using your BTC wallet;</p>`
      }

      if (!accStore.ipshare.assetId) {
        tipHtml.value += `<p class="text-red">2. Mint identity inscription bitIP and create a liquidity pool for it on BTC L2;</p>`
        if (state == 0) {
          tipBtnTitle.value = 'Create'
          state = 2
        }
      }else {
        tipHtml.value += `<p class="text-green">2. Mint identity inscription bitIP and create a liquidity pool for it on BTC L2;</p>`
      }

      if (!accStore.twitter.twitterId) {
        tipHtml.value += `<p class="text-red">3. Link your Twitter account</p>`
        if (state === 0) {
          state = state === 0 ? 3 : state
          tipBtnTitle.value = 'Login'
        }
      }else {
        tipHtml.value += `<p class="text-green">3. Link your Twitter account</p>`
      }
      postCondition.value = state
    }
  }, {immediate: true})
  return {
    tipHtml,
    tipBtnTitle,
    postCondition
  };
};
