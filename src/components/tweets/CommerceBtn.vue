<script lang="ts" setup>
import { useStateStore } from '@/stores/common';
import { useCurationStore } from '@/stores/curation';
import type { Tweet } from '@/types';
import { useRouter } from 'vue-router';

const props = defineProps<{
    tweet: Tweet
}>()
const stateStore = useStateStore()

const router = useRouter()

function gotoTrade() {
    useCurationStore().currentSelectedTweet = props.tweet;
    stateStore.sellsman = props.tweet.ethAddr || '';
    router.push(`/tag-detail/${props.tweet.tick}/${props.tweet.ethAddr}`)
}
</script>

<template>
    <button class="h-12 w-full bg-gradient-primary rounded-full text-h5 text-white my-3"
        @click.stop="gotoTrade"
        v-if="tweet.commerceId">
        Trade #{{ tweet.tick }}
    </button>
</template>