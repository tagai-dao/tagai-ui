<script setup lang="ts">
import { getChainPath } from '@/config/chains'
import { useChainStore } from '@/stores/chain'
import { notify } from '@/utils/notify'
import type { Tweet } from '@/types'

const props = defineProps<{
    tweet: Tweet;
  }>()

const chainStore = useChainStore()

function copyLink() {
    const path = getChainPath(chainStore.activeChainId, `/post-detail/${props.tweet.tweetId}`)
    navigator.clipboard.writeText(new URL(path, 'https://tagai.fun').toString())
    notify({
      message: 'Copied link'
    })
}

</script>

<template>
  <button class="flex justify-center items-center gap-2 p-2 -m-2" :aria-label="$t('share')" :title="$t('share')"
          @click.stop="copyLink">
    <i class="w-5 h-5 min-w-5 btn-icon-share"></i>
  </button>
</template>

<style scoped>

</style>
