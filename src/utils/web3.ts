import { ChainConfig, MainToken } from "@/config"
import { useAccountStore } from "@/stores/web3";


export const setupNetwork = async (ethereum: any) => {
    const accStore = useAccountStore()
    try {
        const chainInfo = await ethereum.request({
            method: 'eth_chainId'
        })
        if (parseInt(chainInfo) == ChainConfig.chainId) {
            accStore.chainId = ChainConfig.chainId;
            return true;
        }

        await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{
                chainId: `0x${ChainConfig.chainId.toString(16)}`
            }]
        })
        accStore.chainId = ChainConfig.chainId;
    } catch (error: any) {
        if (error.code === 4001) return;
        if (error.code === -32002) return;

        try {
            await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${ChainConfig.chainId.toString(16)}`,
                    chainName: ChainConfig.name,
                    rpcUrls: [ChainConfig.rpc],
                    nativeCurrency: MainToken,
                    blockExplorerUrls: [ChainConfig.browser]
                }]
            })
            accStore.chainId = ChainConfig.chainId;
            return true;
        } catch (error) {
            console.log('setup chain fail', error)
        }
    }
}