<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useCurationStore } from '@/stores/curation'
import { useRouter } from 'vue-router'
import type { Space } from '@/types'
import { getOnlineSpaces } from '@/apis/api'

const curationStore = useCurationStore()
const router = useRouter()
const onlineSpaces = ref<Space[]>([])

// 加载正在举办的 Space（getOnlineSpaces API 已经过滤了 state = 2）
async function loadOnlineSpaces() {
  try {
    const spaces = await getOnlineSpaces() as Space[]
    console.log('Loaded online spaces:', spaces)
    if (spaces && spaces.length > 0) {
      // 过滤掉特定账号，并限制显示数量
      // getOnlineSpaces API 返回的都是正在举办的 Space（state = 2）
      const filtered = spaces
        .filter(space => space.twitterId !== "1487723839693852673")
        .slice(0, 6) // 最多显示6个
      onlineSpaces.value = filtered
      console.log('Filtered online spaces:', filtered)
    } else {
      onlineSpaces.value = []
    }
  } catch (e) {
    console.error('Load online spaces error:', e)
    onlineSpaces.value = []
  }
}

function gotoSpace(space: Space) {
  if (space.tweetId) {
    router.push(`/space-detail/${space.tweetId}`)
  }
}

// 监听 store 中的数据变化（当 HomeView 加载数据时）
watch(() => curationStore.allSpaces, (spaces) => {
  console.log('Store allSpaces changed:', spaces)
  if (spaces && spaces.length > 0) {
    // getOnlineSpaces API 返回的都是 state = 2 的 Space，直接使用
    const filtered = spaces
      .filter(space => space.twitterId !== "1487723839693852673")
      .slice(0, 6)
    onlineSpaces.value = filtered
    console.log('Updated onlineSpaces from store:', filtered)
  } else {
    onlineSpaces.value = []
  }
}, { immediate: true })

// 组件挂载时加载数据
onMounted(async () => {
  // 如果 store 中已有数据，使用 store 的数据
  if (curationStore.allSpaces && curationStore.allSpaces.length > 0) {
    onlineSpaces.value = curationStore.allSpaces
      .filter(space => space.twitterId !== "1487723839693852673")
      .slice(0, 6)
  } else {
    // 否则直接加载
    await loadOnlineSpaces()
  }
})
</script>

<template>
  <div class="h-auto max-h-[50%] bg-white rounded-2xl flex flex-col">
    <div class="font-bold text-h3 py-3 px-4">Live Spaces</div>
    <div class="flex-1 overflow-auto no-scroll-bar max-h-[400px]">
      <div v-if="onlineSpaces.length === 0" class="flex justify-center py-5 w-full">
        <img class="my-8" src="~@/assets/images/empty-data.svg" alt="">
      </div>
      <div v-else class="flex flex-col">
        <div 
          class="flex items-center gap-3 py-3 px-4 border-t-[0.5px] border-grey-light cursor-pointer hover:bg-gray-50 transition-colors first:border-t-0"
          v-for="space of onlineSpaces" 
          :key="space.spaceId || space.tweetId"
          @click="gotoSpace(space)"
        >
          <!-- Logo/头像 - 类似 X 的 Live on X 样式 -->
          <div class="flex-shrink-0 relative">
            <div class="w-10 h-10 min-w-10 min-h-10 rounded-full bg-grey-normal-active flex items-center justify-center overflow-hidden border-2 border-red-500">
              <img 
                v-if="space.logo"
                class="w-full h-full object-center object-cover" 
                :src="space.logo.startsWith('https://tiptag') ? space.logo + '?x-oss-process=image/resize,w_100' : space.logo" 
                alt=""
                @error="(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }"
              >
              <div v-else class="w-full h-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold">
                Space
              </div>
            </div>
            <!-- Live 指示器 - 红色圆点 -->
            <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
          <!-- 标题和参与者 -->
          <div class="flex-1 min-w-0">
            <div class="font-bold text-h4 truncate text-black">
              {{ space.title || 'Untitled Space' }}
            </div>
            <div class="text-xs text-grey-8d flex items-center gap-1 mt-1">
              <span class="text-red-500 font-semibold">LIVE</span>
              <span class="mx-1">·</span>
              <span>+{{ space.participantCount ?? 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
