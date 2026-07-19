/** Base mainnet — CAIP-2 */
export const BASE_CAIP2 = 'eip155:8453';

/** Chains Kura WalletConnect sessions can approve (Base-only). */
export const SUPPORTED_WC_CHAINS = [BASE_CAIP2] as const;

/** Base mainnet chain id (hex) */
export const BASE_CHAIN_ID_HEX = '0x2105';

export function isSupportedWcChain(chain: string): boolean {
  return (SUPPORTED_WC_CHAINS as readonly string[]).includes(chain);
}

/** True when every required eip155 chain is one we support (empty required → true). */
export function requiredEip155ChainsSatisfied(requiredChains: string[]): boolean {
  if (requiredChains.length === 0) return true;
  return requiredChains.every(isSupportedWcChain);
}

export const SUPPORTED_WC_METHODS = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'personal_sign',
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
