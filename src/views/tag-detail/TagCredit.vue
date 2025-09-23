<script setup lang="ts">
import { getHolderList, getCommunityCredits } from '@/apis/api'
import { useTools } from '@/composables/useTools';
import { useCommunityStore } from '@/stores/community';
import { type CommunityCredit } from '@/types';
import { formatAddress, formatAmount, sleep } from '@/utils/helper';
import { handleErrorTip } from '@/utils/notify';
import { onMounted, ref } from 'vue';
import { useAccount } from '@/composables/useAccount';
import VueApexCharts from 'vue3-apexcharts';
import i18n from '@/lang';

const t = i18n.global.t;

const comStore = useCommunityStore()
const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);
const showCreditChart = ref(false);
const holdingList = ref<CommunityCredit[]>([]);
const { onCopy } = useTools()
const colors = ['#4E79A7',
'#F28E2B',
'#E15759',
'#76B7B2',
'#59A14F',
'#EDC948',
'#B07AA1',  
'#FF9DA7',
'#9C755F',
'#BAB0AC',
'#1F77B4',
'#FF7F0E',
'#2CA02C',
'#D62728',
'#9467BD']

const pieChartOptions = ref({
  chart: {
    type: 'pie',
    width: '100%'
  },
  labels: ['User 1', 'User 2', 'User 3', 'User 4', 'User 5'],
  series: [44, 55, 13, 43, 22],
  colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0'],
  responsive: [{
    breakpoint: 480,
    options: {
      chart: {
        width: '100%'
      },
      legend: {
        position: 'bottom'
      }
    }
  }]
});

async function onRefresh() {
  if (loading.value) return;
  refreshing.value = true;
  finished.value = false;
  try{
    let list: any = await getCommunityCredits(comStore.currentSelectedCommunity!.tick)
    if (list && list.length > 0) {
      holdingList.value = list as CommunityCredit[];
    }
    if (list.length < 30) {
      console.log('finished')
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  console.log('onLoad')
  if (refreshing.value || finished.value || holdingList.value.length == 0) return;
  loading.value = true;
  console.log('onLoad 2')
  try{
    let list: any = await getCommunityCredits(comStore.currentSelectedCommunity!.tick, Math.floor((holdingList.value.length - 1) / 30) + 1);

    if (list && list.length > 0) {
      holdingList.value = holdingList.value.concat(list as CommunityCredit[]);
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

const onUserAvatar = () => {

}

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.3)
  }
  let creditPolicy = comStore.currentSelectedCommunity.creditPolicy
  if (!creditPolicy) {
    pieChartOptions.value = {
      chart: {
        type: 'pie',
        width: '100%'
      },
      labels: [comStore.currentSelectedCommunity?.tick + ' ' + t('balance'), comStore.currentSelectedCommunity?.tick + '-LP ' + t('balance'), "Net buy in 3 days", "BNB Balance", "IPShare MCap"],
      series: [40, 30, 30],
      colors,
      responsive: [{
        breakpoint: 480,
        options: {
          chart: {
            width: '100%'
          },
          legend: {
            position: 'bottom'
          }
        }
      }]
    }
  } else {
    const creditJO = JSON.parse(creditPolicy)
    const labels = creditJO.map((item: any) => {
      switch (item.type) {
        case 1:
          return comStore.currentSelectedCommunity?.tick + ' ' + t('balance')
        case 2:
          return comStore.currentSelectedCommunity?.tick + '-LP ' + t('balance')
        case 3:
          return "Net buy in 3 days"
        case 4:
          return "BNB Balance"
        case 5:
          return "IPShare MCap"
        case 6: 
          return item.showingName
        case 7:
          return 'Donation'
        default:
          return ''
      }
    })
    pieChartOptions.value = {
      chart: {
        type: 'pie',
        width: '100%'
      },
      labels,
      series: creditJO.map((item: any) => item.ratio * 100),
      colors,
      responsive: [{
        breakpoint: 480,
        options: {
          chart: {
            width: '100%'
          },
          legend: {
            position: 'bottom'
          }
        }
      }]
    }
  }
  onRefresh()
})
</script>

<template>
  <!-- <div class="flex justify-end mb-2 mr-2">
    <img class="w-6 h-6 cursor-pointer" @click="showCreditChart = true" src="~@/assets/icons/icon-pie-chart.svg" alt="">
  </div> -->
  <div class="bg-white rounded-2xl p-3" v-if="comStore.currentSelectedCommunity?.tick">
    <div class="grid grid-cols-8 gap-x-2 web:grid-cols-9 text-h5 h-10 items-center">
      <span class="col-span-3 web:col-span-3 pl-8">{{ $t('account') }}</span>
      <span class="col-span-3 web:col-span-3">{{ $t('address') }}</span>
      <span class="col-span-2 web:col-span-3 text-right flex justify-end items-center cursor-pointer gap-1"
        @click="showCreditChart = true">
        {{ $t('credit') }}
        <img class="w-4 h-4" 
        src="~@/assets/icons/icon-warning-gray.svg" alt="">
      </span>
    </div>
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
        @load="onLoad"
      >
        <div
          class="grid grid-cols-8 web:grid-cols-9 gap-x-2 h-8 items-center text-h4"
          v-for="(holder, i) of holdingList"
          :key="i"
        >
          <div class="col-span-3 truncate flex items-center gap-1">
            <span class="min-w-4">{{ i + 1 }}</span>
            <UserAvatar
              :profile-img="holder.profile"
              :name="holder.twitterName"
              :username="holder.twitterUsername"
              :followers="holder.followers"
              :followings="holder.followings"
              :eth-addr="holder.ethAddr"
              :credit="holder.credit"
              :steem-id="''"
              :credit-factor="holder.creditFactor"
          :teleported="true"
        >
          <template #avatar-img>
            <img
              v-if="holder.profile"
              class="w-5 h-5 min-w-5 rounded-full cursor-pointer bg-color2A"
              @click.stop="onUserAvatar"
              :src="holder.profile"
              alt=""
            />
            <img
              v-else
              class="w-5 h-5 min-w-5 rounded-full cursor-pointer bg-color2A"
              @click.stop="onUserAvatar"
              src="~@/assets/icons/icon-default-avatar.svg"
              alt=""
            />
          </template>
        </UserAvatar>
            <span class="truncate font-mono cursor-pointer">{{ holder.twitterName }}</span>
          </div>
          <span @click.stop="onCopy(holder.ethAddr ?? '')" class="col-span-3 cursor-pointer">{{ formatAddress(holder.ethAddr) }}</span>
          <span class="col-span-2 web:col-span-3 text-right">{{ formatAmount(holder.credit) }}</span>
        </div>
      </van-list>
    </van-pull-refresh>
    <el-dialog v-model="showCreditChart"
          class="max-w-[500px] rounded-[20px]"
          width="90%" :show-close="false" align-center destroy-on-close>
          <div class="flex flex-col items-center py-4 w-full">
            <h3 class="text-xl font-bold mb-4">{{ t('credit') }}</h3>
            <VueApexCharts
              type="pie"
              :options="pieChartOptions"
              :series="pieChartOptions.series"
              class="w-full"
            />
            <p class="text-gray-600 text-center mt-4 px-4">
              {{ t('community.creditDescription') }}
            </p>
          </div>
      </el-dialog>
  </div>
</template>

<style scoped></style>


