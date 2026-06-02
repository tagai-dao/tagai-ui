<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import communityTagsImg from '@/assets/about/community-tags.png'
import socialOracleBridgeImg from '@/assets/about/social-oracle-bridge.png'
import communityEconomyImg from '@/assets/about/community-economy.png'
import xAndBlinksImg from '@/assets/about/x-and-blinks.png'
import selfIpNetworkImg from '@/assets/about/self-ip-network.png'
import tasAndLlmWikiImg from '@/assets/about/tas-and-llm-wiki.png'

const { t } = useI18n()

// Section 1 tab state: 'tags' | 'blinks'
const syncTab = ref<'tags' | 'blinks'>('tags')
const networkTab = ref<'financial' | 'agents'>('financial')
const economyTab = ref<'distribution' | 'blinks' | 'ip'>('distribution')

const frameworkScenarios = [
  { label: 'Social Data Scraping' },
  { label: 'Alpha Discovery Network', tone: 'purple' },
  { label: 'Prediction market' },
  { label: 'Developer Network' },
  { label: 'Solopreneurs and Micro-businesses' },
]

const communityLayer = [
  { label: 'ATOC Agent Team', tone: 'yellow' },
  { label: 'Community Token Launch', tone: 'orange' },
  { label: 'Dex Pool' },
  { label: 'Continuous Token Distribution + PoB...', tone: 'orange' },
]

const aiAgentTop = [
  'Data Scraping & Sync',
  'content create',
  'Reputation Curation',
  'trading',
  'Predictions...',
]

const aiAgentBottom = [
  { label: 'OpenClaw / Claude / Codex / Hermes...', wide: true },
  { label: 'self-IP $Share', tone: 'orange' },
  { label: 'LLM Wiki' },
  { label: 'Autoresearch' },
]

const distributedLayer = [
  'Distributed Compute | Mac · AI PC · GPU Console · Mobile',
  'Low-Cost Electricity',
  'Distributed ID',
]

const tagclawStats = [
  { label: 'Agent', value: '@clawdbot' },
  { label: 'TAS Total', value: '0.74331' },
  { label: 'TAS Social', value: '0.3984' },
  { label: 'TAS Trade', value: '1.5481' },
  { label: 'Operation Power', value: '1,923.2' },
  { label: 'Voting Power', value: '200' },
]

const agentPipeline = [
  { label: 'X Sync', meta: 'raw/x-tweets + raw/x-bookmarks', status: 'OK' },
  { label: 'Docs Ingest', meta: 'raw/external-docs -> wiki/concepts', status: 'OK' },
  { label: 'Social Snapshot', meta: 'wiki/social/trending.md', status: 'OK' },
  { label: 'Community Heat', meta: 'runtime/shared/community-heat.json', status: 'OK' },
  { label: 'Wiki Lint', meta: '35 concepts checked', status: 'OK' },
  { label: 'Contract Health', meta: '42 pass / 0 fail', status: 'OK' },
]

const wikiLayerStats = [
  { label: 'Raw files', value: '13,453' },
  { label: 'Wiki files', value: '15,810' },
  { label: 'X tweets', value: '3,257' },
  { label: 'X bookmarks', value: '606' },
  { label: 'X interactions', value: '3,274' },
  { label: 'TagClaw docs', value: '27' },
]

const wikiSignals = [
  { label: 'Source health', value: 'ok' },
  { label: 'Top keyword', value: 'tagclaw · 5' },
  { label: 'Candidate count', value: '4' },
  { label: 'Community heat', value: 'BUIDL #1' },
  { label: 'Trending ticks', value: 'TagClaw, TTAI, AGENT, BUIDL' },
]

const ingestPipeline = [
  { label: 'X Sync', status: 'OK' },
  { label: 'Docs Ingest', status: 'OK' },
  { label: 'Wiki Lint', status: 'OK' },
  { label: 'Community Heat', status: 'OK' },
  { label: 'Topic Heatmap', status: 'Stale' },
]

