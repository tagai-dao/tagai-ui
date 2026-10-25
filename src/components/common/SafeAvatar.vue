<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TagaiDefaultAvatar from '@/components/common/TagaiDefaultAvatar.vue'
import { normalizeAvatarImageUrl } from '@/utils/avatar'
import { useAgentIdAvatar } from '@/composables/useAgentIdAvatar'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  src?: string | null
  seed?: string | number | null
  alt?: string
  walletAddress?: string | null
}>(), {
  src: '',
  seed: '',
  alt: '',
})

const failed = ref(false)
const agentImage = useAgentIdAvatar(computed(() => props.walletAddress))
const imageSrc = computed(() => agentImage.value || normalizeAvatarImageUrl(props.src))
const showImage = computed(() => Boolean(imageSrc.value) && !failed.value)

watch(imageSrc, () => { failed.value = false })
</script>

<template>
  <img v-if="showImage" :src="imageSrc" :alt="alt" v-bind="$attrs"
    referrerpolicy="no-referrer" @error="failed = true">
  <span v-else-if="agentImage" v-bind="$attrs" class="inline-flex items-center justify-center bg-grey-light-active" role="img" :aria-label="alt || 'Agent ID avatar unavailable'">◌</span>
  <TagaiDefaultAvatar v-else :seed="seed" v-bind="$attrs" />
</template>
