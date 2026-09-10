// Only return translation keys. RPC messages, calldata and addresses must never be UI copy.
export function poolOperationErrorKey(error: unknown): string {
 const messages:string[]=[],codes:unknown[]=[]
 const seen=new Set<unknown>()
 let current:any=error
 while(current&&!seen.has(current)&&seen.size<12){
  seen.add(current)
  if(typeof current==='string'){messages.push(current);break}
  for(const value of [current.name,current.message,current.shortMessage,current.details,current.data?.errorName,typeof current.data==='string'?current.data:null])if(typeof value==='string')messages.push(value)
  codes.push(current.code);current=current.cause
 }
 const text=messages.join(' ')
 if(codes.some(code=>Number(code)===4001)||/UserRejected|user (rejected|denied)|request rejected/i.test(text))return 'v13Operation.cancelled'
 if(/\bExpired\b|0x203d82d8|V13_QUOTE_EXPIRED/i.test(text))return 'v13Operation.expired'
 if(/V13_LIQUIDITY_RATIO_CHANGED/.test(text))return 'v13Page.liquidityRatioChanged'
 // SlippageExceeded() may be nested inside Pancake Infinity WrappedError bytes.
 if(/slippage|8199f5f3|TooLittleReceived|InsufficientOutput|INSUFFICIENT_[AB]_AMOUNT/i.test(text))return 'v13Operation.slippage'
 if(/insufficient (funds|.*balance)|InsufficientBalance|exceeds balance/i.test(text))return 'v13Operation.balance'
 if(/allowance|TransferFromFailed|TRANSFER_FROM_FAILED|SafeERC20FailedOperation|TransferFailed/i.test(text))return 'v13Operation.transfer'
 if(/Wallet or chain changed|Connect a BSC wallet|Wallet unavailable|chain mismatch/i.test(text))return 'v13Operation.wallet'
 if(/Pool closed/i.test(text))return 'v13Page.closed'
 if(/Pool has no liquidity|InvalidPool|V13_POOL_MISMATCH/i.test(text))return 'v13Operation.pool'
 if(/InvalidAmount|Invalid LP amount|Amount is too small/i.test(text))return 'v13Operation.amount'
 if(/network|fetch failed|failed to fetch|timeout|timed out|HTTP request failed|RPC unavailable/i.test(text))return 'v13Operation.network'
 return 'v13Operation.failed'
}
