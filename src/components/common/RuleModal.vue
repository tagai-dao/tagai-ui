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
      TipTag Launchpad: <span class="text-green-34">No presale</span>, <span class="text-blue-32">no team allocation - equal opportunity</span>
      for all participants.
    </div>
    <ul class="leading-6 flex flex-col gap-3">
      <li>
        1：15% of tokens are distributed for social rewards, incentivizing content creation and community engagement.
      </li>
      <li>
        2：70% of tokens are allocated via a bonding curve to raise initial liquidity.
      </li>
      <li>
        3：Once 10 ETH is raised, the liquidity pool (30000 $NULS + 15% tokens) will be added to Uniswap, and LP tokens will be burned (liquidity locked).
      </li>
      <li>
        Step 4：Once someone transacts with a Blink on twitter, 1% of the transaction fee flows to the Blink publisher.
      </li>
      <li>
        Step 5：30000 $NULS of liquidity is then deposited in PheasantSwap and burned.
      </li>
    </ul>
  </div>
</template>

<style scoped>

</style>