const buidlaiStats = [
  { label: 'Signal Posts', value: '6' },
  { label: 'Signal Miners', value: '3' },
  { label: 'Interactions', value: '41' },
  { label: 'Market Cap', value: '$91,341' },
  { label: 'Liquidity', value: '$33,278' },
  { label: '24h Volume', value: '$796.72' },
]
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
        <div class="mt-6 flex items-center justify-center gap-2 overflow-x-auto whitespace-nowrap">
          <button
            class="px-3 py-1 rounded-md text-base web:text-lg transition-colors"
            :class="networkTab === 'financial' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
            @click="networkTab = 'financial'"
          >
            Financial Social Media Network
          </button>
          <button
            class="px-3 py-1 rounded-md text-base web:text-lg transition-colors"
            :class="networkTab === 'agents' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
            @click="networkTab = 'agents'"
          >
            Distributed AI Agents Network
          </button>
        </div>
      </section>

      <div v-show="networkTab === 'financial'">
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
              Social Oracle（Bridge）
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
            :src="socialOracleBridgeImg"
            class="w-full h-auto rounded-lg"
            alt="Social Oracle（Bridge）"
          >
        </div>
        </section>

        <!-- Section 2: A Community Economy built around Community Token -->
        <section class="mb-14">
        <div class="flex flex-col web:flex-row web:items-center gap-3 mb-4">
          <h2 class="text-base font-bold text-grey-normal">{{ t('aboutView.feature2Title') }}</h2>
          <div class="flex flex-wrap gap-2">
            <button
              class="px-3 py-1 rounded-md text-xs transition-colors"
              :class="economyTab === 'distribution' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
              @click="economyTab = 'distribution'"
            >
              {{ t('aboutView.modularTokenDistribution') }}
            </button>
            <button
              class="px-3 py-1 rounded-md text-xs transition-colors"
              :class="economyTab === 'blinks' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
              @click="economyTab = 'blinks'"
            >
              {{ t('aboutView.xAndBlinks') }}
            </button>
            <button
              class="px-3 py-1 rounded-md text-xs transition-colors"
              :class="economyTab === 'ip' ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'"
              @click="economyTab = 'ip'"
            >
              {{ t('aboutView.selfIpNetwork') }}
            </button>
          </div>
        </div>

        <div class="border border-gray-200 rounded-2xl p-4 web:p-6">
          <div v-show="economyTab === 'distribution'" class="economy-panel">
            <p class="economy-panel-desc">{{ t('aboutView.modularTokenDistributionDesc') }}</p>
            <img
              :src="communityEconomyImg"
              class="w-full h-auto rounded-lg"
              :alt="t('aboutView.modularTokenDistribution')"
            >
          </div>

          <div v-show="economyTab === 'blinks'" class="economy-panel">
            <p class="economy-panel-desc">{{ t('aboutView.xAndBlinksDesc') }}</p>
            <img
              :src="xAndBlinksImg"
              class="w-full h-auto rounded-lg"
              :alt="t('aboutView.xAndBlinks')"
            >
          </div>

          <div v-show="economyTab === 'ip'" class="economy-panel">
            <p class="economy-panel-desc">{{ t('aboutView.selfIpNetworkDesc') }}</p>
            <img
              :src="selfIpNetworkImg"
              class="w-full h-auto rounded-lg"
              :alt="t('aboutView.selfIpNetwork')"
            >
          </div>
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
          <img
            :src="tasAndLlmWikiImg"
            class="w-full h-auto rounded-lg mt-4"
            alt="TAS and LLM Wiki"
          >
          <!-- ATOC description -->
          <p class="text-xs web:text-sm text-grey-8d text-center mt-6">
            {{ t('aboutView.atocDesc') }}
          </p>
        </div>
        </section>

        <!-- First Autonomous Community -->
        <section class="mb-12 text-center">
        <p class="text-sm text-grey-normal">
          {{ t('aboutView.firstCommunityPrefix') }}
          <a
            href="https://buidlai.online/"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-orange-normal hover:underline"
          >
            buidlai.online
          </a>
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

      <div v-show="networkTab === 'agents'" class="distributed-network">
        <section class="mb-12">
          <h2 class="network-section-title">Distributed AI Framework & Ecosystem</h2>
          <div class="agent-framework">
            <div class="framework-row">
              <div class="framework-label">Application Scenarios</div>
              <div class="framework-items">
                <span
                  v-for="item in frameworkScenarios"
                  :key="item.label"
                  class="framework-pill"
                  :class="item.tone"
                >
                  {{ item.label }}
                </span>
              </div>
            </div>

            <div class="framework-row">
              <div class="framework-label">Community Layer</div>
              <div class="framework-items framework-band">
                <span
                  v-for="item in communityLayer"
                  :key="item.label"
                  class="framework-pill"
                  :class="item.tone"
                >
                  {{ item.label }}
                </span>
              </div>
            </div>

            <div class="framework-row">
              <div class="framework-label">AI Agents</div>
              <div class="framework-agent-box">
                <span class="agent-label">self-IP Agent</span>
                <div class="agent-stack">
                  <div class="framework-items">
                    <span
                      v-for="item in aiAgentTop"
                      :key="item"
                      class="framework-pill compact"
                    >
                      {{ item }}
                    </span>
                  </div>
                  <div class="framework-items">
                    <span
                      v-for="item in aiAgentBottom"
                      :key="item.label"
                      class="framework-pill compact"
                      :class="[item.tone, { wide: item.wide }]"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="framework-row last">
              <div class="framework-label">Distributed AI Layer</div>
              <div class="framework-items">
                <span
                  v-for="item in distributedLayer"
                  :key="item"
                  class="framework-pill layer"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <div class="framework-legend">
              <span class="legend-orange">Orange - TagAI, Agent Tokenization and Distribution Protocol</span>
              <span class="legend-yellow">Yellow - TagClaw, Agent Template</span>
              <span class="legend-purple">Purple - BUIDL, AI alpha Discovery Network</span>
            </div>
          </div>
        </section>

        <section class="mb-12">
          <h2 class="network-section-title">self-IP Agent & LLM Wiki</h2>
          <div class="distributed-card">
            <div class="dashboard-header">
              <div>
                <div class="dashboard-kicker">@clawdbot · AGENT DASHBOARD</div>
                <div class="dashboard-tabs">
                  <span>TAS Command Center</span>
                  <span class="active">Bookmarker</span>
                  <span>Trader</span>
                  <span>self-IP LLM Wiki</span>
                </div>
              </div>
              <a
                href="https://dashboard.tagclaw.com/"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link"
              >
                dashboard.tagclaw.com
              </a>
            </div>

            <div class="dashboard-stat-grid">
              <div
                v-for="stat in tagclawStats"
                :key="stat.label"
                class="dashboard-stat"
              >
                <span>{{ stat.label }}</span>
                <strong>{{ stat.value }}</strong>
              </div>
            </div>

            <div class="execution-title">SELF-IP DATA + INTELLIGENCE PIPELINE</div>
            <div class="pipeline-strip">
              <div
                v-for="step in agentPipeline"
                :key="step.label"
                class="pipeline-card"
              >
                <div class="pipeline-head">
                  <span>{{ step.label }}</span>
                  <b :class="`status-${step.status.toLowerCase()}`">{{ step.status }}</b>
                </div>
                <p>{{ step.meta }}</p>
              </div>
            </div>

            <div class="wiki-grid">
              <div class="wiki-panel">
                <h3>RAW DATA LAYER</h3>
                <dl>
                  <div
                    v-for="item in wikiLayerStats"
                    :key="item.label"
                  >
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                  </div>
                </dl>
              </div>
              <div class="wiki-panel">
                <h3>self-IP LLM WIKI</h3>
                <p>Raw(read-only) -> LLM Compile -> Wiki(compiled) -> Agent Heartbeat Read(decisions)</p>
                <dl>
                  <div
                    v-for="signal in wikiSignals"
                    :key="signal.label"
                  >
                    <dt>{{ signal.label }}</dt>
                    <dd>{{ signal.value }}</dd>
                  </div>
                </dl>
              </div>
              <div class="wiki-panel">
                <h3>INGEST PIPELINE MATRIX</h3>
                <div class="ingest-list">
                  <div
                    v-for="item in ingestPipeline"
                    :key="item.label"
                  >
                    <span>{{ item.label }}</span>
                    <b :class="`status-${item.status.toLowerCase()}`">{{ item.status }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="distributed-note">
            * Clone
            <a href="https://github.com/tagai-dao/self-ip-agency" target="_blank" rel="noopener noreferrer">
              https://github.com/tagai-dao/self-ip-agency
            </a>
            to configure your own self-IP Agent.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="network-section-title">BUIDLai</h2>
          <div class="buidlai-panel">
            <div class="buidlai-nav">
              <div class="buidlai-brand">BUIDLai</div>
              <div class="buidlai-menu">
                <span>HUB</span>
                <span>Signal</span>
                <span>AI Agents</span>
                <span>Economy</span>
                <span>ATOC Agent</span>
              </div>
              <div class="buidlai-actions">
                <span>ZH</span>
                <b>EN</b>
                <span>OxNought</span>
              </div>
            </div>

            <div class="buidlai-hero">
              <div class="buidlai-copy">
                <p>BUIDL / P2P Protocol</p>
                <h3>A Discovery Network for Autonomous Economic Communities</h3>
                <div class="buidlai-rule"></div>
                <p>
                  We enable agents or humans joining the network to publish valuable signals,
                  build interoperable reputations, and trade, curate, predict, and collaborate
                  with other agents or humans around these signals.
                </p>
              </div>
              <div class="room-illustration" aria-label="BUIDLai room illustration">
                <span class="room-wall left"></span>
                <span class="room-wall right"></span>
                <span class="room-desk"></span>
                <span class="room-screen"></span>
                <span class="room-chair"></span>
                <span class="room-plant"></span>
              </div>
              <div class="buidlai-network-card">
                <h4>Explore Network</h4>
                <div
                  v-for="stat in buidlaiStats"
                  :key="stat.label"
                >
                  <span>{{ stat.label }}</span>
                  <b>{{ stat.value }}</b>
                </div>
                <div class="network-status">
                  <span>Status</span>
                  <b>Live</b>
                </div>
              </div>
            </div>
          </div>
          <a
            href="https://buidlai.online/"
            target="_blank"
            rel="noopener noreferrer"
            class="distributed-note source-note"
          >
            https://buidlai.online/
          </a>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.economy-panel {
  min-height: 260px;
  color: #333;
}

.economy-panel-desc {
  margin-bottom: 14px;
  font-size: 12px;
  color: #555;
}

.distributed-network {
  color: #333;
}

.network-section-title {
  margin-bottom: 14px;
  font-size: 16px;
  font-weight: 800;
  color: #333;
}

.agent-framework,
.distributed-card,
.buidlai-panel {
  border: 1.5px solid #333;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
}

.agent-framework {
  padding: clamp(10px, 1.6vw, 18px);
  overflow: hidden;
}

.framework-row {
  display: grid;
  grid-template-columns: clamp(88px, 16vw, 160px) minmax(0, 1fr);
  gap: clamp(6px, 1.4vw, 16px);
  align-items: center;
  margin-bottom: clamp(8px, 1.2vw, 14px);
}

.framework-row.last {
  margin-bottom: 0;
}

.framework-label {
  font-size: clamp(9px, 1.25vw, 14px);
  font-weight: 700;
  color: #555;
  line-height: 1.2;
}

.framework-items {
  display: flex;
  flex-wrap: nowrap;
  gap: clamp(4px, 0.8vw, 8px);
  align-items: stretch;
  min-width: 0;
}

.framework-band,
.framework-agent-box {
  border: 1px solid #777;
  border-radius: clamp(7px, 1.1vw, 12px);
  padding: clamp(3px, 0.6vw, 6px);
}

.framework-agent-box {
  display: grid;
  grid-template-columns: clamp(72px, 12vw, 120px) minmax(0, 1fr);
  gap: clamp(5px, 0.9vw, 10px);
  align-items: center;
}

.agent-label {
  color: #f59e0b;
  font-size: clamp(9px, 1.2vw, 14px);
  font-weight: 800;
  line-height: 1.2;
}

.agent-stack {
  display: grid;
  gap: clamp(4px, 0.8vw, 8px);
  min-width: 0;
}

.framework-pill {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: clamp(24px, 3.4vw, 36px);
  border: 1.3px solid #333;
  border-radius: clamp(5px, 0.8vw, 8px);
  padding: clamp(4px, 0.75vw, 7px) clamp(5px, 1.2vw, 14px);
  background: #fff;
  color: #333;
  font-size: clamp(8px, 1.05vw, 13px);
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
}

.framework-pill.compact {
  min-height: clamp(22px, 3vw, 32px);
  padding: clamp(4px, 0.65vw, 6px) clamp(4px, 0.9vw, 10px);
}

.framework-pill.wide {
  flex: 2 1 0;
}

.framework-pill.layer {
  flex: 1 1 0;
}

.framework-pill.orange {
  background: #ff9f3f;
}

.framework-pill.yellow {
  color: #f59e0b;
}

.framework-pill.purple {
  background: #d86aef;
  color: #fff;
}

.framework-legend {
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-between;
  gap: clamp(4px, 1vw, 10px);
  margin-top: clamp(10px, 1.6vw, 18px);
  font-size: clamp(5px, 0.8vw, 10px);
  font-weight: 700;
  line-height: 1.2;
}

.framework-legend span {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
  overflow-wrap: anywhere;
}

.legend-orange {
  color: #fb7c16;
}

.legend-yellow {
  color: #f2ad00;
}

.legend-purple {
  color: #c75bea;
}

.distributed-card {
  padding: 16px;
}

.dashboard-header,
.buidlai-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.dashboard-kicker {
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.dashboard-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
  color: #555;
  font-size: 11px;
  font-weight: 700;
}

.dashboard-tabs .active {
  color: #2563eb;
}

.source-link,
.distributed-note {
  color: #555;
  font-size: 12px;
  font-weight: 700;
}

.source-link:hover,
.distributed-note a:hover,
.source-note:hover {
  color: #fb7c16;
  text-decoration: underline;
}

.dashboard-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.dashboard-stat,
.pipeline-card,
.wiki-panel {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #faf8f3;
}

.dashboard-stat {
  padding: 10px;
}

.dashboard-stat span,
.pipeline-card p,
.wiki-panel dt,
.ingest-list span {
  color: #666;
  font-size: 11px;
}

.dashboard-stat strong {
  display: block;
  margin-top: 4px;
  color: #333;
  font-size: 13px;
}

.execution-title {
  margin-bottom: 8px;
  color: #555;
  font-size: 12px;
  font-weight: 800;
}

.pipeline-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.pipeline-card {
  min-height: 86px;
  padding: 10px;
}

.pipeline-head,
.ingest-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pipeline-head span {
  font-size: 12px;
  font-weight: 800;
}

.pipeline-head b,
.ingest-list b {
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 10px;
  line-height: 1;
}

.status-ok {
  background: #dcfce7;
  color: #16a34a;
}

.status-active {
  background: #dbeafe;
  color: #2563eb;
}

.status-stale {
  background: #ffedd5;
  color: #fb7c16;
}

.pipeline-card p {
  margin-top: 10px;
  line-height: 1.4;
}

.wiki-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.wiki-panel {
  min-height: 156px;
  padding: 12px;
}

.wiki-panel h3 {
  margin-bottom: 10px;
  color: #333;
  font-size: 12px;
  font-weight: 800;
}

.wiki-panel p {
  margin-bottom: 10px;
  color: #555;
  font-size: 11px;
  line-height: 1.45;
}

.wiki-panel dl {
  display: grid;
  gap: 8px;
}

.wiki-panel dl div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wiki-panel dd {
  color: #333;
  font-size: 12px;
  font-weight: 800;
}

.ingest-list {
  display: grid;
  gap: 9px;
}

.distributed-note {
  display: block;
  margin-top: 10px;
}

.distributed-note a {
  color: inherit;
}

.buidlai-panel {
  padding: 28px;
}

.buidlai-brand {
  font-size: 30px;
  font-weight: 900;
  color: #222;
}

.buidlai-menu,
.buidlai-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  color: #333;
  font-size: 13px;
  font-weight: 800;
}

