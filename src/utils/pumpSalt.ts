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
import { searchPumpSalt, type SaltSearchConfig } from './pumpSaltSearch'

const SALT_STORAGE_KEY_PREFIX = 'pump_last_salt_'
const VANITY_SUFFIX = '3333'

type CreatePumpDeployment = {
    chainId: number
    version: 9 | 11 | 13
    contractName: 'Pump9' | 'Pump11' | 'Pump13'
    pump: `0x${string}`
    tokenImplementation: `0x${string}`
}

export function getCreatePumpDeployment(): CreatePumpDeployment {
    const deployment = useChainStore().deployment
    const version = deployment.latestPumpVersion
    const pump = version === 13 ? deployment.contracts.pump13 : version === 11
        ? deployment.contracts.pump11
        : deployment.contracts.pump9
    const tokenImplementation = version === 13 ? deployment.contracts.tokenImplementation13 : version === 11
        ? deployment.contracts.tokenImplementation11
        : deployment.contracts.tokenImplementation9

    if (!pump || !tokenImplementation || pump === zeroAddress || tokenImplementation === zeroAddress) {
        throw new Error(`Pump V${version} is not deployed on ${deployment.name}`)
    }
    return {
        chainId: deployment.chainId,
        version,
        contractName: `Pump${version}` as 'Pump9' | 'Pump11' | 'Pump13',
        pump,
        tokenImplementation,
    }
}

function addressEndsWithVanity(addr: string): boolean {
    return addr.toLowerCase().endsWith(VANITY_SUFFIX)
}

function getSaltStorageKey(config: CreatePumpDeployment, deployer: string): string {
    return `${SALT_STORAGE_KEY_PREFIX}${config.chainId}_${config.version}_${config.pump.toLowerCase()}_${config.tokenImplementation.toLowerCase()}_${deployer.toLowerCase()}`
}

function getLastSaltNum(config: CreatePumpDeployment, deployer: string): bigint {
    try {
        const stored = localStorage.getItem(getSaltStorageKey(config, deployer))
            ?? localStorage.getItem(`${SALT_STORAGE_KEY_PREFIX}${config.chainId}_${config.version}_${deployer.toLowerCase()}`)
        return stored && /^\d+$/.test(stored) ? BigInt(stored) : 0n
    } catch { return 0n }
}

function saveLastSaltNum(config: CreatePumpDeployment, deployer: string, saltNum: bigint) {
    try { localStorage.setItem(getSaltStorageKey(config, deployer), saltNum.toString()) } catch { /* On-chain occupancy is authoritative. */ }
}

let prepared: {key: string; promise: Promise<`0x${string}`>} | undefined

function searchInWorker(config: SaltSearchConfig, start: bigint): Promise<`0x${string}`> {
    if (typeof Worker === 'undefined') return searchPumpSalt(config, start)
    return new Promise((resolve, reject) => {
        let worker: Worker
        try { worker = new Worker(new URL('./pumpSalt.worker.ts', import.meta.url), {type: 'module'}) }
        catch { searchPumpSalt(config, start).then(resolve, reject); return }
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Pump salt search timed out')) }, 120_000)
        const finish = () => { clearTimeout(timer); worker.terminate() }
        worker.onmessage = ({data}) => { finish(); data.error ? reject(new Error(data.error)) : resolve(data.salt) }
        worker.onerror = () => { finish(); searchPumpSalt(config, start).then(resolve, reject) }
        worker.postMessage({config, start})
    })
}

function preparation(config: CreatePumpDeployment, deployer: `0x${string}`) {
    const key = getSaltStorageKey(config, deployer)
    if (prepared?.key === key) return prepared.promise
    const promise = searchInWorker({...config, deployer}, getLastSaltNum(config, deployer))
    prepared = {key, promise}
    void promise.catch(() => { if (prepared?.promise === promise) prepared = undefined })
    return promise
}

/** Only local computation: opening a form never requests a signature or uses a salt. */
export function preparePumpDeploySalt(deployer: `0x${string}`): Promise<`0x${string}`> {
    return preparation(getCreatePumpDeployment(), deployer)
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
    const key = getSaltStorageKey(config, deployer)
    let candidate = preparation(config, deployer)
    for (let attempt = 0; attempt < 16; attempt++) {
        const userSalt = await candidate
        if (getSaltStorageKey(getCreatePumpDeployment(), deployer) !== key) throw new Error('Creation chain changed')
        const predicted = predictPumpTokenAddressWithConfig(config, deployer, userSalt)
        if (!addressEndsWithVanity(predicted)) throw new Error('Pump salt vanity check failed')
        // Re-check warmed candidates at submission: another tab may have used it.
        const created = await readContract(config.contractName, 'createdTokens', [predicted]) as boolean
        if (getSaltStorageKey(getCreatePumpDeployment(), deployer) !== key) throw new Error('Creation chain changed')
        saveLastSaltNum(config, deployer, BigInt(userSalt))
        if (prepared?.key === key) prepared = undefined
        if (created) { candidate = searchInWorker({...config, deployer}, BigInt(userSalt)); continue }
        return userSalt
    }
    throw new Error('Pump salt candidates already used; reopen the creation form')
}
