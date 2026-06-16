import { parseUnits } from "viem";
export const network: "livenet" | "testnet" | "regtest" = "livenet";


/**
 * 后端 API 地址。本地调试登录时必须连本地 tiptag-api：
 * .env 里的 Privy App 是 dev 配套，生产后端验证不了它签发的 token
 * （否则 /auth/login 返回 301 "User not found"）。
 * 在 .env.local 写 VITE_APP_BACKEND_API_URL=http://localhost:5001 覆盖，
 * 不写则默认生产地址（生产构建行为不变）。
 */
export const BACKEND_API_URL = import.meta.env.VITE_APP_BACKEND_API_URL || "https://bsc-api.tagai.fun";
/** 前端站点根 URL，用于 commerce blink 链接 */
export const SITE_URL = "https://tagai.fun";
export const COMMERCE_SITE_URL = `${SITE_URL}/commerce/`;
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org';
// base main net
export const ChainConfig = {
    name: "BSC",
    rpc: BSC_RPC_URL,
    chainId: 56,
    symbol: 'BNB',
    browser: 'https://bscscan.com/',
    decimals: 18,
    swapUrl: 'https://pancakeswap.finance/v2/add/BNB/0x32ef878D527d860339818571E8DA17005110f04E?chain=bsc&persistChain=1',
    multiConfig: {
        rpcUrl: BSC_RPC_URL,
        multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
        interval: 3000
    }
}

