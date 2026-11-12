/**
 * Centralised environment configuration for the mobile client.
 *
 * All EXPO_PUBLIC_* variables should be read here (or via helpers exported
 * from this module). See docs/fork-guide.md and docs/maintainers.md.
 *
 * Expo lint requires static `process.env.NAME` access (no dynamic keys) so
 * Metro can inline EXPO_PUBLIC_* values at build time.
 */

import Constants from 'expo-constants';
import {
  assertValidWalletConnectProjectId as assertWalletConnectProjectId,
  normalizeWalletConnectProjectId,
} from './walletConnectProjectId';

function trimEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readExtra(key: string): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const value = extra[key];
  return typeof value === 'string' ? value.trim() : '';
}

function envBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

/** Resolved app backend base URL (no trailing slash), or empty when unset. */
export function getResolvedApiBaseUrl(): string {
  const fromEnv =
    trimEnv(process.env.EXPO_PUBLIC_API_BASE_URL) ||
    trimEnv(process.env.EXPO_PUBLIC_BACKEND_URL);

  const fromExtra = readExtra('apiBaseUrl') || readExtra('backendUrl');

  let url = fromEnv || fromExtra;

  if (__DEV__) {
    const devOverride =
      trimEnv(process.env.EXPO_PUBLIC_API_BASE_URL_DEV) ||
      trimEnv(process.env.EXPO_PUBLIC_BACKEND_URL_DEV) ||
      readExtra('backendUrlDev');
    if (devOverride) url = devOverride;
  }

  return url.replace(/\/+$/, '');
}

/** True when an optional hosted backend URL is configured. */
export function hasAppBackend(): boolean {
  return getResolvedApiBaseUrl().length > 0;
}

/** @deprecated Prefer {@link hasAppBackend}. */
export const hasKuraBackend = hasAppBackend;

/** DeBank / Plaid / TrackFi require the hosted backend — mobile never calls those APIs directly. */
export function assertAppBackend(): void {
  if (!hasAppBackend()) {
    throw new Error(
      'App backend URL is not configured (EXPO_PUBLIC_API_BASE_URL). ' +
        'DeBank data is only available via the backend proxy (/api/debank/*); ' +
        'the mobile app never calls DeBank OpenAPI directly.',
    );
  }
}

/** @deprecated Prefer {@link assertAppBackend}. */
export const assertKuraBackend = assertAppBackend;

/** True when a Pimlico API key is set (enables USDC gas paymaster). */
export function hasPimlicoApiKey(): boolean {
  return env.pimlicoApiKey.length > 0;
}

/** Placeholder values that must never ship in production builds. */
export { INVALID_WALLET_CONNECT_PROJECT_IDS, normalizeWalletConnectProjectId } from './walletConnectProjectId';

/** Resolved WalletConnect / Reown project ID, or empty when unset or invalid. */
export function resolveWalletConnectProjectId(): string {
  const raw =
    trimEnv(process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID) ||
    trimEnv(process.env.WALLETCONNECT_PROJECT_ID) ||
    readExtra('walletConnectProjectId');
  return normalizeWalletConnectProjectId(raw);
}

export function hasValidWalletConnectProjectId(): boolean {
  return resolveWalletConnectProjectId().length > 0;
}

export function assertValidWalletConnectProjectId(): string {
  return assertWalletConnectProjectId(resolveWalletConnectProjectId());
}

const walletIconUrl =
  trimEnv(process.env.EXPO_PUBLIC_WALLET_ICON_URL) ||
  trimEnv(process.env.EXPO_PUBLIC_KURA_WALLET_ICON_URL);

const earnFeeRecipient =
  trimEnv(process.env.EXPO_PUBLIC_EARN_FEE_RECIPIENT) ||
  trimEnv(process.env.EXPO_PUBLIC_KURA_EARN_FEE_RECIPIENT) ||
  readExtra('earnFeeRecipient') ||
  readExtra('kuraEarnFeeRecipient');

