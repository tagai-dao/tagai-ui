/**
 * Canonical BNB Chain bStocks contract addresses.
 *
 * Community classification must use the token contract address, never the
 * community tick: imported communities may choose a different display symbol.
 */
export const BSC_BSTOCK_TOKEN_ADDRESSES = [
  '0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436', // NVIDIA
  '0x431a3BEE82E2ca41e49895CbECE5bB0F76A89b7A', // Apple
  '0x5b1910eAaD6450E50f816082Aa078C41F10C292f', // Tesla
  '0x80f3D493EBCe97e343c53D29a137942416B4ffC0', // Circle
  '0xcdf2f3e0fa43C47A6662a91C9E4a7C5f69762699', // Micron
  '0x3eE4dF61bd4F867E349BEaE8bFE07bc31b4850fb', // SanDisk
  '0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0', // Microsoft
  '0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0', // Meta
  '0xCA750eF65f295BBECd685Abf54e82CAf297BDB61', // SK Hynix
  '0x1a4b499833A79A09ad7Cf1D42D7DacF71e92eb00', // Amazon
  '0x3F53De71c126BdaBAe20f9cD64848d317f6C3238', // Alphabet
  '0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1', // SpaceX
  '0x205812CdBed920aFf76C6580abD681a46D11efc7', // Invesco QQQ
  '0x7138b48df7D98D7e3cc221BfE7192D0a178182D8', // SPDR S&P 500 ETF
  '0x93862d63fd9Fd488B1328E9b47717d75e994a84B', // Roundhill Memory ETF
  '0x46cEeFDa28Dd7207059ed19B0acdc026955bb15C', // GameStop
] as const

const BSC_BSTOCK_TOKEN_ADDRESS_SET = new Set<string>(
  BSC_BSTOCK_TOKEN_ADDRESSES.map((address) => address.toLowerCase()),
)

export const isBscBStockToken = (address?: string | null): boolean =>
  !!address && BSC_BSTOCK_TOKEN_ADDRESS_SET.has(address.toLowerCase())
