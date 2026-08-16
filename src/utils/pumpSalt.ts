/**
 * 当前链最新 Pump 的部署 salt 搜索：
 * - 本地 OZ Clones 预测地址（零 RPC，与 Pump.predictTokenAddress 一致）
 * - 从当前 chain/version/deployer 的上次 salt 递增搜索
 * - 地址末尾须为 3333；命中后仅查一次 createdTokens
 */
import { encodeAbiParameters, keccak256, zeroAddress } from 'viem'
import { useChainStore } from '@/stores/chain'
import { readContract } from './contract'
import { predictDeterministicAddress } from './ozClones'

const SALT_STORAGE_KEY_PREFIX = 'pump_last_salt_'
const VANITY_SUFFIX = '3333'
const MAX_SEARCH = 500_000

type CreatePumpDeployment = {
    chainId: number
    version: 9 | 11
    contractName: 'Pump9' | 'Pump11'
    pump: `0x${string}`
    tokenImplementation: `0x${string}`
}

export function getCreatePumpDeployment(): CreatePumpDeployment {
    const deployment = useChainStore().deployment
    const version = deployment.latestPumpVersion
    const pump = version === 11
        ? deployment.contracts.pump11
        : deployment.contracts.pump9
    const tokenImplementation = version === 11
        ? deployment.contracts.tokenImplementation11
        : deployment.contracts.tokenImplementation9

    if (pump === zeroAddress || tokenImplementation === zeroAddress) {
        throw new Error(`Pump V${version} is not deployed on ${deployment.name}`)
    }
    return {
        chainId: deployment.chainId,
        version,
        contractName: `Pump${version}` as 'Pump9' | 'Pump11',
        pump,
        tokenImplementation,
    }
}

function encodeSaltBytes32(saltNum: bigint): `0x${string}` {
    return (`0x${saltNum.toString(16).padStart(64, '0')}`) as `0x${string}`
}

function addressEndsWithVanity(addr: string): boolean {
    return addr.toLowerCase().endsWith(VANITY_SUFFIX)
}

function getSaltStorageKey(config: CreatePumpDeployment, deployer: string): string {
    return `${SALT_STORAGE_KEY_PREFIX}${config.chainId}_${config.version}_${deployer.toLowerCase()}`
}

function getLastSaltNum(config: CreatePumpDeployment, deployer: string): bigint {
    const stored = localStorage.getItem(getSaltStorageKey(config, deployer))
    return stored ? BigInt(stored) : 0n
}

function saveLastSaltNum(config: CreatePumpDeployment, deployer: string, saltNum: bigint) {
    localStorage.setItem(getSaltStorageKey(config, deployer), saltNum.toString())
}

/** 与当前 Pump.predictTokenAddress(deployer, userSalt) 一致。 */
function predictPumpTokenAddressWithConfig(
    config: CreatePumpDeployment,
    deployer: `0x${string}`,
    userSalt: `0x${string}`
): `0x${string}` {
    const cloneSalt = keccak256(
        encodeAbiParameters(
            [{ type: 'address' }, { type: 'bytes32' }],
            [deployer, userSalt]
        )
    )
    return predictDeterministicAddress(config.tokenImplementation, cloneSalt, config.pump)
}

export function predictPumpTokenAddress(
    deployer: `0x${string}`,
    userSalt: `0x${string}`
): `0x${string}` {
    return predictPumpTokenAddressWithConfig(getCreatePumpDeployment(), deployer, userSalt)
}

/** 部署前校验：本地预测 + 单次链上 createdTokens 检查。 */
export async function verifyPumpSaltVanity(
    deployer: `0x${string}`,
    userSalt: `0x${string}`
): Promise<`0x${string}`> {
    const config = getCreatePumpDeployment()
    const predicted = predictPumpTokenAddressWithConfig(config, deployer, userSalt)
    if (!addressEndsWithVanity(predicted)) {
        throw new Error(`Pump V${config.version} salt vanity check failed: predicted ${predicted}`)
    }
    const created = await readContract(config.contractName, 'createdTokens', [predicted]) as boolean
    if (created) {
        throw new Error(`Pump V${config.version} salt already used: ${predicted}`)
    }
    return predicted
}

/** 搜索可用于当前链最新 Pump.createToken 的 salt。 */
export async function findPumpDeploySalt(deployer: `0x${string}`): Promise<`0x${string}`> {
    const config = getCreatePumpDeployment()
    const lastSalt = getLastSaltNum(config, deployer)

    for (let i = 1n; i <= BigInt(MAX_SEARCH); i++) {
        const saltNum = lastSalt + i
        const userSalt = encodeSaltBytes32(saltNum)
        const predicted = predictPumpTokenAddressWithConfig(config, deployer, userSalt)
        if (!addressEndsWithVanity(predicted)) continue

        const created = await readContract(config.contractName, 'createdTokens', [predicted]) as boolean
        if (created) continue

        saveLastSaltNum(config, deployer, saltNum)
        return userSalt
    }

    throw new Error(`Failed to find a valid Pump V${config.version} deploy salt within search limit`)
}