export const PrivyConfig = {
    appId: import.meta.env.VITE_APP_PRIVY_APP_ID,
    clientId: import.meta.env.VITE_APP_PRIVY_CLIENT_ID,
    redirectUri: import.meta.env.VITE_APP_PRIVY_REDIRECT_URI,
    logoutRedirectUri: import.meta.env.VITE_APP_PRIVY_LOGOUT_REDIRECT_URI,
    loginRedirectUri: import.meta.env.VITE_APP_PRIVY_LOGIN_REDIRECT_URI,
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
export const RegisterSteemFee = '1000000000000000';
export const ClaimFee =  "500000000000000";

export const TotalSupply = 1000000000;
export const SocialSupply = 150000000;
export const BondingCurveSupply = 650000000;
export const ListSupply = 200000000;

/** 展示市值走 GeckoTerminal FDV，不使用 API 绑定池 / 链上池价格 */
export const ThirdPartyMarketCapTicks = ['SPCXB'] as const

export const usesThirdPartyMarketCap = (tick?: string | null) =>
  !!tick && (ThirdPartyMarketCapTicks as readonly string[]).includes(tick.toUpperCase())

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
export const zero = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const IPShareContract1 = "0x7B0ddC305C32AAEbabc0FE372a4460e9903e95D0";
export const IPShareContract2 = "0x24328DccA1bA54EeE82e2993F021802e64290486";
export const IPShareContract3 = "0x95450AaD4Cc195e03BB4791B7f6f04aC6D9BA922";

export const PumpContract1 = "0xa77253Ac630502A35A6FcD210A01f613D33ba7cD"; // for test: ex ttat
export const PumpContract2 = "0x3DC52C69C3C8be568372E16d50E9F3FEc796610c"; // fix bug
export const PumpContract3 = "0xc9FaA3c05a5178C380d9C28Edffa38d90D606F22"; // fix bug
export const PumpContract4 = "0x0476571a77Cc8Fc28796935Cf173c265F2021448"; // fix bug
export const PumpContract5 = "0x2cAbfDE43f93422fFb070f0Fa03d2951dbBC7749"; // ixo: user who has less reputation can't buy
export const PumpContract6 = "0x201308B193bC0Aa81Ac540A7D3B3ADb530a39861"; // for import tokens
export const PumpContract7 = "0x3E75E2db40E7cc9C7d7869Fc2d97eDAb01724212"; // PCS V4 hook
export const PumpContract8 = "0x88d495228E831b01D8Ae6d62f9633cBcC6d27De2"
/** Pump9：Nutbox + HourlyTickCalculator + PCS V4，内盘开放交易 */
export const PumpContract9 = "0x327a473c763bcf0d60CCd6811F832332939110D5"
/** ImportHelper：导入外部代币到 Nutbox 社区 */
export const ImportHelper = "0xF346A700830633bB27a46fC1e7eAAE49F593A4c6"
export const TokenImplementation9 = "0x69B1B0635220e5f16A36Ad44c3B2B1FB9ca65e16"
export const PUMP9_VERSION = 9

// PancakeSwap V4 Infinity
/** v7/v8 已部署池使用的 Hook */
export const TipTagSwapHook = "0xF815dB0fbeafED4C719F65E41dEC9C50fb357896";
/** v9 新部署池使用的 Hook */
export const TipTagSwapHook9 = "0x78443e75aD3D70DAAab0De33d2D5Dea0cBae0cC1";
export const HourlyTickCalculator = "0x6cCEC02E7D371FED954D7D16eCb7F2f57cccF54d"
export const LinearCalculator = "0x5114966657Bd6209B47aa16eaa4EAfbbC9595ec0"
export const LinearTimeCalculator = "0xc76e00e150e13EC95514E9a52Ab0314c7faE8207"
export const NutboxCommittee = "0xe10F967DD356504EDB731612789D0D0f0ba2929f"
export const PCSUniversalRouter = "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB";
export const PCSPermit2 = "0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768";
export const PCSCLPoolManager = "0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b";
export const PCSCLQuoter = "0xd0737C9762912dD34c3271197E362Aa736Df0926";
export const PCSCLPositionManager = "0x55f4c8abA71A1e923edC303eb4fEfF14608cC226";
export const PCSVault = "0x238a358808379702088667322f80aC48bAd5e6c4";

export const PopUp = "0xA3951BcEc6018CAAE34dCEA722858a7dc3177Ed2";

export const WETH = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const uniswapV2Factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const uniswapV2Router02 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const uniswapV2InitCode = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
export const wrappedUniswapV2ForTagAI = '0x4cA57c64DFe1cF1be977093C75f9d9cdd1DD2E10';
export const wrappedUniswapV2ForTagAI2 = '0x72D353c0469C10F6B769F13b67EEdB2E1F26FB01';

export const ConditionalTokens = '0xAD1a38cEc043e70E83a3eC30443dB285ED10D774';
export const WhiteList = '0xb3A547F535bDc1b20Eb6fd97b9524F893A75708C';
export const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d'
export const USDT ='0x55d398326f99059fF775485246999027B3197955'
export const Oracle = '0x6CCA0a99B608D53c77D12e3e0227fE76F3bc12b4'
export const PredictionMinFee = parseUnits("1", 16);
export const PredictionMaxFee = parseUnits("8", 16);
export const FPMMDeterministicFactory = '0xDDF74905AD9ff90977154DF960E21517f7e11ACA'; // code in tagai-predict-market-maker: main
export const FPMMDeterministicFactoryEvent = '0xB830cF8308eA73DF9dFAc01a6E3CcDd230A1e7Dd'; // code in tagai-predict-market-maker: event
export const FPMMDeterministicFactoryEventV2 = '0x846a7319425471Efdc08dC8c3A7a6032c6b627Cd'; // code in tagai-predict-market-maker: event v2
export const FPMMDeterministicFactoryEventV3 = '0xAd3a25d8A32F160c254DD937BE4C56b338E37096'; // code in tagai-predict-market-maker: event v3
export const OracleDistributor = '0xe63B98dA0c8fbDfE94A08Fc6b5d8797374415F57';   // code in pump-contract: oracle-distribution
export const OracleDistributorV2 = '0xF4c8B8CF5a21478b3bB43C892641C436A7052277';   // code in tagai-predict-market-maker: oracle-distribution v2

export const USD_CONTRACTS: Record<`0x${string}`, string> = {
    '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d': 'USD1',
    '0x55d398326f99059fF775485246999027B3197955': 'USDT'
}

export const Multicall3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
export const CoinPurse = '0x6C818c610F3D9db65f5e0c0838f3F68600b80C85'
export const AIDeployer = '0xf0a27ec9bb8AC28007cB474fC1ea0A9396fe6991'

export const Ether = BigInt(1e18);

export const SendPubKey = new Uint8Array([
  197, 251, 61, 64, 103, 59, 66, 126, 109, 154, 9, 122, 8, 175, 171, 78, 84, 46,
  68, 151, 75, 141, 239, 205, 114, 11, 116, 116, 135, 39, 207, 48,
]);

// vp consume
export const VP_CONSUME = Object.freeze({
    PREDICT_VOTE: 10,
    RETWEET: 5,
    LIKE: 3,
    REPLY: 3
});
// op consume
export const OP_CONSUME = Object.freeze({
    POST: 200,
    QUOTE: 200,
    RETWEET: 5,
    REPLY: 10,
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
  "1608018167049355265"
];