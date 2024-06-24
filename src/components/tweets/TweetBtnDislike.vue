<script setup lang="ts">
import {ref} from "vue";
import {checkAccessToken, newLike} from "@/apis/api";
import {handleServerError} from "@/utils/notify";
import {useTweetTip} from "@/composables/useTweetTips";
import {useStateStore} from "@/stores/common";

const props = defineProps(['post'])
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const { postCondition } = useTweetTip("mint");
const loading = ref(false);

const userDislike = async () => {

}
</script>

<template>
  <button class="flex justify-center items-center gap-2"
          :disabled="loading || post.liked"
          @click.stop="userDislike">
    <i-ep-loading v-if="loading" class="animate-spin w-5 h-5"/>
    <i v-else class="w-5 h-5 min-w-5"
       :class="post.liked ? 'btn-icon-dislike-active' : 'btn-icon-dislike'"></i>
  </button>
</template>

<style scoped>

</style>
