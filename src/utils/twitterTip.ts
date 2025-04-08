import { getContract } from "./contract";
import type { Community, CreateCommunity, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply, IPShareContract1, IPShareContract2, wrappedUniswapV2ForTagAI } from "@/config";
import { getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4, Ether, ClaimFee } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { useAccountStore } from "@/stores/web3";
