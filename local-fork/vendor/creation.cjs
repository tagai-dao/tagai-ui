const { ethers } = require('../ethers.cjs');
const pumpAbi = require('../../src/utils/v13/Pump13.json');
const tokenAbi = require('../../src/utils/v13/Token13.json');
const config = require('../config.cjs');
const assets = require('../../src/utils/v13/creation-assets.json');
const pumpInterface = new ethers.Interface(pumpAbi);
const tokenInterface = new ethers.Interface(tokenAbi);
const lower = value => String(value).toLowerCase();
const fail = message => { throw new Error(message); };
function events(receipt, address, iface, name) {
    return receipt.logs.filter(log => lower(log.address) === lower(address)).flatMap(log => {
        try { const e = iface.parseLog(log); return e?.name === name ? [{ ...e, log }] : []; }
        catch (_) { return []; }
    });
}
function parseCreation(receipt) {
    if (!receipt || Number(receipt.status) !== 1) fail('V13_CREATION_UNCONFIRMED');
    const created = events(receipt, config.pump, pumpInterface, 'NewToken');
    if (created.length !== 1) fail('V13_CREATION_INVALID');
    const { tick, token, creator } = created[0].args;
    const index = events(receipt, config.pump, pumpInterface, 'IndexConfigured').find(e => lower(e.args.token) === lower(token));
    const community = events(receipt, config.pump, pumpInterface, 'NutboxLinked').find(e => lower(e.args.token) === lower(token));
    const pools = events(receipt, config.pump, pumpInterface, 'NutboxStakingPoolLinked').filter(e => lower(e.args.token) === lower(token));
    const pairs = events(receipt, token, tokenInterface, 'ComponentPairCreated');
    if (!index || !community) fail('V13_CREATION_INCOMPLETE');
    const c = index.args;
    if (c.constituentAssets.length < 1 || c.constituentAssets.length > 4 || pools.length !== c.constituentAssets.length) fail('V13_CREATION_INCOMPLETE');
    const components = c.constituentAssets.map((asset, position) => {
        const pair = pairs.find(e => lower(e.args.asset) === lower(asset));
        const pool = pair && pools.find(e => lower(e.args.lpToken) === lower(pair.args.pair));
        if (!pair || !pool || pair.args.weight !== c.targetWeights[position] || pool.args.rewardRatio !== c.targetWeights[position]) fail('V13_CREATION_INCOMPLETE');
        return { asset: lower(asset), pair: lower(pair.args.pair), stakingPool: lower(pool.args.pool), position,
            targetWeight: Number(c.targetWeights[position]), logIndex: pool.log.index ?? pool.log.logIndex,
            decimals: assets.find(a => lower(a.address) === lower(asset))?.decimals ?? null };
    });
    return { tick, token: lower(token), creator: lower(creator), communityAddress: lower(community.args.community), version: 13,
        indexConfig: { name: c.name, symbol: c.symbol, basketFeeBps: Number(c.basketFeeBps), creatorShareBps: Number(c.creatorShareBps), retainCommunityOwnership: c.retainCommunityOwnership },
        components, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
        communityLogIndex: community.log.index ?? community.log.logIndex };
}
async function verifyCreation(provider, hash) {
    if (!/^0x[\da-f]{64}$/i.test(hash || '')) fail('V13_INVALID_HASH');
    const receipt = await provider.getTransactionReceipt(hash);
    const data = parseCreation(receipt);
    const block = await provider.getBlock(receipt.blockNumber);
    if (!block || lower(block.hash) !== lower(receipt.blockHash)) fail('V13_CREATION_REORG');
    return { ...data, timestamp: Number(block.timestamp), createHash: hash };
}
async function loadCreationOptions(provider, creator) {
    if (!ethers.isAddress(creator)) fail('V13_INVALID_ADDRESS');
    const blockTag = await provider.getBlockNumber();
    const pump = new ethers.Contract(config.pump, pumpAbi, provider);
    const [ipshareAddress, committeeAddress, pumpFee, implementation] = await Promise.all([
        pump.getIPShare({ blockTag }), pump.nutboxCommittee({ blockTag }), pump.createFee({ blockTag }), pump.tokenImplementation({ blockTag }),
    ]);
    const ip = new ethers.Contract(ipshareAddress, ['function ipshareCreated(address) view returns(bool)', 'function createFee() view returns(uint256)'], provider);
    const committee = new ethers.Contract(committeeAddress, ['function getCreateCommunityFee() view returns(uint256)', 'function getCommunitySettingsFee() view returns(uint256)'], provider);
    const [hasShare, ipFee, communityFee, settingsFee, approved] = await Promise.all([
        ip.ipshareCreated(creator, { blockTag }), ip.createFee({ blockTag }), committee.getCreateCommunityFee({ blockTag }), committee.getCommunitySettingsFee({ blockTag }),
        Promise.all(assets.map(a => pump.approvedConstituent(a.address, { blockTag }))),
    ]);
    return { chainId: 56, version: 13, pump: config.pump, tokenImplementation: implementation, sourceBlock: blockTag,
        assets: assets.filter((_, i) => approved[i]), pumpFee: pumpFee.toString(), ipshareFee: hasShare ? '0' : ipFee.toString(),
        communityFee: communityFee.toString(), settingsFee: settingsFee.toString() };
}
module.exports = { parseCreation, verifyCreation, loadCreationOptions };
