<script setup lang="ts">
defineProps<{ name: string; suffix?: string }>()
</script>

<template>
  <span>{{ name }}<span v-if="suffix" class="token-contract-suffix">{{ suffix }}</span></span>
</template>

<style scoped>
.token-contract-suffix {
  display: inline-block;
  margin-left: 0.35em;
  font-size: 0.5em;
  color: color-mix(in srgb, currentColor 80%, black 20%);
  white-space: nowrap;
}
</style>
