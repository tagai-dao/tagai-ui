/**
 * OpenZeppelin Clones (v4.9) predictDeterministicAddress 的 TypeScript 实现。
 * 与 @openzeppelin/contracts/proxy/Clones.sol 汇编逻辑一致（含 mstore 字重叠）。
 */
import { encodeAbiParameters, keccak256, pad, getAddress } from 'viem'

const MASK256 = (1n << 256n) - 1n

function mstoreWord(mem: Uint8Array, offset: number, value: bigint) {
    const bytes = new Uint8Array(32)
    let v = value & MASK256
    for (let i = 31; i >= 0; i--) {
        bytes[i] = Number(v & 0xffn)
        v >>= 8n
    }
    mem.set(bytes, offset)
}

function addressToWord(address: `0x${string}`): bigint {
    return BigInt(pad(address, { size: 20 }))
}

/**
 * OZ Clones.predictDeterministicAddress(implementation, salt, deployer)
 */
export function predictDeterministicAddress(
    implementation: `0x${string}`,
    salt: `0x${string}`,
    deployer: `0x${string}`
): `0x${string}` {
    const ptr = new Uint8Array(0x98)
    // 写入顺序与 OZ 汇编一致
    mstoreWord(ptr, 0x38, addressToWord(deployer))
    mstoreWord(ptr, 0x24, 0x5af43d82803e903d91602b57fd5bf3ffn)
    mstoreWord(ptr, 0x14, addressToWord(implementation))
    mstoreWord(ptr, 0x00, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73n)
    mstoreWord(ptr, 0x58, BigInt(salt))
    const initCodeHash = keccak256(ptr.slice(0x0c, 0x0c + 0x37))
    mstoreWord(ptr, 0x78, BigInt(initCodeHash))
    const hash = keccak256(ptr.slice(0x43, 0x43 + 0x55))
    return getAddress(('0x' + hash.slice(-40)) as `0x${string}`)
}