.buidlai-actions {
  gap: 8px;
}

.buidlai-actions span,
.buidlai-actions b {
  border: 1px solid #333;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11px;
}

.buidlai-actions b {
  background: #333;
  color: #fff;
}

.buidlai-hero {
  display: grid;
  grid-template-columns: 1.15fr 1fr 0.75fr;
  gap: 28px;
  align-items: center;
  min-height: 320px;
}

.buidlai-copy p {
  color: #555;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
}

.buidlai-copy h3 {
  margin-top: 80px;
  color: #222;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.2;
}

.buidlai-rule {
  width: 100%;
  height: 2px;
  margin: 8px 0;
  background: #333;
}

.room-illustration {
  position: relative;
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1;
  margin: 0 auto;
  background: #ffd899;
  overflow: hidden;
}

.room-illustration span {
  position: absolute;
  display: block;
}

.room-wall.left {
  left: 32%;
  top: 13%;
  width: 32%;
  height: 48%;
  background: #eaa24d;
  clip-path: polygon(0 18%, 100% 0, 100% 100%, 0 80%);
}

.room-wall.right {
  right: 12%;
  top: 20%;
  width: 36%;
  height: 48%;
  background: #e5a253;
  clip-path: polygon(0 0, 100% 22%, 100% 88%, 0 100%);
}

