export const network: "livenet" | "testnet" | "regtest" = "livenet";

export const BACKEND_API_URL = "https://bsc-api.tagai.fun";
// export const BACKEND_API_URL = "http://localhost:3000";

// base main net
export const ChainConfig = {
    name: "BSC",
    rpc: 'https://rpc.48.club',
    chainId: 56,
    symbol: 'BNB',
    browser: 'https://bscscan.com/',
    decimals: 18,
    multiConfig: {
        rpcUrl: 'https://bsc-dataseed.binance.org',
        multicallAddress: '0x41263cba59eb80dc200f3e2544eda4ed6a90e76c',
        interval: 3000
    }
}

export const DefaultCommunityTick = 'no-tick-of-tiptag'

export const SPACE_STATE = {
  1: 'scheduled',
  2: 'live',
  3: 'ended',
  4: 'canceled'
}

export const MainToken = {
  name: "BNB",
  symbol: "BNB",
  icon: "https://assets-cdn.trustwallet.com/blockchains/smartchain/info/logo.png",
  decimals: 18,
};

// also create coin or create social account will cost 0.00005 ETH
export const FeeAddress = "0x06Deb72b2e156Ddd383651aC3d2dAb5892d9c048";
export const CreateFee = "10000000000000000";
export const ClaimFee =  "1000000000000000";

export const TotalSupply = 1000000000;
export const SocialSupply = 150000000;
export const BondingCurveSupply = 650000000;
export const ListSupply = 200000000;

export const BondEthMessage = JSON.stringify(
  {
    project: "tagai",
    method: "bond-account",
  },
  null,
  4
);

export const RegisterSteemMessage = JSON.stringify(
  {
    project: "tagai",
    method: "generate-social-account",
  },
  null,
  4
);

export const IPShareContract1 = "0x7B0ddC305C32AAEbabc0FE372a4460e9903e95D0";
export const IPShareContract2 = "0x24328DccA1bA54EeE82e2993F021802e64290486";
export const PumpContract1 = "0xa77253Ac630502A35A6FcD210A01f613D33ba7cD";
export const PumpContract2 = "0x3DC52C69C3C8be568372E16d50E9F3FEc796610c";
export const PumpContract3 = "0xc9FaA3c05a5178C380d9C28Edffa38d90D606F22";
export const PumpContract4 = "0x0476571a77Cc8Fc28796935Cf173c265F2021448";

export const WETH = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const uniswapV2Factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const uniswapV2Router02 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const uniswapV2InitCode = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
export const wrappedUniswapV2ForTagAI = '0x4cA57c64DFe1cF1be977093C75f9d9cdd1DD2E10'

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
