<script setup lang="ts">
import { computed } from 'vue'
import { externalSourceLogos, type AccountOrigin } from '@/assets/externalSourceLogos'

const props = defineProps<{
  sources?: string[] | string | null
  accountType?: number | null
  walletType?: number | null
  ethAddr?: string | null
  xCollected?: boolean
  sourceLinks?: Partial<Record<AccountOrigin, string>>
}>()

const labels: Record<AccountOrigin, string> = {
  TAGAI: 'TagAI account',
  X: 'X account',
  FOMO: 'FOMO account',
  GMGN: 'GMGN account',
  PUMP: 'Pump account',
}
const order: AccountOrigin[] = ['TAGAI', 'X', 'FOMO', 'GMGN', 'PUMP']

const origins = computed(() => {
  const values = Array.isArray(props.sources)
    ? props.sources
    : String(props.sources || '').split(',')
  const selected = new Set(values.map(source => source.trim().toUpperCase()))

  if (props.accountType === 0 || props.xCollected) selected.add('X')
  if (props.walletType === 1 && props.ethAddr) selected.add('TAGAI')

  return order.filter(origin => selected.has(origin))
})
</script>

<template>
  <span v-if="origins.length" class="inline-flex shrink-0 items-center gap-0.5">
    <template v-for="origin in origins" :key="origin">
      <a
        v-if="sourceLinks?.[origin]"
        :href="sourceLinks[origin]"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex"
        :aria-label="labels[origin]"
        :title="labels[origin]"
        @click.stop
      >
        <img :src="externalSourceLogos[origin]" :alt="labels[origin]" class="account-origin-logo" />
      </a>
      <span v-else class="inline-flex" :aria-label="labels[origin]" :title="labels[origin]">
        <img :src="externalSourceLogos[origin]" :alt="labels[origin]" class="account-origin-logo" />
      </span>
    </template>
  </span>
</template>

<style scoped>
.account-origin-logo {
  width: 16px;
  height: 16px;
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 9999px;
  background: #fff;
  object-fit: contain;
  padding: 1px;
}
</style>
