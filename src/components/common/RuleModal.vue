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
      Fair launch: Every coin on TipTag has a <span class="text-green-34">fair start</span> with <span class="text-blue-32">no presale</span> or
      <span class="text-orange-normal">team allocation</span>, giving everyone an equal opportunity.
    </div>
    <ul class="leading-6 flex flex-col gap-3">
      <li>
        Step 1：Buy coins using the bonding curve, where the price increases as more coins are bought.
      </li>
      <li>
        Step 2：Earn coins by posting, liking tweets, hosting, or joining Twitter Spaces. Active engagement is rewarded.
      </li>
      <li>
        Step 3：When someone trades, 1% of the transaction fee goes to the person who launched the coin.
      </li>
      <li>
        Step 4：If the trade involves a Blink (special X post), 1% of the fee goes to the Blink publisher.
      </li>
      <li>
        Step 5：10 $ETH and 15% of the coins are added to Uniswap for liquidity, and the LP tokens are burned to reduce supply and support the price.
      </li>
    </ul>
  </div>
</template>

<style scoped>

</style>