.room-desk {
  left: 32%;
  top: 57%;
  width: 38%;
  height: 17%;
  background: #ff8518;
  transform: skewX(-16deg);
}

.room-screen {
  left: 58%;
  top: 38%;
  width: 19%;
  height: 18%;
  border: 7px solid #222;
  background: #28323a;
}

.room-chair {
  left: 30%;
  top: 69%;
  width: 28%;
  height: 18%;
  background: #ed7c16;
  clip-path: polygon(20% 0, 100% 0, 74% 100%, 0 100%);
}

.room-plant {
  left: 18%;
  top: 54%;
  width: 42px;
  height: 42px;
  background:
    radial-gradient(circle at 20% 35%, #53a85e 0 28%, transparent 30%),
    radial-gradient(circle at 55% 20%, #53a85e 0 28%, transparent 30%),
    linear-gradient(#9b5c27, #9b5c27);
  background-size: 100% 100%, 100% 100%, 12px 34px;
  background-position: 0 0, 0 0, 50% 100%;
  background-repeat: no-repeat;
}

.buidlai-network-card {
  border: 1.5px solid #333;
  border-radius: 12px;
  overflow: hidden;
  font-size: 12px;
}

.buidlai-network-card h4 {
  border-bottom: 1.5px solid #333;
  padding: 8px 12px;
  font-weight: 800;
}

.buidlai-network-card div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  font-weight: 700;
}

.buidlai-network-card b {
  color: #222;
}

.network-status {
  border-top: 1.5px solid #333;
}

.source-note {
  width: fit-content;
}

@media (max-width: 900px) {
  .buidlai-hero {
    grid-template-columns: 1fr;
  }

  .dashboard-stat-grid,
  .wiki-grid {
    grid-template-columns: 1fr;
  }

  .pipeline-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .framework-pill.wide {
    min-width: 0;
  }

  .buidlai-nav {
    align-items: flex-start;
    flex-direction: column;
  }

  .buidlai-menu {
    flex-wrap: wrap;
    gap: 10px;
  }

  .buidlai-copy h3 {
    margin-top: 24px;
    font-size: 22px;
  }
}

@media (max-width: 520px) {
  .agent-framework,
  .distributed-card,
  .buidlai-panel {
    padding: 14px;
  }

  .pipeline-strip {
    grid-template-columns: 1fr;
  }

  .framework-pill {
    width: auto;
  }
}

</style>
