<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AuthTwitter from "@/components/login/AuthTwitter.vue";
import {LoginStepType, useLoginStore} from "@/stores/login";
import CreateWallet from "@/components/login/CreateWallet.vue";
import BindAddress from "@/components/login/BindAddress.vue";

const loginStore = useLoginStore()

onMounted(() => {
})
</script>

<template>
  <AuthTwitter v-if="loginStore.loginStep===LoginStepType.AuthTwitter"/>
  <CreateWallet v-if="loginStore.loginStep===LoginStepType.CreateWallet"/>
  <BindAddress v-if="loginStore.loginStep===LoginStepType.BindAddress"/>
</template>
