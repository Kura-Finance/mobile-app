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
  /** When false, list in Invest but skip on-chain balance reads (no Base deployment). */
  trackBalance?: boolean;
  /** Ticker used for the logo.dev crypto logo (defaults to `symbol`). */
  logoSymbol?: string;
  /** Fallback when logo.dev has no asset (e.g. CoinGecko CDN). */
  logoUrl?: string;
  /** CoinGecko id for About copy when `geckoId` has no description (e.g. bridged tokens). */
  aboutGeckoId?: string;
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
    geckoId: 'ethena-usde',
    symbol: 'USDe',
    name: 'Ethena USDe',
    displayName: 'USDe',
    color: '#111111',
    emoji: '$',
    baseAddress: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',
    decimals: 18,
    swappable: true,
    logoSymbol: 'usde',
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
    geckoId: 'xsgd',
    symbol: 'XSGD',
    name: 'XSGD',
    displayName: 'XSGD',
    color: '#EF3340',
    emoji: 'S$',
    baseAddress: '0x0A4C9cb2778aB3302996A34BeFCF9a8Bc288C33b',
    decimals: 6,
    swappable: true,
    logoSymbol: 'xsgd',
    logoUrl: 'https://coin-images.coingecko.com/coins/images/12832/large/XSGD_Logo_Full_Colour_1.png?1772634156',
  },
  {
    geckoId: 'novatti-australian-digital-dollar',
    symbol: 'AUDD',
    name: 'Australian Digital Dollar',
    displayName: 'AUDD',
    color: '#00843D',
    emoji: 'A$',
    baseAddress: '0x449b3317a6d1efb1bc3ba0700c9eaa4ffff4ae65',
    decimals: 6,
    swappable: true,
    logoSymbol: 'audd',
    logoUrl: 'https://coin-images.coingecko.com/coins/images/33263/large/AUDD-Logo-Blue_512.png?1701319895',
  },
  {
    geckoId: 'brz',
    symbol: 'BRZ',
    name: 'Brazilian Digital Token',
    displayName: 'BRZ',
    color: '#009C3B',
    emoji: 'R$',
    baseAddress: '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4',
    decimals: 18,
    swappable: true,
    logoSymbol: 'brz',
    logoUrl: 'https://coin-images.coingecko.com/coins/images/8472/large/MicrosoftTeams-image_%286%29.png?1696508657',
  },
  {
    geckoId: 'real-mxn',
    symbol: 'MXNe',
    name: 'Real MXN',
    displayName: 'MXNe',
    color: '#006847',
    emoji: 'MX$',
    baseAddress: '0x269cae7dc59803e5c596c95756faeebb6030e0af',
    decimals: 6,
    swappable: true,
    logoSymbol: 'mxne',
    logoUrl: 'https://coin-images.coingecko.com/coins/images/54735/large/mxne-logo-200.png?1741253834',
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
  // ── Extended crypto (Base swap) ───────────────────────────────────────────
  {
    geckoId: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    displayName: 'XRP',
    color: '#23292F',
    emoji: '✕',
    baseAddress: '0xcb585250f852C6c6bf90434AB21A00f02833a4af',
    decimals: 6,
    badge: 'cb',
    swappable: true,
    logoSymbol: 'xrp',
  },
  {
    geckoId: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    displayName: 'ADA',
    color: '#0033AD',
    emoji: '₳',
    baseAddress: '0xcbADA732173e39521CDBE8bf59a6Dc85A9fc7b8c',
    decimals: 6,
    badge: 'cb',
    swappable: true,
    logoSymbol: 'ada',
  },
  {
    geckoId: 'litecoin',
    symbol: 'LTC',
    name: 'Litecoin',
    displayName: 'LTC',
    color: '#345D9D',
    emoji: 'Ł',
    baseAddress: '0xcb17C9Db87B595717C857a08468793f5bAb6445F',
    decimals: 8,
    badge: 'cb',
    swappable: true,
    logoSymbol: 'ltc',
  },
  {
    geckoId: 'base-bridged-sol-base',
    symbol: 'SOL',
    name: 'Solana',
    displayName: 'SOL',
    color: '#9945FF',
    emoji: '◎',
    baseAddress: '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',
    decimals: 9,
    swappable: true,
    logoSymbol: 'sol',
    aboutGeckoId: 'solana',
  },
  {
    geckoId: 'dogecoin',
    symbol: 'cbDOGE',
    name: 'Coinbase Wrapped DOGE',
    displayName: 'cbDOGE',
    color: '#C2A633',
    emoji: 'Ð',
    baseAddress: '0xcbD06E5A2B0C65597161de254AA074E489dEb510',
    decimals: 8,
    badge: 'cb',
    swappable: true,
    logoSymbol: 'doge',
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
  if (token.logoUrl) return token.logoUrl;
  const sym = token.logoSymbol ?? token.symbol;
  if (!sym) return null;
  return logoDevCryptoUrl(sym, size);
}
