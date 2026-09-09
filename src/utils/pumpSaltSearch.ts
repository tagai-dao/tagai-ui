import { bytesToHex, hexToBytes, keccak256, type Hex } from 'viem'

export type SaltSearchConfig = { pump: Hex; tokenImplementation: Hex; deployer: Hex }

/** Fixed CREATE2 preimage and ABI words are built once, not once per candidate. */
export function createSaltSearcher(config: SaltSearchConfig, start: bigint) {
    const input = new Uint8Array(64)
    input.set(hexToBytes(config.deployer), 12)
    input.set(hexToBytes(`0x${start.toString(16).padStart(64, '0')}`), 32)
    const preimage = new Uint8Array(85)
    preimage[0] = 0xff
    preimage.set(hexToBytes(config.pump), 1)
    preimage.set(keccak256(hexToBytes(`0x3d602d80600a3d3981f3363d3d373d3d3d363d73${config.tokenImplementation.slice(2)}5af43d82803e903d91602b57fd5bf3`), 'bytes'), 53)
    return (count: number): Hex | undefined => {
        for (let n = 0; n < count; n++) {
            // Increment the uint256 user salt in its ABI word, including carries.
            let i = 63
            while (i >= 32 && input[i] === 255) input[i--] = 0
            if (i < 32) throw new Error('Pump salt overflow')
            input[i]++
            preimage.set(keccak256(input, 'bytes'), 21)
            const hash = keccak256(preimage, 'bytes')
            if (hash[30] === 0x33 && hash[31] === 0x33) return bytesToHex(input.subarray(32))
        }
    }
}

export async function searchPumpSalt(config: SaltSearchConfig, start: bigint): Promise<Hex> {
    const search = createSaltSearcher(config, start)
    for (let n = 0; n < 500_000; n += 1000) {
        const salt = search(1000)
        if (salt) return salt
        // Also keeps the fallback responsive if Web Workers are unavailable.
        await new Promise(resolve => setTimeout(resolve, 0))
    }
    throw new Error('Failed to find a valid Pump deploy salt within search limit')
}
