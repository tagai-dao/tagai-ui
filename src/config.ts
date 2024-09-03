export const network: "livenet" | "testnet" | "regtest" = "livenet";

export const BACKEND_API_URL = "https://enuls-api.tiptag.social";
// export const BACKEND_API_URL = "http://localhost:3000";

// base main net
export const ChainConfig = {
    name: "ENULS",
    rpc: 'https://evmapi.nuls.io',
    chainId: 119,
    symbol: 'ENULS',
    browser: 'https://basescan.org/',
    decimals: 18,
    multiConfig: {
        rpcUrl: 'https://evmapi.nuls.io',
        multicallAddress: '0x383870Ae4E834155192cEce2fb5B0528CE0790E9',
        interval: 3000
    }
}


export const SPACE_STATE = {
  1: 'scheduled',
  2: 'live',
  3: 'ended',
  4: 'canceled'
}

export const MainToken = {
  name: "ENULS",
  symbol: "ENULS",
  icon: "https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/0x2170Ed0880ac9A755fd29B2688956BD959F933F8/logo.png",
  decimals: 18,
};

// also create coin or create social account will cost 0.00005 ETH
export const FeeAddress = "0x06Deb72b2e156Ddd383651aC3d2dAb5892d9c048";
export const CreateFee = "5000000000000000000";
export const ClaimFee = "500000000000000000";

export const TotalSupply = 1000000000;
export const SocialSupply = 150000000;
export const BondingCurveSupply = 700000000;
export const ListSupply = 150000000;

export const BondEthMessage = JSON.stringify(
  {
    project: "tiptag",
    method: "bond-eth",
  },
  null,
  4
);

export const RegisterSteemMessage = JSON.stringify(
  {
    project: "tiptag",
    method: "generate-social-account",
  },
  null,
  4
);

export const IPShareContract = "0xe1b9E17d79340eC40C56F08d94b92a8775E8088B";
export const PumpContract = "0x585FFb68bC784eB51dbc6f524231216c096cE547";

export const WETH = '0x217dffF57E3b855803CE88a1374C90759Ea071bD';
export const uniswapV2Factory = '0x7bf960B15Cbd9976042257Be3F6Bb2361E107384';
export const uniswapV2Router02 = '0x3653d15A4Ed7E9acAA9AC7C5DB812e8A7a90DF9e';
export const uniswapV2InitCode = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'

export const Ether = BigInt(1e18);

export const SendPubKey = new Uint8Array([
  197, 251, 61, 64, 103, 59, 66, 126, 109, 154, 9, 122, 8, 175, 171, 78, 84, 46,
  68, 151, 75, 141, 239, 205, 114, 11, 116, 116, 135, 39, 207, 48,
]);

// vp consume
export const VP_CONSUME = Object.freeze({
    RETWEET: 5,
    LIKE: 3
});
// op consume
export const OP_CONSUME = Object.freeze({
    POST: 200,
    QUOTE: 200,
    RETWEET: 5,
    REPLY: 50,
    LIKE: 3
});

export const MAX_OP = 2000;
export const MAX_VP = 200;
export const OP_RECOVER_DAY = 3;
export const VP_RECOVER_DAY = 3;

export const TwitterLoginCode = {
  success: 1,
  accountMismatch: 2,
  notRegisterEth: 3,
  twitterHasRegistered: 4,
  notRegisterTwitter: 5,
  paramsIssue: 6,

  authExpired: 9,
  authError: 10,
  unknown: 11,
};
/**
 * ignore steem id's post
 * only showing steem link
 */
export const IgnoreAuthor = [
  "greattranslatcn",
  "democretard",
  "Mydoglucky2",
  "Lawrenc09874431",
  "1180358936249032704",
  "1485658668259770370",
  "1443781057703145473",
  "903140569685270528",
  "1596918985609601024",
  "1628853473193369600",
  "1639196064275382274",
  "1661652520207536128",
  "1062560079847682048",
  "1608018167049355265",
];

const graphView =
  "http://146.190.44.174:8000/subgraphs/name/donut/bitip/graphql?query=%23%0A%23+Welcome+to+The+GraphiQL%0A%23%0A%23+The+GraphiQL+is+an+in-browser+tool+for+writing%2C+validating%2C+and%0A%23+testing+GraphQL+queries.%0A%23%0A%23+Type+queries+into+this+side+of+the+screen%2C+and+you+will+see+intelligent%0A%23+typeaheads+aware+of+the+current+GraphQL+type+schema+and+live+syntax+and%0A%23+validation+errors+highlighted+within+the+text.%0A%23%0A%23+GraphQL+queries+typically+start+with+a+%22%7B%22+character.+Lines+that+start%0A%23+with+a+%23+are+ignored.%0A%23%0A%23+An+example+GraphQL+query+might+look+like%3A%0A%23%0A%23+++++%7B%0A%23+++++++field%28arg%3A+%22value%22%29+%7B%0A%23+++++++++subField%0A%23+++++++%7D%0A%23+++++%7D%0A%23%0A%23+Keyboard+shortcuts%3A%0A%23%0A%23++Prettify+Query%3A++Shift-Ctrl-P+%28or+press+the+prettify+button+above%29%0A%23%0A%23+++++Merge+Query%3A++Shift-Ctrl-M+%28or+press+the+merge+button+above%29%0A%23%0A%23+++++++Run+Query%3A++Ctrl-Enter+%28or+press+the+play+button+above%29%0A%23%0A%23+++Auto+Complete%3A++Ctrl-Space+%28or+just+start+typing%29%0A%23%0A";
