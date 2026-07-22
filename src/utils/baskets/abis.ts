import { parseAbi } from 'viem'

const POOL_KEY = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'
const LEG_ROUTE = `(uint8 venue,${POOL_KEY} v4Pool,uint24 v3Fee)`

export const basketRegistryAbi = parseAbi([
  'function basketCount() view returns (uint256)',
  'function basketAt(uint256 index) view returns (address)',
  'function basketCreator(address basket) view returns (address)',
  'function basketCreatedAt(address basket) view returns (uint64)',
  'function basketVersion(address basket) view returns (uint32)',
  'function isBasket(address basket) view returns (bool)',
])

export const basketTokenAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function effectiveSupply() view returns (uint256)',
  'function assetCount() view returns (uint256)',
  'function assetAt(uint256 index) view returns (address asset,uint16 targetWeightBps,uint256 activeReserve)',
  `function assetRouteAt(uint256 index) view returns (${LEG_ROUTE})`,
  'function basketFeeBps() view returns (uint16)',
  'function creatorShareBps() view returns (uint16)',
  'function creatorPayout() view returns (address)',
  'function launcherPayout() view returns (address)',
  'function engine() view returns (address)',
  'function lastRebalanceAt() view returns (uint64)',
  'function feeReserveWeth() view returns (uint256)',
  'function pendingCreatorFees() view returns (uint256)',
  'function pendingLauncherFees() view returns (uint256)',
  'function pendingFrontendFees(address) view returns (uint256)',
  'function claimableHolderFees(address) view returns (uint256)',
  'function claimHolderFeesFor(address holder) returns (uint256)',
  'function claimFrontendFeesFor(address frontend) returns (uint256)',
  'function claimCreatorFees() returns (uint256)',
  'function claimLauncherFees() returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
])

export const basketHookAbi = parseAbi([
  `function createBasket(bytes32 userSalt,(string name,string symbol,address creator,uint16 basketFeeBps,uint16 creatorShareBps,address[] constituentAssets,${LEG_ROUTE}[] constituentRoutes,uint16[] targetWeights) p) returns (address basket)`,
  'event BasketCreated(address indexed basket,address indexed creator,uint32 indexed version,bytes32 salt)',
])

export const basketSwapRouterAbi = parseAbi([
  'function buyExactUsdg(address basket,uint256 usdgIn,uint256 minBasketOut,bytes hookData,address recipient) returns (uint256 basketOut)',
  'function sellExactBasket(address basket,uint256 basketIn,uint256 minUsdgOut,bytes hookData,address recipient) returns (uint256 usdgOut)',
  `function createAndBuyExactUsdg(bytes32 userSalt,(string name,string symbol,address creator,uint16 basketFeeBps,uint16 creatorShareBps,address[] constituentAssets,${LEG_ROUTE}[] constituentRoutes,uint16[] targetWeights) createParams,uint256 usdgIn,uint256 minBasketOut,bytes hookData,address recipient) returns (address basket,uint256 basketOut)`,
  'event BasketCreatedAndBought(address indexed basket,address indexed creator,address indexed recipient,bytes32 userSalt,uint256 usdgIn,uint256 basketOut)',
])

export const rebalanceExecutorAbi = parseAbi([
  'error InvalidBasket()',
  'error OnlyBasketCreator()',
  'error RebalanceNotNeeded()',
  'error RebalanceCooldown()',
  'error RebalanceOutOfTolerance()',
  'error RebalanceNavLoss()',
  'error OracleUnavailable()',
  'error SlippageExceeded()',
  'error PartialFill()',
  'error WrongPool()',
  'error InvalidLimits()',
  'function CALLER_CONTROLLED_SLIPPAGE() view returns (bool)',
  `function quoteAssetToWeth(${LEG_ROUTE} route,address asset,uint256 amount) view returns (uint256)`,
  `function quoteWethToAsset(${LEG_ROUTE} route,address asset,uint256 amount) view returns (uint256)`,
  'function rebalance(address basket,uint256[] minWethOut,uint256[] minAssetOut) returns (bool executed,uint256 navBefore,uint256 navAfter)',
])

export const basketFeeAuctionAbi = parseAbi([
  'function availableAuctionEth() view returns (uint256)',
  'function quoteSpot(uint256 ethIn) view returns (uint256)',
  'function minAuctionEth() view returns (uint256)',
  'function maxAuctionEth() view returns (uint256)',
  'function cooldownSeconds() view returns (uint64)',
  'function lastAuctionAt() view returns (uint64)',
  'function nextAuctionId() view returns (uint256)',
  'function activeAuctionId() view returns (uint256)',
  'function activeAuctionEth() view returns (uint256)',
  'function auctions(uint256) view returns (uint256 ethAmount,uint256 initialBid,uint256 highestBid,address highestBidder,uint64 startTime,uint64 endTime,bool settled)',
  'function availableBidTokens(address) view returns (uint256)',
  'function claimableEth(address) view returns (uint256)',
  'function createAuction(uint256 maxInitialBid) returns (uint256 auctionId)',
  'function placeBid(uint256 auctionId,uint256 newTotalBid)',
  'function settleAuction(uint256 auctionId)',
  'function withdrawBidTokens(uint256 amount,address recipient)',
  'function claimEth(address recipient)',
])

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
])

export const v4QuoterAbi = [{
  inputs: [{
    name: 'params', type: 'tuple', components: [
      { name: 'poolKey', type: 'tuple', components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ] },
      { name: 'zeroForOne', type: 'bool' },
      { name: 'exactAmount', type: 'uint128' },
      { name: 'hookData', type: 'bytes' },
    ],
  }],
  name: 'quoteExactInputSingle',
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const

export const v3QuoterAbi = [{
  inputs: [{
    name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
  }],
  name: 'quoteExactInputSingle',
  outputs: [
    { name: 'amountOut', type: 'uint256' },
    { name: 'sqrtPriceX96After', type: 'uint160' },
    { name: 'initializedTicksCrossed', type: 'uint32' },
    { name: 'gasEstimate', type: 'uint256' },
  ],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const
