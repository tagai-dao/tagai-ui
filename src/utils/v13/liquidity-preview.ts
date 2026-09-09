export const afterPairTax=(amount:bigint)=>amount-amount/1000n

/** Matches LiquidityRouter._mint rounding for a seeded component pair. */
export function previewLiquidityAdd(amount:bigint,s:{reserveToken:bigint;reserveAsset:bigint;supply:bigint}){
 if(amount<=0n||s.reserveToken<=0n||s.reserveAsset<=0n||s.supply<=0n)return undefined
 const netToken=afterPairTax(amount)
 const assetUsed=netToken*s.reserveAsset/s.reserveToken
 // The transaction provides a rounded-up ceiling; the router refunds the dust.
 const assetAmount=(netToken*s.reserveAsset+s.reserveToken-1n)/s.reserveToken
 const tokenLp=netToken*s.supply/s.reserveToken,assetLp=assetUsed*s.supply/s.reserveAsset
 return {netToken,assetAmount,assetUsed,lp:tokenLp<assetLp?tokenLp:assetLp}
}

/** Stock input is a spending ceiling; invert the token-side tax without rounding past it. */
export function previewLiquidityAddFromAsset(assetAmount:bigint,s:{reserveToken:bigint;reserveAsset:bigint;supply:bigint}){
 if(assetAmount<=0n||s.reserveToken<=0n||s.reserveAsset<=0n||s.supply<=0n)return undefined
 const netToken=assetAmount*s.reserveToken/s.reserveAsset
 if(netToken<=0n)return undefined
 const tokenAmount=netToken+(netToken-1n)/999n
 const preview=previewLiquidityAdd(tokenAmount,s)
 return preview?{...preview,tokenAmount}:undefined
}
