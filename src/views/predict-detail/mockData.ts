export const mockBattleData = {
  id: 'battle-001',
  title: 'Will Bitcoin hit $100k by end of 2024?',
  tick: 'BTC100K',
  marketMaker: '0x123...abc',
  status: 1, // 1: ongoing, 2: ended
  endTime: Date.now() + 86400000 * 30, // 30 days later
  volume: 1250000,
  liquidity: 500000,
  left: {
    name: 'Yes',
    color: 'red',
    price: 0.65,
    token: 'YES',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    tweet: {
      id: 'tweet-001',
      text: "Bitcoin's momentum is unstoppable! Institutional adoption is at an all-time high. $100k is inevitable. 🚀 #BTC #Crypto",
      author: {
        name: 'CryptoKing',
        handle: '@cryptoking',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=King'
      },
      time: '2h ago'
    }
  },
  right: {
    name: 'No',
    color: 'blue',
    price: 0.35,
    token: 'NO',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bear',
    tweet: {
      id: 'tweet-002',
      text: "Macro headwinds are too strong. Regulatory pressure is mounting. We might see a correction before any major rally. 🐻 #Bitcoin",
      author: {
        name: 'BearWhale',
        handle: '@bearwhale',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bear'
      },
      time: '3h ago'
    }
  }
}

export const mockTransactions = [
  {
    "trader": "0xDB74d42D93450610ebF3334fFE49d003Ead959ef",
    "fpmm": "0x3331728a6992513F4D21409fcD3bD86953Ad546F",
    "outcomeIndex": 0, // 0 for left/red, 1 for right/blue
    "amount": 5642.77,
    "isBuy": 1, // 1 for buy, 0 for sell
    "transTime": 1765983786,
    "transHash": "0xff172513560c135afca29eca8710f324e4275354cd2a1cfd1df57e23996d376e",
    "twitterId": "1679119533997707264",
    "twitterName": "Dastby",
    "twitterUsername": "dastby001",
    "profile": "https://api.dicebear.com/7.x/avataaars/svg?seed=Dastby",
    "followers": 19,
    "followings": 67
  },
  {
    "trader": "0x123...789",
    "fpmm": "0x333...444",
    "outcomeIndex": 1,
    "amount": 2000.50,
    "isBuy": 0,
    "transTime": 1765983000,
    "transHash": "0xabc...def",
    "twitterId": "999888777",
    "twitterName": "CryptoFan",
    "twitterUsername": "cryptofan",
    "profile": "https://api.dicebear.com/7.x/avataaars/svg?seed=Fan",
    "followers": 120,
    "followings": 50
  },
   {
    "trader": "0x456...123",
    "fpmm": "0x333...444",
    "outcomeIndex": 0,
    "amount": 150.00,
    "isBuy": 1,
    "transTime": 1765981000,
    "transHash": "0xdef...123",
    "twitterId": "111222333",
    "twitterName": "Newbie",
    "twitterUsername": "newbie_trader",
    "profile": "https://api.dicebear.com/7.x/avataaars/svg?seed=Newbie",
    "followers": 5,
    "followings": 10
  }
]

export const mockHolders = {
  red: [
    {
      address: "0xDB74...59ef",
      name: "Dastby",
      username: "@dastby001",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dastby",
      amount: 15000.50,
      percentage: 12.5
    },
    {
      address: "0xA1B2...C3D4",
      name: "WhaleAlert",
      username: "@whale_alert",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Whale",
      amount: 50000.00,
      percentage: 42.0
    }
  ],
  blue: [
    {
      address: "0xE5F6...G7H8",
      name: "Skeptic",
      username: "@skeptic_guy",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Skeptic",
      amount: 8000.25,
      percentage: 8.5
    },
    {
      address: "0x9988...7766",
      name: "BlueTeam",
      username: "@blue_team",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Blue",
      amount: 22000.00,
      percentage: 23.1
    }
  ]
}

