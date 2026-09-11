export function resolveCoinTab(tab: unknown, loggedIn: boolean): 'watchlist' | 'tagCoin' | 'baskets' | 'bStocks' {
  if (tab === 'watchlist') return 'watchlist'
  if (tab === 'tagcoin') return 'tagCoin'
  if (tab === 'baskets') return 'baskets'
  if (tab === 'bstocks') return 'bStocks'
  return loggedIn ? 'watchlist' : 'tagCoin'
}
