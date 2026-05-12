/** Base mainnet — CAIP-2 */
export const BASE_CAIP2 = 'eip155:8453';

/** Base mainnet chain id (hex) */
export const BASE_CHAIN_ID_HEX = '0x2105';

export const SUPPORTED_WC_METHODS = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'personal_sign',
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  'wallet_switchEthereumChain',
] as const;

export const SUPPORTED_WC_EVENTS = ['accountsChanged', 'chainChanged'] as const;

export function scaCaip10Account(scaAddress: string): string {
  return `${BASE_CAIP2}:${scaAddress}`;
}

export function isWalletConnectUri(uri: string): boolean {
  const trimmed = uri.trim();
  return trimmed.startsWith('wc:') || trimmed.startsWith('wc://');
}
