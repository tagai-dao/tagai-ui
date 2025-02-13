import { ChainConfig, MainToken, SendPubKey, uniswapV2Factory, WETH, uniswapV2InitCode } from "@/config";
import { useAccountStore } from "@/stores/web3";
import nacl from "tweetnacl";
import { hexTou8array, stringToHex, u8arryToHex } from "./helper";
import { sha256 } from "js-sha256";
import base58 from "bs58";
import { ethers } from "ethers";
import steem from "steem";

export const setupNetwork = async (ethereum: any) => {
  const accStore = useAccountStore();
  try {
    const chainInfo = await ethereum.request({
      method: "eth_chainId",
    });
    if (parseInt(chainInfo) == ChainConfig.chainId) {
      accStore.chainId = ChainConfig.chainId;
      return true;
    }

    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: `0x${ChainConfig.chainId.toString(16)}`,
        },
      ],
    });
    accStore.chainId = ChainConfig.chainId;
  } catch (error: any) {
    if (error.code === 4001) return;
    if (error.code === -32002) return;

    try {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${ChainConfig.chainId.toString(16)}`,
            chainName: ChainConfig.name,
            rpcUrls: [ChainConfig.rpc],
            nativeCurrency: MainToken,
            blockExplorerUrls: [ChainConfig.browser],
          },
        ],
      });
      accStore.chainId = ChainConfig.chainId;
      return true;
    } catch (error) {
      console.log("setup chain fail", error);
    }
  }
};

export const getReadOnlyProvider = () => {
  return new ethers.JsonRpcProvider(ChainConfig.rpc);
};

export const getTransactionReceipt = async (hash: string) => {
  const provider = getReadOnlyProvider();
  const tx = await provider.getTransactionReceipt(hash);
  return tx;
};

export const getBalance = async (ethAddr: string) => {
  const provider = getReadOnlyProvider();
  const balance = await provider.getBalance(ethAddr);
  return balance
}

export const createKeypair = async () => {
  return new Promise((resolve) => {
    const pair = nacl.box.keyPair();
    resolve({
      publicKey: u8arryToHex(pair.publicKey),
      privateKey: u8arryToHex(pair.secretKey),
    });
  });
};

export const randomNaclNonce = async () => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return u8arryToHex(nonce);
};

// data is a hex like string
export const box = (data: string) => {
  const pair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const res = nacl.box(hexTou8array(data), nonce, SendPubKey, pair.secretKey);

  return {
    pwd: u8arryToHex(res),
    sendNonce: u8arryToHex(nonce),
    sendPubKey: u8arryToHex(pair.publicKey),
  };
};

export const generateSteemAuth = (pk: string) => {
  const pass = generateBrainKey(pk);
  const account = generateKeys("tagai", pass);
  const keys = {
    postingPub: account.auth.posting,
    postingPri: account.key.posting.posting,
    owner: account.auth.owner,
    active: account.auth.active,
    memo: account.auth.memo,
  };
  return stringToHex(JSON.stringify(keys));
};

export const generateBrainKey = (pk: string) => {
  pk = "0x80" + pk;
  var checksum = sha256(pk);
  checksum = sha256(checksum);
  checksum = checksum.slice(0, 4);
  const private_wif = pk + checksum;
  return "P" + base58.encode(hexTou8array(private_wif));
};

const generateAuth = (user: string, pass: string, type: string) => {
  const key = steem.auth.getPrivateKeys(user, pass, [type]);

  const publicKey = steem.auth.wifToPublic(Object.values(key)[0]);
  if (type == "memo") {
    return {
      key: key,
      auth: publicKey,
    };
  } else {
    return {
      key: key,
      auth: publicKey,
    };
  }
};

const generateKeys = (username: string, pass: string) => {
  const owner = generateAuth(username, pass, "owner");
  const active = generateAuth(username, pass, "active");
  const posting = generateAuth(username, pass, "posting");
  const memo = generateAuth(username, pass, "memo");

  return {
    key: {
      owner: owner.key,
      active: active.key,
      posting: posting.key,
      memo: memo.key,
    },
    auth: {
      owner: owner.auth,
      active: active.auth,
      posting: posting.auth,
      memo: memo.auth,
    },
  };
};

export const getPair = (tokenA: string) => {
  let tokenB = WETH;
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const encoded = new ethers.AbiCoder().encode(['address', 'address'], [token0, token1]);
  const salt = ethers.keccak256(encoded);

  const pairAddress = ethers.getCreate2Address(
    uniswapV2Factory,
    salt,
    uniswapV2InitCode
  )
  return pairAddress;
}