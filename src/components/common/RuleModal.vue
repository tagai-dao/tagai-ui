<script setup lang="ts">

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
      TagAI Launchpad: <span class="text-green-34">No presale</span>, <span class="text-blue-32">no team allocation - equal opportunity</span>
      for all participants.
    </div>
    <ul class="leading-6 flex flex-col gap-3">
      <li>
        1：15% of tokens are distributed for social rewards, incentivizing content creation and community engagement.
      </li>
      <li>
        2：65% of tokens are allocated via a bonding curve to raise initial liquidity.
      </li>
      <li>
        3：Once 20 BNB is raised, the liquidity pool (20 BNB + 20% tokens) will be added to PancakeSwap, and LP tokens will be burned (liquidity locked).
      </li>
      <li>
        4：Coin Deployer and Blink creators will receive 1% of transaction fees from trades.
      </li>
    </ul>
  </div>
</template>

<style scoped>

</style>
