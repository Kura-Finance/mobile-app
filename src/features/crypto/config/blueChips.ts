/**
 * Blue-chip tokens on Base mainnet.
 *
 * `baseAddress`  — ERC-20 contract on Base (null = native ETH)
 * `geckoId`      — CoinGecko price ID
 * `badge`        — Small overlay label on the logo (e.g. "cb" for Coinbase-wrapped)
 * `decimals`     — Token decimals for on-chain balance parsing
 */

import { cryptoLogoUrl as logoDevCryptoUrl } from '../../../config/logodev';

export interface BluechipToken {
  geckoId: string;
  symbol: string;
  name: string;
  /** Short display name shown under the badge, e.g. "cbBTC" */
  displayName: string;
  color: string;
  emoji: string;
  baseAddress: `0x${string}` | null;
  decimals: number;
  /** Optional small badge shown on the logo corner, e.g. "cb" */
  badge?: string;
  /** Whether this can be a swap target from USDC */
  swappable: boolean;
  /** When false, list in Discover but skip on-chain balance reads (no Base deployment). */
  trackBalance?: boolean;
  /** Ticker used for the logo.dev crypto logo (defaults to `symbol`). */
  logoSymbol?: string;
}

export const BLUE_CHIPS: BluechipToken[] = [
  {
    geckoId: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    displayName: 'USDC',
    color: '#2775CA',
    emoji: '$',
    baseAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    swappable: false, // it IS the source token
    logoSymbol: 'usdc',
  },
  {
    geckoId: 'ethereum',
    symbol: 'ETH',
    name: 'Ether',
    displayName: 'ETH',
    color: '#627EEA',
    emoji: 'Ξ',
    baseAddress: null,
    decimals: 18,
    swappable: false,
    logoSymbol: 'eth',
  },
  {
    geckoId: 'ethereum',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    displayName: 'WETH',
    color: '#627EEA',
    emoji: 'Ξ',
    baseAddress: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    swappable: true,
    logoSymbol: 'eth',
  },
  {
    geckoId: 'bitcoin',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    displayName: 'cbBTC',
    color: '#F7931A',
    emoji: '₿',
    baseAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    badge: 'cb',
    swappable: true,
    logoSymbol: 'btc',
  },
  {
    geckoId: 'coinbase-wrapped-staked-eth',
    symbol: 'cbETH',
    name: 'Coinbase Staked ETH',
    displayName: 'cbETH',
    color: '#4B9CD3',
    emoji: 'Ξ',
    baseAddress: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    decimals: 18,
    badge: 'cb',
    swappable: true,
    logoSymbol: 'eth',
  },
  {
    geckoId: 'aerodrome-finance',
    symbol: 'AERO',
    name: 'Aerodrome',
    displayName: 'AERO',
    color: '#00D4FF',
    emoji: 'A',
    baseAddress: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    decimals: 18,
    swappable: true,
    logoSymbol: 'aero',
  },
  {
    geckoId: 'dai',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    displayName: 'DAI',
    color: '#F5AC37',
    emoji: 'D',
    baseAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    swappable: true,
    logoSymbol: 'dai',
  },
  {
    geckoId: 'euro-coin',
    symbol: 'EURC',
    name: 'Euro Coin',
    displayName: 'EURC',
    color: '#2E6BE6',
    emoji: '€',
    baseAddress: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    decimals: 6,
    swappable: true,
    logoSymbol: 'euroc',
  },
  {
    geckoId: 'wrapped-steth',
    symbol: 'wstETH',
    name: 'Wrapped Liquid Staked ETH',
    displayName: 'wstETH',
    color: '#00A3FF',
    emoji: 'Ξ',
    baseAddress: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    decimals: 18,
    swappable: true,
    logoSymbol: 'wsteth',
  },
  {
    geckoId: 'morpho',
    symbol: 'MORPHO',
    name: 'Morpho',
    displayName: 'MORPHO',
    color: '#3B5BFE',
    emoji: 'M',
    baseAddress: '0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842',
    decimals: 18,
    swappable: true,
    logoSymbol: 'morpho',
  },
  {
    geckoId: 'ondo-us-dollar-yield',
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    displayName: 'USDY',
    color: '#1A3A6B',
    emoji: '$',
    baseAddress: '0xc6682c8b7cbb363562bd1ff1c1ad50d66f5baeda',
    decimals: 18,
    swappable: false,
    logoSymbol: 'usdy',
  },
  {
    geckoId: 'ousg',
    symbol: 'OUSG',
    name: 'Ondo Short-Term US Treasuries',
    displayName: 'OUSG',
    color: '#0066CC',
    emoji: 'T',
    baseAddress: null,
    decimals: 18,
    swappable: false,
    trackBalance: false,
    logoSymbol: 'ousg',
  },
  {
    geckoId: 'susds',
    symbol: 'sUSDS',
    name: 'Savings USDS',
    displayName: 'sUSDS',
    color: '#2775CA',
    emoji: '$',
    baseAddress: '0x5875eee11cf8398102fdad704c9e96607675467a',
    decimals: 18,
    swappable: false,
    logoSymbol: 'susds',
  },
  {
    geckoId: 'resolv-usr',
    symbol: 'USR',
    name: 'Resolv USD',
    displayName: 'USR',
    color: '#6366F1',
    emoji: '$',
    baseAddress: '0x35E5dB674D8e93a03d814FA0ADa70731efe8a4b9',
    decimals: 18,
    swappable: true,
    logoSymbol: 'usr',
  },
  {
    geckoId: 'virtual-protocol',
    symbol: 'VIRTUAL',
    name: 'Virtuals Protocol',
    displayName: 'VIRTUAL',
    color: '#5D5FEF',
    emoji: 'V',
    baseAddress: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    decimals: 18,
    swappable: true,
    logoSymbol: 'virtual',
  },
  {
    geckoId: 'degen-base',
    symbol: 'DEGEN',
    name: 'Degen',
    displayName: 'DEGEN',
    color: '#A36EFD',
    emoji: '🎩',
    baseAddress: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    decimals: 18,
    swappable: true,
    logoSymbol: 'degen',
  },
];

/** Tron USDT ramp deposit — display-only (not a Base blue-chip). */
export const USDT_DISPLAY: BluechipToken = {
  geckoId: 'tether',
  symbol: 'USDT',
  name: 'Tether USD',
  displayName: 'USDT',
  color: '#26A17B',
  emoji: '₮',
  baseAddress: null,
  decimals: 6,
  swappable: false,
  logoSymbol: 'usdt',
};

export const GECKO_IDS = [...new Set(BLUE_CHIPS.map((t) => t.geckoId))].join(',');

/**
 * Build a logo.dev crypto logo URL for a token, or null when no token is
 * configured (callers fall back to the emoji glyph).
 */
export function cryptoLogoUrl(token: BluechipToken, size = 64): string | null {
  const sym = token.logoSymbol ?? token.symbol;
  if (!sym) return null;
  return logoDevCryptoUrl(sym, size);
}