export const env = {
  appEnv:
    trimEnv(process.env.APP_ENV) ||
    trimEnv(process.env.NODE_ENV) ||
    'development',

  apiBaseUrl: getResolvedApiBaseUrl(),

  walletConnectProjectId: resolveWalletConnectProjectId(),

  /** Public wallet icon URL for AppKit / WalletKit (falls back to brand.defaultIconUrl). */
  walletIconUrl,
  /** @deprecated Prefer {@link env.walletIconUrl}. */
  kuraWalletIconUrl: walletIconUrl,

  privyAppId: trimEnv(process.env.EXPO_PUBLIC_PRIVY_APP_ID) || readExtra('privyAppId'),
  privyClientId: trimEnv(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID) || readExtra('privyClientId'),

  pimlicoApiKey:
    trimEnv(process.env.EXPO_PUBLIC_PIMLICO_API_KEY) || readExtra('pimlicoApiKey'),
  /** Base JSON-RPC URL — defaults to free public mainnet in cardWalletConfig. */
  baseRpcUrl: trimEnv(process.env.EXPO_PUBLIC_BASE_RPC_URL),
  payGasInUsdc: envBool(trimEnv(process.env.EXPO_PUBLIC_PAY_GAS_IN_USDC), true),

  /** Optional logo.dev publishable key — unset → glyph / Clearbit fallbacks. */
  logodevToken:
    trimEnv(process.env.EXPO_PUBLIC_LOGODEV_TOKEN) || readExtra('logodevToken'),

  /** Optional Li.Fi key — unset → public https://li.quest/v1. */
  lifiApiKey:
    trimEnv(process.env.EXPO_PUBLIC_LIFI_API_KEY) || readExtra('lifiApiKey'),
  /** Optional Li.Fi integrator id — unset → no integrator fee. */
  lifiIntegrator:
    trimEnv(process.env.EXPO_PUBLIC_LIFI_INTEGRATOR) || readExtra('lifiIntegrator'),
  /** Optional Li.Fi integrator fee fraction (e.g. 0.0025 = 0.25%). */
  lifiFee: trimEnv(process.env.EXPO_PUBLIC_LIFI_FEE) || readExtra('lifiFee'),

  /** Optional CoinGecko Demo key — unset → public api.coingecko.com. */
  coingeckoApiKey: trimEnv(process.env.EXPO_PUBLIC_COINGECKO_API_KEY),

  /** Morpho Earn — set to `false` to hide Earn tab (default: on when Pimlico key is set). */
  morphoEarnEnabled: trimEnv(process.env.EXPO_PUBLIC_MORPHO_EARN_ENABLED),
  /**
   * JSON array of Morpho vault addresses on Base to list in Invest → Earn.
   * Default: Steakhouse USDC + Gauntlet EURC Balanced + Gauntlet USDC Prime + Gauntlet USDC Frontier when unset.
   */
  morphoEarnVaultAllowlist: trimEnv(process.env.EXPO_PUBLIC_MORPHO_EARN_VAULT_ALLOWLIST),
  /** Optional Morpho Earn performance fee rate (0–1). Unset / 0 → no service fee. */
  morphoEarnFee: trimEnv(process.env.EXPO_PUBLIC_MORPHO_EARN_FEE),
  /** Optional treasury that receives Morpho earn performance fee. */
  earnFeeRecipient,
  /** @deprecated Prefer {@link env.earnFeeRecipient}. */
  kuraEarnFeeRecipient: earnFeeRecipient,
  /**
   * Optional JSON map of inner vault → fee-wrapper vault addresses.
   * Example: {"0xee8f...":"0x002f..."}
   */
  morphoFeeWrapperOverrides: trimEnv(process.env.EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES),
  /** When true, discover matching FeeWrapper vaults from Morpho API. Default off. */
  morphoFeeWrapperAutoDiscover: trimEnv(process.env.EXPO_PUBLIC_MORPHO_FEE_WRAPPER_AUTO_DISCOVER),
} as const;
