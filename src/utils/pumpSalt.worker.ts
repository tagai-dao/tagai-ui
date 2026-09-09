import { searchPumpSalt, type SaltSearchConfig } from './pumpSaltSearch'
self.onmessage = async (event: MessageEvent<{config: SaltSearchConfig; start: bigint}>) => {
    try { self.postMessage({salt: await searchPumpSalt(event.data.config, event.data.start)}) }
    catch (e) { self.postMessage({error: e instanceof Error ? e.message : 'Salt search failed'}) }
}
