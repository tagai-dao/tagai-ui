<script setup lang="ts">
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { useTools } from "@/composables/useTools";
import { computed, onMounted, ref } from "vue";
import { formatAddress, formatAmount, formatPrice } from "@/utils/helper";
import { useRouter } from 'vue-router';
import { useCommunityStore } from "@/stores/community";
import { useStateStore } from "@/stores/common";

const router = useRouter()
const comStore = useCommunityStore()
const stateStore = useStateStore()
const props = withDefaults(defineProps<{
    twitterId?: string | null | undefined,
    profileImg: string | null | undefined,
    name: string | null | undefined,
    username: string | null | undefined,
    steemId: string | null | undefined,
    ethAddr: string | null | undefined,
    teleported: boolean,
    followers: number | null | undefined,
    followings: number | null | undefined,
    credit: number | null | undefined,
    creditFactor?: string | null | undefined,
    accountType?: number | null | undefined
}>(), {
    profileImg: '',
    name: '',
    username: '',
    steemId: '',
    ethAddr: '',
    teleported: false,
    credit: 0,
    creditFactor: '',
    accountType: 0
})

const creditJO = ref<any[]>([{
  type: 1,
  value: 0
}, {
  type: 2,
  value: 0
}, {
  type: 3,
  value: 0
}, {
  type: 4,
  value: 0
}, {
  type: 5,
  value: 0
}, {
  type: 6,
  value: 0
}, {
  type: 7,
  value: 0
}])

const creditType = ref([
  "Balance",
  "LP",
  "Net buy"
])

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

function gotoUser() {
    router.push('/user/' + props.username)
}

onMounted(() => {
  if (comStore.currentSelectedCommunity && comStore.currentSelectedCommunity.creditPolicy) {
    if (typeof comStore.currentSelectedCommunity.creditPolicy === 'string') {
    creditJO.value = JSON.parse(comStore.currentSelectedCommunity.creditPolicy)
    } else {
      creditJO.value = comStore.currentSelectedCommunity.creditPolicy
    }
    creditType.value = creditJO.value.map((item: any) => {
      switch (item.type) {
        case 1:
          return comStore.currentSelectedCommunity!.tick + " Balance"
        case 2:
          return comStore.currentSelectedCommunity!.tick + "-LP Balance"
        case 3:
          return "Net buy"
        case 4:
          return "BNB Balance"
        case 5:
          return "IPShare MCap"
        case 6:
          return item.showingName
        case 7:
          return "Donation"
        default:
          return ""
      }
    })
  }
})

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
          <img class="w-9 h-9 object-cover rounded-full cursor-pointer"
              @click.stop="gotoUser"
               @error="replaceEmptyImg"
               :src="profile" alt="">
          <div class="flex-1 flex flex-col gap-y-4px">
            <div class="flex items-end whitespace-nowrap items-center gap-2">
              <span class="font-semibold text-black text-lg">{{(props.name??'').substring(0, 10)}}</span>
            </div>
            <div class="flex items-end whitespace-nowrap items-center gap-2">
              <span class="text-sm italic leading-[16px]">@{{props.username??''.substring(0, 10)}}</span>
              <button v-if="props.accountType !== 1" class="mb-6px" @click="gotoTwitter()">
                <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
              </button>
            </div>
          </div>
        </div>
        <div class="pl-10 mt-2 flex gap-x-4">
          <div class="flex flex-col items-center">
            <span class="font-semibold text-black">{{ props.followers || 0 }}</span>
            <span class="text-sm text-grey-normal">Followers</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="font-semibold text-black">{{ props.followings || 0 }}</span>
            <span class="text-sm text-grey-normal">Followings</span>
          </div>
          <div v-if="props.credit" class="flex flex-col items-center">
            <span class="font-semibold text-black">{{ formatAmount(Math.floor(props.credit || 0)) }}</span>
            <span class="text-sm text-grey-normal">{{ $t('credit') }}</span>
          </div>
        </div>
        <div v-if="props.creditFactor" class="pl-10 my-3 w-full"
            v-for="(factor, index) in typeof props.creditFactor === 'string' ? JSON.parse(props.creditFactor) : props.creditFactor"
            :key="index"
        >
          <div class="flex justify-between">
            <span class="text-sm text-grey-normal">{{ creditType[index] }}</span>
            <span v-if="creditJO[index].type === 5" class="text-sm text-black font-semibold">{{ formatPrice((factor || 0) * stateStore.ethPrice) }}</span>
            <span v-else class="text-sm text-black font-semibold">{{ formatAmount(factor || 0) }}</span>
          </div>
        </div>
        <div v-if="props.ethAddr" class="pl-10 mt-2 text-grey-normal">
          <div class="flex gap-x-2 whitespace-nowrap" @click="onCopy(props.ethAddr ?? '')">
            <span>BNB Address</span>
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
