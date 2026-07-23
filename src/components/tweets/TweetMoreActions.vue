<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { Tweet } from '@/types'

const props = defineProps<{
  tweet: Tweet
}>()

const router = useRouter()

const onCommand = async (command: string) => {
  if (command !== 'quote-ai-channel' || !props.tweet.tick) return
  await router.push({
    path: `/tag-detail/${props.tweet.tick}`,
    query: {
      tab: 'ai',
      quoteTweetId: props.tweet.tweetId,
    },
  })
}
</script>

<template>
  <el-dropdown
    v-if="tweet.tick && !tweet.spaceId"
    trigger="click"
    placement="bottom-end"
    @command="onCommand"
    @click.stop
  >
    <button
      class="flex justify-center items-center p-2 -m-2"
      aria-label="More post actions"
      title="More"
      @click.stop
    >
      <i-ep-more-filled class="w-5 h-5 text-grey-bd" />
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="quote-ai-channel">
          <div class="flex items-center gap-2 py-1">
            <span class="text-lg">#</span>
            <span>Quote to AI Channel</span>
          </div>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
