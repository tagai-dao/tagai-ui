<script setup lang="ts">
import { type ClankerToken } from '@/types';
import { computed } from 'vue'
import { useCurationStore } from '@/stores/curation';
import { formatPrice } from '@/utils/helper';
import { useAccountStore } from '@/stores/web3';
import { useRouter } from 'vue-router';
import { useClankerStore } from '@/stores/clanker';
import { useStateStore } from '@/stores/common';
import {tagBgColors, tagTextColors} from "@/composables/useTags";
import { useTools } from '@/composables/useTools';
import { formatAddress } from '@/utils/helper';

const curationStore = useCurationStore()
const accStore = useAccountStore()
const clankerStore = useClankerStore()
const stateStore = useStateStore()
const router = useRouter()
const props = defineProps<{
  token: ClankerToken
}>()

const { onCopy } = useTools()

</script>

<template>
  <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-5 px-3.5 flex gap-3">
    <div class="w-20 h-20 min-w-20 min-h-20 rounded-2xl bg-grey-normal-active shadow-tag-logo
                flex items-center justify-center relative overflow-hidden">
      <img v-if="token.logo" class="w-full h-full object-center object-cover" :src="token.logo" alt="">
      <div v-else class="baackground-color-black flex items-center justify-center">
          <p class="text-white text-h1">
          {{ token.tick?.slice(0, 1) }}
          </p>
      </div>
    </div>
    <div class="flex-1 flex flex-col justify-between truncate">
      <div class="flex gap-x-2 items-end flex-wrap">
        <span class="text-grey-normal text-h2 font-bold leading-6">{{ token.name }}</span>
        <div class="flex-1 flex justify-end mt-1">
          <div v-if="token.marketCap" class="flex items-end gap-1">
            <span class="font-normal italic text-grey-64 leading-5 text-sm">market cap</span>
            <span class="font-medium italic text-orange-normal leading-5 text-sm">
              {{ formatPrice(Math.round(parseFloat(token.marketCap as any) * stateStore.ethPrice)) }}
            </span>
          </div>
        </div>
      </div>
      <div class="flex-1 w-full flex justify-between pt-1">
        {{ token.tick }}
      </div>
      <div class="flex-1 w-full flex items-center pt-1 text-sm text-grey-64">
        <span>
          {{ $t('address') }}: {{ formatAddress(token.token ?? '', 8, 4) }}
        </span>
        <button class="ml-2" @click.stop="onCopy(token.token??'')"
                  :disabled="!(token?.token)">
            <img class="w-[8px]" src="~@/assets/icons/icon-copy.svg" alt="">
          </button>
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
