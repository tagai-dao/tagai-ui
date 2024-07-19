<script setup lang="ts">
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { useTools } from "@/composables/useTools";
import { computed, ref } from "vue";
import { formatAddress } from "@/utils/helper";

const props = withDefaults(defineProps<{
    profileImg: string | null,
    name: string | null,
    username: string | null,
    steemId: string | null,
    ethAddr: string | null,
    teleported: boolean
}>(), {
    profileImg: '',
    name: '',
    username: '',
    steemId: '',
    ethAddr: '',
    teleported: false
})

const profile = computed(() => {
    if (!props.profileImg) return ''
    return props.profileImg?.replace('normal', '200x200')
})

const { onCopy } = useTools()

function gotoTwitter() {
    window.open(
          "https://twitter.com/" + props.username,
          "__blank"
      );
}

function replaceEmptyImg(e: any) {
    e.target.src = emptyAvatar;
}

</script>

<template>
  <div class="h-full">
    <el-popover popper-class="c-popper"
                :teleported="teleported"
                :show-after="500"
                :persistent="true"
                :show-arrow="false">
      <div class="border-1 border-colorA6/30 bg-glass p-20px rounded-14px min-w-240px w-max">
        <div class="flex items-center gap-x-6px">
          <img class="w-38px h-38px object-cover rounded-full border-1 border-colorA6/10"
               @error="replaceEmptyImg"
               :src="profile" alt="">
          <div class="flex-1 flex flex-col gap-y-4px">
            <div class="flex items-end whitespace-nowrap">
              <span class="font-700 text-white leading-16px text-14px">{{name}}</span>
              <span class="text-12px italic leading-16px">@{{username}}</span>
            </div>
          </div>
        </div>
        <div class="pl-40px mt-8px text-colorA6">
          <div class="flex gap-x-10px whitespace-nowrap" @click="onCopy(ethAddr ?? '')">
            <span>ETH Address</span>
            <span class="text-gradient-primary">{{ formatAddress(ethAddr ?? '') }}</span>
          </div>
        </div>

      </div>
      <template #reference>
        <slot name="avatar-img"></slot>
      </template>
    </el-popover>
  </div>
</template>

<style scoped>

</style>
