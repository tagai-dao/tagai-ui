import { ethers } from 'ethers';
import { aggregate } from '@makerdao/multicall'
import type { ClankerToken } from '@/types';
import { ChainConfig } from '@/config';

export const getTokensInfo = async (tokens: ClankerToken[]) => {
    try {
        let calls = []
        for (let token of tokens) {
            calls.push({
                target: token.pool,
                call: [
                    'slot0()(uint160,int24,uint16,uint160,uint16,uint8,bool)',
                ],
                returns: [
                    [token.token + 'slot0'],
                    [token.token + 'slot1'],
                    [token.token + 'slot2'],
                    [token.token + 'slot3'],
                    [token.token + 'slot4'],
                    [token.token + 'slot5'],
                    [token.token + 'slot6']
                ]
            })
            calls.push({
                target: token.token,
                call: [
                    'totalSupply()(uint256)',
                ],
                returns: [
                    [token.token + 'supply', (val: any) => val / 1e18]
                ]
            })
        }
        const res = await aggregate(calls, ChainConfig.multiConfig)
        const infos = res.results.transformed;
        tokens.forEach(token => {
            let price: any = (BigInt(infos[token.token + 'slot0']) ** 2n) * 1000000000000n / (2n ** 192n)
            token.price = (price).toString() / 1e12
            token.totalSupply = infos[token.token + 'supply']
            token.marketCap = token.totalSupply! * token.price!
        })
        return tokens
    } catch (error) {
        console.error(error);
    }
    return []
} 