<script setup lang="ts">
import {computed, ref} from "vue";
import {handleErrorTip} from "@/utils/notify";
import {useStateStore} from "@/stores/common";
import { type Tweet } from "@/types";
import { OperateType, useTweet } from "@/composables/useTweet";
import errCode from "@/errCode";
import { useAccount } from "@/composables/useAccount";
import { useCommunityStore } from "@/stores/community";

const props = defineProps<{
    tweet: Tweet;
  }>()
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const isCurating = ref(false);
const curateVisible = ref(false);

const { preCheckCuration, userCurate } = useTweet()
const { op, vp } = useAccount();
const curateAmount = ref(3);

async function preCurate() {
  if (useCommunityStore().currentSelectedCommunity?.distributionEnded) {
      handleErrorTip(errCode.DISTRIBUTION_ENDED)
      return;
    }
  if (!(await preCheckCuration(OperateType.CURATE, props.tweet))) {
    return;
  }
  curateVisible.value = true
}

async function confirmCurate() {
  try{
    isCurating.value = true
    curateVisible.value = false
    if (!(await preCheckCuration(OperateType.CURATE, props.tweet))) {
      return;
    }
    const res = await userCurate(props.tweet, props.tweet.tick!, curateAmount.value)
    if (!props.tweet.liked){
      props.tweet.likeCount += 1;
      props.tweet.liked = 1;
    }
    props.tweet.curated = 1;
  } catch (e) {
    if (e === errCode.TWITTER_ERR) {
      e = errCode.LIKE_FREQUENT
    }
    if (e === errCode.USER_ALREADY_CURATED_TWEET) {
      props.tweet.curated = 1;
      if (!props.tweet.liked){
        props.tweet.likeCount += 1;
        props.tweet.liked = 1;
      }
      return;
    }
    console.log(e)
    handleErrorTip(e)
  } finally {
    isCurating.value = false
  }
}

</script>

<template>
  <button class="flex justify-center items-center gap-2"
          :disabled="isCurating"
          @click.stop="preCurate">
    <i-ep-loading v-if="isCurating" class="animate-spin w-6 h-6"/>
    <i v-else class="w-6 h-6 min-w-6"
       :class="tweet.curated ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
  </button>
  <el-dialog v-model="curateVisible"
           modal-class="overlay-white"
           class="max-w-[500px] rounded-[20px]"
             append-to-body
           width="90%" :show-close="false" align-center destroy-on-close>
      <div class="flex flex-col items-center p-4">
        <h2 class="text-2xl font-bold mb-4">{{ $t('curation.curate') }}</h2>
        <p v-if="$i18n.locale==='en'" class="text-sm text-gray-500 mb-4">
          User can Curate to tweets if you have registered social account on the platform.
          <br />
          The curation reward will be depended on the curate amount. The more you curate, the more reward the author and you will get.
          <br />
          Curate will cost you 1-10 VP(voting power) that you selected, and every user has initial 200 vp which will recover 100% per 3days.
        </p>
        <p v-if="$i18n.locale==='zh'" class="text-sm text-gray-500 mb-4">
          如果您已在平台上注册社交账户，则用户可以对推文进行策展。<br/>
          策展奖励将取决于策展量。策展越多，您和作者获得的奖励就越多。 <br/>
          策展将花费您选择的 1-10 VP（投票权），每个用户都有初始 200 vp，每 3 天将恢复 100%。
        </p>
        <el-slider v-model="curateAmount" :min="1" :max="10" :step="1" class="w-full mb-4 slider" />
        <div class="text-sm w-full text-gray-500 mb-4">{{ $t('consume') }}
          <span class="text-red-500"> VP: {{ curateAmount }}</span>
        </div><div class="text-sm w-full text-gray-500 mb-4">{{ $t('remain') }}
          <span class="text-green-500"> VP: {{ Math.floor(vp) }}</span>
        </div>
        <button class="w-full bg-gradient-primary text-white flex justify-center items-center text-h5 rounded-full h-11" @click="confirmCurate">
          {{$t('confirm')}}
        </button>
      </div>
</el-dialog>
</template>

<style scoped>
.slider ::v-deep(.el-slider__bar) {
  background-color: #FF7A00;
}
.slider ::v-deep(.el-slider__button) {
  border: 2px solid #FF7A00;
}
</style>
