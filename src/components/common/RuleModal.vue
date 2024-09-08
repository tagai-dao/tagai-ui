<script setup lang="ts">

import {GlobalModalType} from "@/types";
</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">Rule</span>
      <img class="cursor-pointer"
           @click="$emit('onClose')"
           src="~@/assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="text-h5 leading-6 mt-4 mb-2">
      Each coin on tiptag is a <span class="text-green-34">fair-launch</span> with <span class="text-blue-32">no presale</span> and
      <span class="text-orange-normal">no team allocation</span>.
    </div>
    <ul class="leading-6 flex flex-col gap-3">
      <li>
        step 1：buy the Tagcoin on the bonding curve
      </li>
      <li>
        step 2：post or like tweet, host or participate in Twitter Space, get TagCoin
      </li>
      <li>
        step 3：if someone trades, 1% transaction fee flows to the deployer
      </li>
      <li>
        step 4：once someone transacts with a Blink on twitter, 1% of the transaction fee flows to the Blink publisher.
      </li>
      <li>
        step 5：30000 $NULS of liquidity is then deposited in pheasantswap and burned
      </li>
    </ul>
  </div>
</template>

<style scoped>

</style>
