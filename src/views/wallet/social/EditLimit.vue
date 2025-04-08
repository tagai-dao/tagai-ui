<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { ref } from "vue";

const socialAccountModalStore = useSocialAccountModalStore()
const availableBalance = ref(0)

</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ socialAccountModalStore.editTokenInfo }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-2">
        <label for="docs" class="leading-6 text-lg">{{$t('profileView.creditLimit')}}:</label>
        <div class="border-b-[1px] border-grey-e6 leading-6 flex">
          <input class="flex-1 text-h3"
                 v-model="availableBalance" type="number"/>
          <span class="text-orange-normal">trans</span>
        </div>
        <div class="border-b-[1px] border-grey-e6 leading-6 flex">
          <input class="flex-1 text-h3"
                 v-model="availableBalance" type="number"/>
          <span class="text-orange-normal">day</span>
        </div>
      </div>
      <button class="h-10 w-full bg-orange-normal rounded-full text-white text-h5 mt-5">
        {{$t('confirm')}}
      </button>
    </div>
  </div>
</template>

<style scoped>

</style>
