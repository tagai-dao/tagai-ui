<script setup lang="ts">
import {applyPureReactInVue} from "veaury";
import LoginWithOAuth from "@/react_app/LoginWithOAuth.jsx";

const ReactLoginWithOAuth = applyPureReactInVue(LoginWithOAuth);

</script>

<template>
  <div class="flex flex-col justify-center min-h-[240px] py-6 px-4">
    <div class="flex flex-col gap-y-[48px]">
      <div class="flex items-center gap-8 justify-center">
        <img class="w-12 min-w-12 object-center object-contain" src="~@/assets/logo.png" alt="">
        <img class="w-10 min-w-10 object-center object-contain" src="~@/assets/icons/icon-login-arrow.svg" alt="">
        <img class="w-8 min-w-8 object-center object-contain" src="~@/assets/icons/icon-x.svg" alt="">
      </div>
      <div class="flex flex-col gap-2">
        <!-- <div>{{$t('loginView.authTwitterTip')}}</div> -->
        <div class="">
          <!-- <el-checkbox :label="$t('loginView.authLikeTip')" v-model="authLike" />
          <el-checkbox :label="$t('loginView.authPostTip')" v-model="authPost" /> -->
        </div>
        <ReactLoginWithOAuth/>
      </div>

      <div class="text-lg text-center text-grey-normal text-weight-bold flex justify-center items-center gap-2">
        Protected by
        <img class="w-22 h-5" src="~@/assets/icons/privy-logo.png" alt="">
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
