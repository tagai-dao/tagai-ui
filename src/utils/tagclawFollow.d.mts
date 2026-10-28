export type TagClawFollowSource={sourceId:string;txHash:string;token:string;ipshareSubject:`0x${string}`;handle:string}
export function tagclawSourceHash(value:unknown):string
export function verifiedTagclawSource(data:any,hash:string,token:string,chainId:number):TagClawFollowSource
