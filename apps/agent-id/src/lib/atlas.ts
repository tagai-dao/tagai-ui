import type {ActivitySummary} from '@/lib/activity-types';
import registryData from '@/data/registry.json';
import evidenceData from '@/data/evidence.json';
export type Evidence={id:string;name:string;xHandle:string;sourceUrl:string;excerpt:string;status:string;publishedAt?:string|null;collectedAt:string;displayName?:string;sourceType?:string;chainVerified?:boolean;extractionMethods?:string[];matchedText?:string;mediaUrl?:string|null;sourceOrigin?:string;sourceConfidence?:string;sourceSnapshotAt?:string;nameRegistered?:boolean;reviewNote?:string};
export type Agent={name:string;owner:string;source:string;chainVerified:boolean;block?:number;registeredAt?:number;tx?:string;tradeCount?:number;buyCount?:number;sellCount?:number;activity?:ActivitySummary};
export const registry=registryData as Agent[],seedEvidence=evidenceData as Evidence[];
export const REGISTRY='0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F';
export const normalize=(s:string)=>s.trim().toLowerCase().replace(/\.ai$/,'')+'.ai';
export const validName=(s:string)=>/^[a-z0-9-]{3,32}\.ai$/.test(s);
