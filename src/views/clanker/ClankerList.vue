<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ListType, type ClankerToken } from '@/types'
import { useClankerStore } from '@/stores/clanker';
import ClankerListItem from '@/components/home/ClankerListItem.vue';
import { getClankerTickers } from '@/apis/api';
import { handleErrorTip } from '@/utils/notify';
import { getTokensInfo } from '@/utils/clanker';
import { useRouter } from 'vue-router';

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const clankerStore = useClankerStore();
const router = useRouter()

const props = defineProps<{
    listType: ListType;
  }>()

async function refresh() {
    try {
        const ticks = await getClankerTickers();
        const res = await getTokensInfo(ticks as [ClankerToken]);
        clankerStore.allClankerTokens = res.sort((a,b) => b.marketCap! - a.marketCap!)
    } catch (error) {
        handleErrorTip(error)
    }
}

async function loadMore() {

}

async function gotoDetail(token: ClankerToken) {
    clankerStore.currentSelectedClanker = token;
    router.push('/clanker/token/' + token.token);
}

onMounted(async () => {
    refresh()
})

</script>
<template>
    <div>
        <van-pull-refresh v-model="refreshing" @refresh="refresh"
                        class="min-h-full"
                        :loading-text="$t('loading')"
                        :lpulling-text="$t('pullToRefreshData')"
                        :loosing-text="$t('releaseToRefresh')">
        <van-list :loading="loading"
                  :finished="finished"
                  :immediate-check="false"
                  :finished-text="$t('noMore')"
                  :offset="50"
                  @load="loadMore">

            <div v-if="clankerStore.allClankerTokens.length == 0 && !loading"
                class="flex justify-center py-6 w-full">
                <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else
                class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
                <ClankerListItem @click="gotoDetail(token)" v-for="token of clankerStore.allClankerTokens" :token :key="token.token!" />
            </div>
        </van-list>
      </van-pull-refresh>
    </div>
</template>

<style lang="scss" scoped>

</style>
