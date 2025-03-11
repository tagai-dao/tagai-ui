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
    <template v-if="$i18n.locale==='en'">
      <div class="text-h5 leading-6 mt-4 mb-2">
        TagAI Launchpad: <span class="text-green-34">No presale</span>, <span class="text-blue-32">no team allocation - equal opportunity</span>
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
          3：Once 10 ETH is raised, the liquidity pool (10 ETH + 15% tokens) will be added to Uniswap, and LP tokens will be burned (liquidity locked).
        </li>
        <li>
          4：Coin Deployer and Blink creators will receive 1% of transaction fees from trades.
        </li>
      </ul>
    </template>
    <template v-if="$i18n.locale==='zh'">
      <div class="text-h5 leading-6 mt-4 mb-2">
        TagAI Launchpad: <span class="text-green-34">无预售，</span>
        <span class="text-blue-32">无需团队分配 </span>
        - 所有参与者均有平等机会。
      </div>
      <ul class="leading-6 flex flex-col gap-3">
        <li>
          1：15%的代币用于社交奖励，激励内容创作和社区参与。
        </li>
        <li>
          2：70%的代币通过债券曲线分配，以提高初始流动性。
        </li>
        <li>
          3：一旦筹集到10个ETH，流动性池（10个ETH + 15%的代币）将被添加到Uniswap，并且LP代币将被销毁（流动性锁定）。
        </li>
        <li>
          4：Coin Deployer 或 Blink 创建者将从交易中获得 1% 的交易费。
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>

</style>
