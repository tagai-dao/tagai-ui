/**
 * Pump9 部署 salt 搜索：
 * - 本地 OZ Clones 预测地址（零 RPC，与 Pump9.predictTokenAddress 一致）
 * - 从 localStorage 的上次 salt 递增搜索
 * - 地址末尾须为 3333；命中后仅 1 次 RPC 查 createdTokens
 */
import { encodeAbiParameters, keccak256 } from 'viem'
import { PumpContract9, TokenImplementation9 } from '@/config'
import { readContract } from './contract'
import { predictDeterministicAddress } from './ozClones'

const SALT_STORAGE_KEY_PREFIX = 'pump9_last_salt_'
const VANITY_SUFFIX = '3333'
const MAX_SEARCH = 500_000

function encodeSaltBytes32(saltNum: bigint): `0x${string}` {
    return (`0x${saltNum.toString(16).padStart(64, '0')}`) as `0x${string}`
}

function addressEndsWithVanity(addr: string): boolean {
    return addr.toLowerCase().endsWith(VANITY_SUFFIX)
}

function getLastSaltNum(deployer: string): bigint {
    const stored = localStorage.getItem(SALT_STORAGE_KEY_PREFIX + deployer.toLowerCase())
    return stored ? BigInt(stored) : 0n
}

function saveLastSaltNum(deployer: string, saltNum: bigint) {
    localStorage.setItem(SALT_STORAGE_KEY_PREFIX + deployer.toLowerCase(), saltNum.toString())
}

/** 与 Pump9.predictTokenAddress(deployer, userSalt) 一致 */
export function predictPump9TokenAddress(
    deployer: `0x${string}`,
    userSalt: `0x${string}`
): `0x${string}` {
    const cloneSalt = keccak256(
        encodeAbiParameters(
            [{ type: 'address' }, { type: 'bytes32' }],
            [deployer, userSalt]
        )
    )
    return predictDeterministicAddress(
        TokenImplementation9 as `0x${string}`,
        cloneSalt,
        PumpContract9 as `0x${string}`
    )
}

/** 部署前校验：本地预测 + 单次链上 createdTokens 检查 */
export async function verifyPump9SaltVanity(
    deployer: `0x${string}`,
    userSalt: `0x${string}`
): Promise<`0x${string}`> {
    const predicted = predictPump9TokenAddress(deployer, userSalt)
    if (!addressEndsWithVanity(predicted)) {
        throw new Error(`Pump9 salt vanity check failed: predicted ${predicted}`)
    }
    const created = await readContract('Pump9', 'createdTokens', [predicted]) as boolean
    if (created) {
        throw new Error(`Pump9 salt already used: ${predicted}`)
    }
    return predicted
}

/**
 * 搜索可用于 createToken 的 salt。
 * 靓号搜索在本地完成；仅对候选 salt 调用 createdTokens（通常 0~几次 RPC）。
 */
export async function findPump9DeploySalt(deployer: `0x${string}`): Promise<`0x${string}`> {
    const lastSalt = getLastSaltNum(deployer)

    // 本地扫描靓号；命中后仅 1 次 RPC 查 createdTokens，已占用则继续
    for (let i = 1n; i <= BigInt(MAX_SEARCH); i++) {
        const saltNum = lastSalt + i
        const userSalt = encodeSaltBytes32(saltNum)
        const predicted = predictPump9TokenAddress(deployer, userSalt)
        if (!addressEndsWithVanity(predicted)) continue

        const created = await readContract('Pump9', 'createdTokens', [predicted]) as boolean
        if (created) continue

        saveLastSaltNum(deployer, saltNum)
        return userSalt
    }

    throw new Error('Failed to find valid Pump9 deploy salt within search limit')
}
