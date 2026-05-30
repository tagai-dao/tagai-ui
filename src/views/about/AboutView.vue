<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import communityTagsImg from '@/assets/about/community-tags.png'
import blinksLinksImg from '@/assets/about/blinks-links.png'
import communityEconomyImg from '@/assets/about/community-economy.png'

const { t } = useI18n()

// Section 1 tab state: 'tags' | 'blinks'
const syncTab = ref<'tags' | 'blinks'>('tags')
</script>

<template>
  <div class="h-full overflow-auto bg-white">
    <div class="max-w-5xl mx-auto px-5 py-10 pb-24 my-6 web:my-8">
      <!-- Hero -->
      <section class="text-center mb-14">
        <h1 class="text-3xl web:text-4xl font-extrabold text-grey-normal mb-6">{{ t('aboutView.title') }}</h1>
        <p class="text-grey-8d text-sm web:text-base max-w-xl mx-auto leading-relaxed">
          {{ t('aboutView.subtitle') }}
        </p>
        <p class="text-grey-normal text-base web:text-lg font-bold mt-6">
          {Community}, {coin}, {ATOC Agent}
        </p>
      </section>

      <!-- Section 1: An on-chain community synced with X -->
      <section class="mb-14">
        <div class="flex flex-col web:flex-row web:items-center gap-3 mb-4">
          <span class="text-base font-bold text-grey-normal">{{ t('aboutView.feature1Title') }}</span>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 rounded-md text-xs transition-colors"
              :class="syncTab === 'tags' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
              @click="syncTab = 'tags'"
            >
              Community Tags
            </button>
            <button
              class="px-3 py-1 rounded-md text-xs transition-colors"
              :class="syncTab === 'blinks' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
              @click="syncTab = 'blinks'"
            >
              Blinks Links
            </button>
          </div>
        </div>

        <div class="border border-gray-200 rounded-2xl p-4 web:p-6">
          <p class="text-xs web:text-sm text-grey-8d mb-4">
            {{ syncTab === 'tags' ? t('aboutView.communityTagsDesc') : t('aboutView.blinksLinksDesc') }}
          </p>
          <img
            v-show="syncTab === 'tags'"
            :src="communityTagsImg"
            class="w-full h-auto rounded-lg"
            alt="Community Tags"
          >
          <img
            v-show="syncTab === 'blinks'"
            :src="blinksLinksImg"
            class="w-full h-auto rounded-lg"
            alt="Blinks Links"
          >
        </div>
      </section>

      <!-- Section 2: A Community Economy built around Community Token -->
      <section class="mb-14">
        <h2 class="text-base font-bold text-grey-normal mb-4">{{ t('aboutView.feature2Title') }}</h2>
        <div class="border border-gray-200 rounded-2xl p-4 web:p-6">
          <img
            :src="communityEconomyImg"
            class="w-full h-auto rounded-lg"
            alt="Community Economy"
          >
        </div>
      </section>

      <!-- Section 3: Autonomous Community driven by ATOC Agent -->
      <section class="mb-14">
        <h2 class="text-base font-bold text-grey-normal mb-4">{{ t('aboutView.feature3Title') }}</h2>
        <div class="border border-gray-200 rounded-2xl p-4 web:p-6">
          <!-- Agent header row -->
          <div class="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
            <div class="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold truncate">
                BUIDL-CTO <span class="text-gray-400 font-normal text-xs">@buidlcto</span>
              </div>
              <div class="text-[10px] text-gray-400 truncate">0xffe5...b9d2</div>
            </div>
            <div class="flex gap-3 web:gap-6 text-center">
              <div>
                <div class="text-[10px] text-gray-400">OP</div>
                <div class="text-xs web:text-sm font-bold">2,000</div>
                <div class="text-[10px] text-gray-400">{{ t('aboutView.opDesc') }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-400">VP</div>
                <div class="text-xs web:text-sm font-bold">200</div>
                <div class="text-[10px] text-gray-400">{{ t('aboutView.vpDesc') }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-400">BUIDL</div>
                <div class="text-xs web:text-sm font-bold">43,599.31</div>
                <div class="text-[10px] text-gray-400">{{ t('aboutView.buidlDesc') }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-400">{{ t('aboutView.reputation') }}</div>
                <div class="text-xs web:text-sm font-bold">97,195.52</div>
                <div class="text-[10px] text-gray-400">{{ t('aboutView.repDesc') }}</div>
              </div>
            </div>
          </div>
          <!-- Agent modules -->
          <div class="grid grid-cols-2 web:grid-cols-4 gap-3">
            <div class="border border-gray-200 rounded-xl p-3">
              <div class="text-xs font-bold mb-2">ATOC_Core <span class="text-green-500">●</span></div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Orchestrate agents</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Optimize TAS_total</span>
              </div>
            </div>
            <div class="border border-gray-200 rounded-xl p-3">
              <div class="text-xs font-bold mb-2">ATOC_OP <span class="text-green-500">●</span></div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Social &amp; curation</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Social prediction</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Optimize TAS_social</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Community growth</span>
              </div>
            </div>
            <div class="border border-gray-200 rounded-xl p-3">
              <div class="text-xs font-bold mb-2">ATOC_Onchain <span class="text-green-500">●</span></div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Liquidity mgmt</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">On-chain ops</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Optimize TAS_onchain</span>
              </div>
            </div>
            <div class="border border-gray-200 rounded-xl p-3">
              <div class="text-xs font-bold mb-2">ATOC_Gov <span class="text-green-500">●</span></div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Tune distribution</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Tune reputation</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Adjust contracts</span>
                <span class="px-2 py-0.5 border border-gray-200 text-gray-600 text-[10px] rounded">Governance</span>
              </div>
            </div>
          </div>
          <!-- ATOC description -->
          <p class="text-xs web:text-sm text-grey-8d text-center mt-6">
            {{ t('aboutView.atocDesc') }}
          </p>
        </div>
      </section>

      <!-- First Autonomous Community -->
      <section class="mb-12 text-center">
        <p class="text-sm text-grey-normal">
          {{ t('aboutView.firstCommunity') }}
        </p>
      </section>

      <!-- CTA -->
      <section class="text-center">
        <h2 class="text-xl font-extrabold text-grey-normal mb-6">{{ t('aboutView.createNow') }}</h2>
        <div class="flex flex-col web:flex-row items-center justify-center gap-4">
          <a
            href="https://tagai.fun"
            target="_blank"
            rel="noopener noreferrer"
            class="px-6 py-3 bg-grey-fa rounded-xl text-xs web:text-sm font-medium text-grey-normal hover:bg-orange-light hover:text-orange-normal transition-colors max-w-[260px]"
          >
            {{ t('aboutView.importToken') }}
          </a>
          <a
            href="https://x.com/launchonbnb"
            target="_blank"
            rel="noopener noreferrer"
            class="px-6 py-3 bg-grey-fa rounded-xl text-xs web:text-sm font-medium text-grey-normal hover:bg-orange-light hover:text-orange-normal transition-colors max-w-[260px]"
          >
            {{ t('aboutView.createCommunity') }}
          </a>
        </div>
      </section>
    </div>
  </div>
</template>
