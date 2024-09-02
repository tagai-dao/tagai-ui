<script setup lang="ts">
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { useTools } from "@/composables/useTools";
import { computed, onMounted, reactive, ref } from "vue";
import { formatAddress } from "@/utils/helper";
import { ethers } from "ethers";
import { handleErrorTip } from "@/utils/notify";
import { checkEthUsed } from "@/apis/api";

const props = withDefaults(defineProps<{
    twitterId?: string | null | undefined,
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
      <div class="border-1 border-grey-light-active bg-grey-light p-5 rounded-2xl min-w-[240px] w-max">
        <div v-if="!props.username || props.username?.length == 0" class="flex items-center justify-center my-20px gap-x-1">
            Address not registed
        </div>
        <div v-else class="flex items-center gap-x-1">
          <img class="w-9 h-9 object-cover rounded-full"
               @error="replaceEmptyImg"
               :src="profile" alt="">
          <div class="flex-1 flex flex-col gap-y-4px">
            <div class="flex items-end whitespace-nowrap">
              <span class="font-semibold text-black text-lg">{{(props.name??'').substring(0, 10)}}</span>
              <span class="text-sm italic leading-[16px]">@{{props.username??''.substring(0, 10)}}</span>
              <button class="mb-6px" @click="gotoTwitter()">
                <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
              </button>
            </div>
          </div>
        </div>
        <div class="pl-10 mt-2 text-grey-normal">
          <div class="flex gap-x-2 whitespace-nowrap" @click="onCopy(props.ethAddr ?? '')">
            <span>ENULS Address</span>
            <span class="text-gradient bg-gradient-primary">{{ formatAddress(props.ethAddr ?? '') }}</span>
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
