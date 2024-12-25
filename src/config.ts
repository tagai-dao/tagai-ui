export const network: "livenet" | "testnet" | "regtest" = "livenet";

export const BACKEND_API_URL = "https://api.tiptag.social";
// export const BACKEND_API_URL = "http://localhost:3000";

// base main net
export const ChainConfig = {
    name: "Base",
    rpc: 'https://mainnet.base.org/',
    chainId: 8453,
    symbol: 'ETH',
    browser: 'https://basescan.org/',
    decimals: 18,
    multiConfig: {
        rpcUrl: 'https://mainnet.base.org/',
        multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
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
  name: "ETH",
  symbol: "ETH",
  icon: "https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/0x2170Ed0880ac9A755fd29B2688956BD959F933F8/logo.png",
  decimals: 18,
};

// also create coin or create social account will cost 0.00005 ETH
export const FeeAddress = "0x2Cd63b4f45Ee66A4717C92058e0DA5EA6C6cc685";
export const CreateFee = "1000000000000000";
export const ClaimFee = "100000000000000";

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

export const IPShareContract = "0xb6eec8EaEAEd773F47265f743Db607eb547BD2Dc";
export const PumpContract = "0x2752815C81D421d52cA4038c4ab9081A32685b50";

export const WETH = '0x4200000000000000000000000000000000000006';
export const uniswapV2Factory = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6';
export const uniswapV2Router02 = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';
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
