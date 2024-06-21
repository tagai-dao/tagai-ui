

export const network: "livenet" | "testnet" | "regtest" = 'livenet'

export const DEFAULT_PROTOCOL_FEE = 0.015;
export const DEFAULT_SUBJECT_FEE = 0.055;
export const DEFAULT_BITIP_FEE = 0;

// testnet
// export const InscriptionMeta = {
//     fee: 2000,
//     dust: 546,
//     size: 200,
//     inviteSize: 15,
//     feeAddress: 'tb1p4q3q0gys5ccmmfhace3jp2lhwfx0jv700egtvewv4nftcy35esfqhh75ry'
// }
// export const BLOCK_STREAM_API_URL = 'https://blockstream.info/testnet/api';
// export const BLOCK_CYPHER_API_URL = 'https://api.blockcypher.com/v1/btc/test3'
// export const BLOCK_MEMEPOOL_API_URL = 'https://mempool.space/testnet/api' 
// export const TX_BROWSER = 'https://mempool.space/testnet/tx/'
export const BACKEND_API_URL = 'https://api-test.bitip.social'
// export const BACKEND_API_URL = 'http://localhost:3100'
// export const GRAPH_URL = 'https://graph-test.bitip.social/subgraphs/name/donut/bitip'


// mainnet
export const InscriptionMeta = {
    fee: 2000,
    dust: 546,
    size: 180,
    inviteSize: 15,
    feeAddress: 'bc1p0h28zu2xg8nuavz9fyuwjz0796clngp3p7qgf7m2qx2rlr4xdcusljc9hx'
}
export const BLOCK_STREAM_API_URL = 'https://blockstream.info/api';
export const BLOCK_CYPHER_API_URL = 'https://api.blockcypher.com/v1/btc/main'
export const BLOCK_MEMEPOOL_API_URL = 'https://mempool.space/api' 
// export const BACKEND_API_URL = 'https://api.bitip.social'
export const TX_BROWSER = 'https://mempool.space/tx/'
export const GRAPH_URL = 'https://graph.bitip.social/subgraphs/name/donut/bitip'



// merlin main net
export const ChainConfig = {
    name: "Merlin-main",
    rpc: 'https://rpc.merlinchain.io',
    chainId: 4200,
    symbol: 'BTC',
    browser: 'https://scan.merlinchain.io/',
    decimals: 18,
    multiConfig: {
        rpcUrl: 'https://rpc.merlinchain.io',
        multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
        interval: 3000
    }
}

// merlin test net
// export const ChainConfig = {
//     name: "Merlin-test",
//     rpc: 'https://testnet-rpc.merlinchain.io',
//     chainId: 686868,
//     symbol: 'BTC',
//     browser: 'https://testnet-scan.merlinchain.io/',
//     decimals: 18,
//     multiConfig: {
//         rpcUrl: 'https://testnet-rpc.merlinchain.io',
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