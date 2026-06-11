<script setup lang="ts">
import { type Community } from '@/types';
import { computed } from 'vue'
import { useCurationStore } from '@/stores/curation';
import { formatShortDate, formatTokenAmount, formatUsdCompact } from '@/utils/format';
import { parseTimestamp } from '@/utils/helper';
import { getCurrentLocale } from '@/lang';
import { BondingCurveSupply } from '@/config';
import { useAccountStore } from '@/stores/web3';
import { useRouter } from 'vue-router';
import { useCommunityStore } from '@/stores/community';
import { useStateStore } from '@/stores/common';
import { getTagStyle, parseTagsJson } from '@/composables/useTags'
import IconLinks from "@/components/home/IconLinks.vue";
import Sparkline from "@/components/common/Sparkline.vue";

const curationStore = useCurationStore()
const accStore = useAccountStore()
const comStore = useCommunityStore()
const stateStore = useStateStore()
const router = useRouter()
const props = defineProps<{
  community: Community
}>()

const onlineSpace = computed(() => {
  const spaces = curationStore.allSpaces;
  return !!spaces.find(sp => sp.tick == props.community.tick)
})

async function trade() {
  comStore.currentSelectedCommunity = props.community
  router.push('/buy-sell/' + props.community.tick)
}

const communityTags = computed(() => parseTagsJson(props.community.tags ?? undefined))

// 内盘曲线进度（listed 后为 100%，由上方 v-if 排除显示）
const curveProgress = computed(() => {
  const sold = Number(props.community.bondingCurveSupply ?? 0)
  return Math.max(0, (sold / BondingCurveSupply) * 100)
})

// 30 天内显示相对时间，更早显示本地化短日期，避免长 datetime 撑爆卡片
const createTimeText = computed(() => {
  if (!props.community.createAt) return ''
  const ts = new Date(props.community.createAt).getTime()
  if (isNaN(ts)) return ''
  if (Date.now() - ts < 30 * 24 * 3600 * 1000) return parseTimestamp(props.community.createAt)
  return formatShortDate(props.community.createAt, getCurrentLocale())
})
</script>

<template>
  <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-5 px-3.5 flex gap-3">
    <div class="relative w-20 h-20 min-w-20 min-h-20">
      <div class="w-20 h-20 min-w-20 min-h-20 rounded-2xl bg-grey-normal-active shadow-tag-logo
                flex items-center justify-center relative overflow-hidden">
        <img class="w-full h-full object-center object-cover" :src="community.logo.startsWith('https://tiptag') ? community.logo + '?x-oss-process=image/resize,w_100' : community.logo" alt="">
        <img v-show="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
      </div>
      <div class="absolute w-full h-full -right-[3px] -bottom-[3px] overflow-hidden">
        <div v-if="community.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm shadow-tag-logo
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] whitespace-nowrap">
                  {{community.isImport ? $t('imported') : $t('listed')}}
                </div>
      </div>
    </div>
    <div class="flex-1 flex flex-col justify-between truncate">
      <div class="flex gap-x-2 items-end flex-wrap">
        <span class="text-grey-normal text-h2 font-bold leading-6" :class="community.listed ? 'text-orange-normal' : ''">{{ community.tick }}</span>
        <div class="flex-1 flex justify-end mt-1">
          <div v-if="community.marketCap" class="flex items-end gap-1.5">
            <span class="font-normal italic text-grey-64 leading-5 text-sm">{{ $t('marketCap') }}</span>
            <span class="font-medium italic text-orange-normal leading-5 text-sm">
              {{ formatUsdCompact(parseFloat(community.marketCap as any) * stateStore.ethPrice) }}
            </span>
            <span v-if="typeof community.priceChange24h === 'number'"
                  class="font-semibold leading-5 text-sm whitespace-nowrap"
                  :class="community.priceChange24h >= 0 ? 'text-up' : 'text-down'">
              {{ community.priceChange24h >= 0 ? '+' : '' }}{{ community.priceChange24h.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
      <div class="flex-1 w-full flex justify-between pt-1">
        <div class="flex-1 truncate">
          <!-- 描述压缩为单行，hover 显全文；让位给下方数据行（v2 方案 3.5） -->
          <div class="truncate text-grey-5a text-[14px] leading-[20px] font-medium" :title="community.description">
            {{ community.description }}
          </div>
          <!-- 数据行：内盘币显示 bonding curve 进度，已上市币显示 24h sparkline / 创建时间 -->
          <div class="flex items-center gap-2 mt-1.5 text-sm text-grey-64">
            <template v-if="!community.listed && !community.isImport && typeof community.bondingCurveSupply === 'number'">
              <div class="w-[72px] h-1.5 rounded-full bg-grey-light-active overflow-hidden">
                <div class="h-full bg-gradient-primary rounded-full" :style="{ width: Math.min(curveProgress, 100) + '%' }"></div>
              </div>
              <span class="tabular-nums">{{ curveProgress.toFixed(0) }}%</span>
            </template>
            <Sparkline v-else-if="community.sparkline24h && community.sparkline24h.length > 1" :points="community.sparkline24h" />
            <span v-if="typeof community.holderCount === 'number'" class="whitespace-nowrap tabular-nums">{{ formatTokenAmount(community.holderCount) }} 👥</span>
            <span v-if="createTimeText" class="ml-auto whitespace-nowrap">{{ createTimeText }}</span>
          </div>
        </div>
        <slot name="default-btn">
          <div class="flex items-center">

          </div>
        </slot>
      </div>
      <div class="flex justify-between items-center mt-2">
        <div class="font-extralight flex flex-wrap gap-2">
          <template v-if="communityTags.length" >
            <button v-for="(tag, index) of communityTags" :key="tag"
                    class="px-2 h-5 text-xs rounded-md"
                    :style="getTagStyle(index)">
              {{ tag }}
            </button>
            <!-- <button v-if="community.createdByAi" class="px-2 h-5 text-sm rounded-md gradient-text glow-effect">
              {{community.version === 5 ? $t('createCommunity.ixo') : $t('createCommunity.aiCreate')}}
            </button> -->
          </template>
        </div>
        <IconLinks class="my-1" :community="community"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradient-text {
  background: linear-gradient(
    300deg,
    #ff0080,
    #ff8c00,
    #40e0d0,
    #7b68ee,
    #ff0080
  );
  background-size: 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient 8s linear infinite;
  font-weight: bold;
}

.glow-effect {
  position: relative;
}

.glow-effect::before {
  content: "AI create";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: inherit;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: blur(12px);
  opacity: 0.7;
  animation: gradient 8s linear infinite;
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
