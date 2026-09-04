<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TagaiDefaultAvatar from '@/components/common/TagaiDefaultAvatar.vue'
import { normalizeAvatarImageUrl } from '@/utils/avatar'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  src?: string | null
  seed?: string | number | null
  alt?: string
}>(), {
  src: '',
  seed: '',
  alt: '',
})

const failed = ref(false)
const imageSrc = computed(() => normalizeAvatarImageUrl(props.src))
const showImage = computed(() => Boolean(imageSrc.value) && !failed.value)

watch(() => props.src, () => { failed.value = false })
</script>

<template>
  <img v-if="showImage" :src="imageSrc" :alt="alt" v-bind="$attrs"
    referrerpolicy="no-referrer" @error="failed = true">
  <TagaiDefaultAvatar v-else :seed="seed" v-bind="$attrs" />
</template>
