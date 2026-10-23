<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'sidebar' | 'menu' }>(), { variant: 'menu' })
// Enable only after the subdomain has passed DNS / HTTPS acceptance.
const enabled = import.meta.env.VITE_AGENT_ID_ATLAS_ENABLED === 'true'
</script>

<template>
  <a
    v-if="enabled"
    href="https://agent-id.tagai.fun/"
    target="_blank"
    rel="noopener noreferrer"
    title="Agent ID ATLAS"
    :class="variant === 'sidebar'
      ? 'flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg hover:bg-surface-2 mb-2 text-content'
      : 'flex gap-2 items-center px-3 py-2 rounded hover:bg-surface-2 text-content'"
  >
    <svg class="shrink-0" :class="variant === 'sidebar' ? 'w-6 h-6 desk:mr-3' : 'w-4 h-4'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3"/>
      <circle cx="8" cy="10" r="2"/><path d="M5 16c0-3 6-3 6 0M14 9h4m-4 4h4"/>
    </svg>
    <span :class="variant === 'sidebar' ? 'hidden desk:inline text-h4' : ''">Agent ID ATLAS</span>
    <span v-if="variant === 'menu'" aria-hidden="true">↗</span>
  </a>
</template>
