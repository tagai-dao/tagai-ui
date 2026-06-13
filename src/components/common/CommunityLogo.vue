<script setup lang="ts">
import { computed } from 'vue'
import { getCommunityLogoUrl } from '@/utils/communityLogo'

type LogoSize = 'lg' | 'md' | 'sm' | 'xs'

const props = withDefaults(defineProps<{
  logo?: string | null
  size?: LogoSize
  showAudio?: boolean
  shadow?: boolean
}>(), {
  size: 'lg',
  showAudio: false,
  shadow: true,
})

const SIZE_CONFIG: Record<LogoSize, { container: string; img: string }> = {
  lg: {
    container: 'w-20 h-20 min-w-20 min-h-20 rounded-2xl',
    img: 'rounded-2xl',
  },
  md: {
    container: 'w-10 h-10 min-w-10 min-h-10 rounded-xl',
    img: 'rounded-xl',
  },
  sm: {
    container: 'w-7 h-7 min-w-7 min-h-7 rounded',
    img: 'rounded',
  },
  xs: {
    container: 'w-8 h-8 min-w-8 min-h-8 rounded-lg',
    img: 'rounded-lg',
  },
}

const logoSrc = computed(() => getCommunityLogoUrl(props.logo))
const sizeClass = computed(() => SIZE_CONFIG[props.size])
</script>

<template>
  <div
    class="bg-grey-light-active flex items-center justify-center relative overflow-hidden"
    :class="[
      sizeClass.container,
      shadow ? 'shadow-tag-logo' : '',
    ]"
  >
    <img
      v-if="logoSrc"
      class="w-full h-full"
      :class="sizeClass.img"
      :src="logoSrc"
      alt=""
    >
    <slot v-else name="fallback" />
    <img v-if="showAudio" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
    <slot />
  </div>
</template>
