<script setup lang="ts">
import { computed } from 'vue'
import avatar from '@/assets/icons/icon-default-avatar-v2.png'
import { defaultAvatarBackground } from '@/utils/defaultAvatar'

const props = defineProps<{
  seed?: string | number | null
  label?: string
}>()

const background = computed(() => defaultAvatarBackground(props.seed))
</script>

<template>
  <span
    class="tagai-default-avatar"
    :style="{ background }"
    role="img"
    :aria-label="label || 'TagAI default avatar'"
  >
    <img :src="avatar" alt="" aria-hidden="true">
  </span>
</template>

<style scoped>
.tagai-default-avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9999px;
  line-height: 0;
}

.tagai-default-avatar img {
  width: 94%;
  height: 94%;
  object-fit: contain;
}
</style>
