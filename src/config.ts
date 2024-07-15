

export const network: "livenet" | "testnet" | "regtest" = 'livenet'

// testnet
// export const TX_BROWSER = 'https://mempool.space/testnet/tx/'
// export const BACKEND_API_URL = 'https://api-test.bitip.social'
export const BACKEND_API_URL = 'http://localhost:3000'
// export const GRAPH_URL = 'https://graph-test.bitip.social/subgraphs/name/donut/bitip'


export const GRAPH_URL = 'https://graph.bitip.social/subgraphs/name/donut/bitip'

// test chain chapel
export const ChainConfig = {
    name: "Chapel",
    rpc: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    chainId: 97,
    symbol: 'BNB',
    browser: 'https://testnet.bscscan.com/',
    decimals: 18,
    multiConfig: {
        rpcUrl: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
        multicallAddress: '0xae11C5B5f29A6a25e955F0CB8ddCc416f522AF5C',
        interval: 3000
    }
}
// merlin main net
// export const ChainConfig = {
//     name: "Merlin-main",
//     rpc: 'https://rpc.merlinchain.io',
//     chainId: 4200,
//     symbol: 'BTC',
//     browser: 'https://scan.merlinchain.io/',
//     decimals: 18,
//     multiConfig: {
//         rpcUrl: 'https://rpc.merlinchain.io',
//         multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
//         interval: 3000
//     }
// }

export const MainToken = {
    name: "BTC",
    symbol: "BTC",
    icon: 'https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/0x2170Ed0880ac9A755fd29B2688956BD959F933F8/logo.png',
    decimals: 18
}

export const BondEthMessage = JSON.stringify({
    project: 'tiptag',
    method: 'bond-eth'
  }, null, 4)

export const TwitterLoginCode = {
    success: 1,
    accountMismatch: 2,
    notRegisterBtc: 3,
    twitterHasRegistered: 4,
    notRegisterTwitter: 5,
    paramsIssue: 6,

    authExpired: 9,
    authError: 10,
    unknown: 11
}
/**
 * ignore steem id's post
 * only showing steem link
 */
export const IgnoreAuthor = [
    'greattranslatcn',
    'democretard',
    'Mydoglucky2',
    'Lawrenc09874431',
    '1180358936249032704',
    '1485658668259770370',
    '1443781057703145473',
    '903140569685270528',
    '1596918985609601024',
    '1628853473193369600',
    '1639196064275382274',
    "1661652520207536128",
    '1062560079847682048',
    '1608018167049355265'
]

const graphView = 'http://146.190.44.174:8000/subgraphs/name/donut/bitip/graphql?query=%23%0A%23+Welcome+to+The+GraphiQL%0A%23%0A%23+The+GraphiQL+is+an+in-browser+tool+for+writing%2C+validating%2C+and%0A%23+testing+GraphQL+queries.%0A%23%0A%23+Type+queries+into+this+side+of+the+screen%2C+and+you+will+see+intelligent%0A%23+typeaheads+aware+of+the+current+GraphQL+type+schema+and+live+syntax+and%0A%23+validation+errors+highlighted+within+the+text.%0A%23%0A%23+GraphQL+queries+typically+start+with+a+%22%7B%22+character.+Lines+that+start%0A%23+with+a+%23+are+ignored.%0A%23%0A%23+An+example+GraphQL+query+might+look+like%3A%0A%23%0A%23+++++%7B%0A%23+++++++field%28arg%3A+%22value%22%29+%7B%0A%23+++++++++subField%0A%23+++++++%7D%0A%23+++++%7D%0A%23%0A%23+Keyboard+shortcuts%3A%0A%23%0A%23++Prettify+Query%3A++Shift-Ctrl-P+%28or+press+the+prettify+button+above%29%0A%23%0A%23+++++Merge+Query%3A++Shift-Ctrl-M+%28or+press+the+merge+button+above%29%0A%23%0A%23+++++++Run+Query%3A++Ctrl-Enter+%28or+press+the+play+button+above%29%0A%23%0A%23+++Auto+Complete%3A++Ctrl-Space+%28or+just+start+typing%29%0A%23%0A'