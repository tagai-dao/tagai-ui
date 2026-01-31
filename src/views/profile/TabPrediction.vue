<script setup lang="ts">
    import { ref, reactive, onMounted, computed, watch } from 'vue'
    import { getUserJoinedMarkets, getUserJoinedEventMarkets, getMyPredictRewards, getMyUnclaimablePredictRewards } from '@/apis/api'
    import { GlobalModalType, type BattleData, type Tweet, type EventPredictData, type CurationReward } from '@/types'
    import { useCommunityStore } from '@/stores/community'
    import { handleErrorTip } from '@/utils/notify'
    import { EthWalletState, useAccountStore } from '@/stores/web3'
    import { useModalStore } from '@/stores/common'
    import emitter from '@/utils/emitter'
    import PredictBattleCard from '@/components/common/PredictBattleCard.vue'
    import PredictEventCard from '@/components/common/PredictEventCard.vue'
    import PredictReward from '@/components/profile/PredictReward.vue'
    import { getMarketInfos } from '@/utils/fpmm'
    import { getTokenOnchainInfo } from '@/utils/pump'
    import { useStateStore } from '@/stores/common'
    import { useI18n } from 'vue-i18n'
    
    const { t } = useI18n()
    const comStore = useCommunityStore()
    const accStore = useAccountStore()
    const stateStore = useStateStore()
    const battles = ref<BattleData[]>([])
    const events = ref<EventPredictData[]>([])
    let tweets = reactive<{ [key: string]: Tweet }>({})
    
    // Tab State
    const currentTab = ref<'battle' | 'event'>('battle')
    
    const refreshing = ref(false)
    const loading = ref(false)
    const finished = ref(false)
    
    // 奖励相关状态
    const claimableRewards = ref<CurationReward[]>([])
    const unclaimableRewards = ref<CurationReward[]>([])
    let rewardTabOptions = ['Processing', 'Claimable']
    const rewardType = ref('Processing')
    
    const onRefresh = async () => {
        try {
            if (!accStore.getAccountInfo?.twitterId || !accStore.getAccountInfo?.ethAddr) return
            if (refreshing.value) return
            refreshing.value = true
            finished.value = false // Reset finished state on refresh
            
            if (currentTab.value === 'battle') {
                const data: any = await getUserJoinedMarkets(accStore.getAccountInfo?.twitterId, accStore.getAccountInfo?.ethAddr, 0)
                console.log('battle data', data)
                if (data.battle && data.battle.length > 0) {
                  const marketInfos = await getMarketInfos(data.battle as BattleData[])
                    tweets = Object.assign({}, data.tweets)
                    battles.value = (data.battle as BattleData[]).map(battle => ({
                        ...battle,
                        winner: getWinner(battle),
                        reserveA: marketInfos[battle.marketMaker + '-priceA'],
                        reserveB: marketInfos[battle.marketMaker + '-priceB'],
                        fee: marketInfos[battle.marketMaker + '-fee']
                    }))
                } else {
                    battles.value = []
                }
                if (!data.battle || data.battle.length < 16) {
                    finished.value = true
                }
            } else {
                const data: any = await getUserJoinedEventMarkets(accStore.getAccountInfo?.twitterId, accStore.getAccountInfo?.ethAddr, 0)
                console.log('event data', data)
                if (data && data.length > 0) {
                     const marketInfos = await getMarketInfos(data as EventPredictData[])
                    events.value = (data as EventPredictData[]).map(event => ({
                        ...event,
                        reserveA: marketInfos[event.marketMaker + '-priceA'],
                        reserveB: marketInfos[event.marketMaker + '-priceB'],
                        fee: marketInfos[event.marketMaker + '-fee']
                    }))
                } else {
                    events.value = []
                }
                 if (!data || data.length < 16) {
                    finished.value = true
                }
            }
        } catch (error) {
            handleErrorTip(error)
             // Ensure finished is not falsely set on error if needed, or handle appropriately
             // finished.value = true 
        } finally {
            refreshing.value = false
        }
    }
    
    const onLoad = async () => {
        try {
            if (!accStore.getAccountInfo?.twitterId || !accStore.getAccountInfo?.ethAddr) return
            if (loading.value || finished.value) return
            // Check length based on current tab
            if (currentTab.value === 'battle' && battles.value.length === 0) return;
            if (currentTab.value === 'event' && events.value.length === 0) return;

            loading.value = true
            
            if (currentTab.value === 'battle') {
                const data: any = await getUserJoinedMarkets(accStore.getAccountInfo?.twitterId, accStore.getAccountInfo?.ethAddr, Math.floor((battles.value.length - 1) / 16) + 1) as BattleData[]
                if (data.battle && data.battle.length > 0) {
                  const marketInfos = await getMarketInfos(data.battle as BattleData[])
                  tweets = Object.assign(tweets, data.tweets)
                  battles.value = battles.value.concat((data.battle as BattleData[]).map(battle => ({
                      ...battle,
                      winner: getWinner(battle),
                      reserveA: marketInfos[battle.marketMaker + '-priceA'],
                      reserveB: marketInfos[battle.marketMaker + '-priceB'],
                      fee: marketInfos[battle.marketMaker + '-fee']
                  })))
                }
                if (!data.battle || data.battle.length < 16) {
                    finished.value = true
                }
            } else {
                 const data: any = await getUserJoinedEventMarkets(accStore.getAccountInfo?.twitterId, accStore.getAccountInfo?.ethAddr, Math.floor((events.value.length - 1) / 16) + 1) as EventPredictData[]
                 if (data.battle && data.battle.length > 0) {
                     const marketInfos = await getMarketInfos(data.battle as EventPredictData[])
                     events.value = events.value.concat((data.battle as EventPredictData[]).map(event => ({
                        ...event,
                        reserveA: marketInfos[event.marketMaker + '-priceA'],
                        reserveB: marketInfos[event.marketMaker + '-priceB'],
                         fee: marketInfos[event.marketMaker + '-fee']
                    })))
                 }
                 if (!data.battle || data.battle.length < 16) {
                    finished.value = true
                }
            }

        } catch (error) {
            handleErrorTip(error)
        } finally {
            loading.value = false
        }
    }
    
    // 判断胜利者：与 PredictBattleCard 显示分数使用相同数据源（amounta/amountb 优先），避免显示分数高但 winner 不一致
    const getWinner = (battle: BattleData): 'left' | 'right' | null => {
        const tweetA = tweets[battle.predictAID]
        const tweetB = tweets[battle.predictBID]
        if (tweetA && tweetB) {
            if (tweetA.isSettled && tweetB.isSettled) {
                const amountA = battle.amounta ?? (tweetA.amount ?? 0)
                const amountB = battle.amountb ?? (tweetB.amount ?? 0)
                return amountA > amountB ? 'left' : 'right'
            }
            return null
        }
        return null
    }
    
    const createPredictBattle = () => {
      if (!accStore.getAccountInfo?.twitterId) {
        useModalStore().setModalVisible(true, GlobalModalType.Login)
        return;
      }
      if (accStore.ethConnectState !== EthWalletState.Connected) {
        useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
        return;
      }
    
      useModalStore().setModalVisible(true, GlobalModalType.CreatePredict)
    }

    // 更新奖励列表
    function updateReward() {
      if (!accStore.getAccountInfo?.twitterId) return
      if (rewardType.value === 'Claimable') {
        getMyPredictRewards(accStore.getAccountInfo.twitterId).then(async (list: any) => {
          if (list && list.length > 0) {
            let versions: Record<string, number> = {}
            for (let t of list) {
              versions[t.token] = t.version ?? 2
            }
            const list1 = await getTokenOnchainInfo(list.map((l: any) => l.token), versions)

            for (let t of list) {
              t.price = (list1[t.token]?.price ?? 0) * stateStore.ethPrice;
            }

            claimableRewards.value = list
          } else {
            claimableRewards.value = []
          }
        })
      } else {
        getMyUnclaimablePredictRewards(accStore.getAccountInfo.twitterId).then(async (list: any) => {
          if (list && list.length > 0) {
            let versions: Record<string, number> = {}
            for (let t of list) {
              versions[t.token] = t.version ?? 2
            }
            const list1 = await getTokenOnchainInfo(list.map((l: any) => l.token), versions)

            for (let t of list) {
              t.price = (list1[t.token]?.price ?? 0) * stateStore.ethPrice;
            }

            unclaimableRewards.value = list
          } else {
            unclaimableRewards.value = []
          }
        })
      }
    }

    watch(() => rewardType.value, (val) => {
      updateReward();
    })

    // Watch tab change to refresh data
    watch(currentTab, () => {
        battles.value = []
        events.value = []
        finished.value = false
        onRefresh()
    })
    
    onMounted(async () => {
      await onRefresh()
      updateReward()
      emitter.on('createPredictSuccess', onRefresh);
      emitter.on('claimedPredictReward', updateReward)
    })
    
    </script>
    
    <template>
      <div class="predict-container rounded-t-2xl overflow-hidden flex flex-col h-full">
        <div class="flex-1 overflow-hidden relative bg-gray-50">
             <van-pull-refresh class="h-full overflow-auto"
                v-model="refreshing"
                @refresh="onRefresh"
                :loading-text="$t('loading')"
                :pulling-text="$t('pullToRefreshData')"
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
                    <!-- 奖励领取区域 -->
                    <div class="flex items-center gap-1 px-3 mt-3">
                        <span class="font-normal text-sm">事件预测市场投票奖励</span>
                    </div>
                    <div v-if="accStore.getAccountInfo?.twitterId" class="my-3 gap-2 bg-white rounded-xl py-3 mx-3">
                        <div class="flex justify-start mb-2">
                            <button v-for="tab of rewardTabOptions" :key="tab" class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
                                :class="tab === rewardType ? 'text-gradient bg-gradient-primary' : 'text-grey-normal'"
                                @click="rewardType = tab">{{ tab }}</button>
                        </div>

                        <div v-show="rewardType == 'Claimable'"
                            class="w-full flex gap-3 scroll-pl-3 overflow-x-auto overflow-y-auto no-scroll-bar mt-1 snap-x">
                            <div v-if="claimableRewards.length > 0" class="pb-5 snap-start shrink-0 first:pl-3 last:pr-3"
                                v-for="reward of claimableRewards" :key="reward.tick + 'claimable'">
                                <PredictReward v-if="reward.amount > 0" :reward :can-claim="true" :is-profile="true"/>
                            </div>
                            <div v-else class="w-full flex my-8 justify-center items-center">
                                <img src="~@/assets/images/empty-data.svg" alt="">
                            </div>
                        </div>

                        <div v-show="rewardType == 'Processing'"
                            class="w-full flex gap-3 scroll-pl-3 overflow-x-auto overflow-y-auto no-scroll-bar mt-1 snap-x">
                            <div v-if="unclaimableRewards.length > 0" class="snap-start shrink-0 first:pl-3 last:pr-3"
                                v-for="reward of unclaimableRewards" :key="reward.tick + 'unclaimable'">
                                <PredictReward v-if="reward.amount > 0" :reward :can-claim="false" :is-profile="true"/>
                            </div>
                            <div v-else class="w-full flex my-8 justify-center items-center">
                                <img src="~@/assets/images/empty-data.svg" alt="">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Sub Tabs -->
                    <div class="flex gap-4 px-4 py-3 border-b border-gray-100 bg-white">
                        <button 
                            class="px-4 py-2 rounded-full text-sm font-bold transition-all relative overflow-hidden"
                            :class="currentTab === 'battle' ? 'bg-black text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                            @click="currentTab = 'battle'"
                        >
                            {{ $t('createPredict.tabBattle') }}
                        </button>
                        <button 
                            class="px-4 py-2 rounded-full text-sm font-bold transition-all relative overflow-hidden"
                            :class="currentTab === 'event' ? 'bg-black text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                            @click="currentTab = 'event'"
                        >
                            {{ $t('createPredict.tabEvent') }}
                        </button>
                    </div>
                    
                    <div v-if="(currentTab === 'battle' && battles.length === 0) || (currentTab === 'event' && events.length === 0)" class="w-full flex my-8 justify-center items-center">
                        <img src="~@/assets/images/empty-data.svg" alt="">
                    </div>
                    
                    <template v-if="currentTab === 'battle'">
                         <PredictBattleCard v-for="battle in battles" :key="battle.predictAID + battle.predictBID" :battle="battle" :tweets="tweets" :showCommunity="true" />
                    </template>
                    <template v-else>
                         <PredictEventCard v-for="event in events" :key="event.marketMaker" :market="event" :show-community="true"/>
                    </template>

                </van-list>
            </van-pull-refresh>
        </div>
      </div>
    </template>
    
    <style scoped>
    .predict-container {
      background-color: #f8f9fa;
      min-height: 100%;
    }
    
    /* 隐藏滚动条但保留功能 */
    .overflow-auto::-webkit-scrollbar {
      width: 6px;
    }
    .overflow-auto::-webkit-scrollbar-track {
      background: transparent;
    }
    .overflow-auto::-webkit-scrollbar-thumb {
      background-color: rgba(0,0,0,0.1);
      border-radius: 3px;
    }
    </style>