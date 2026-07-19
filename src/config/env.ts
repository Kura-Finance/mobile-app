/**
 * Centralised environment configuration for the open-source mobile client.
 *
 * All EXPO_PUBLIC_* variables should be read here (or via helpers exported
 * from this module). See docs/fork-guide.md.
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

/** Resolved Kura backend base URL (no trailing slash), or empty when unset. */
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

export function hasKuraBackend(): boolean {
  return getResolvedApiBaseUrl().length > 0;
}

/** DeBank / Plaid / TrackFi require the Kura backend — mobile never calls those APIs directly. */
export function assertKuraBackend(): void {
  if (!hasKuraBackend()) {
    throw new Error(
      'Kura backend URL is not configured (EXPO_PUBLIC_API_BASE_URL). ' +
        'DeBank data is only available via the backend proxy (/api/debank/*); ' +
        'the mobile app never calls DeBank OpenAPI directly.',
    );
  }
}

/** True when a Pimlico bundler/paymaster key is available (required for SCA txs). */
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

export const env = {
  appEnv:
    trimEnv(process.env.APP_ENV) ||
    trimEnv(process.env.NODE_ENV) ||
    'development',

  apiBaseUrl: getResolvedApiBaseUrl(),

  walletConnectProjectId: resolveWalletConnectProjectId(),

  kuraWalletIconUrl: trimEnv(process.env.EXPO_PUBLIC_KURA_WALLET_ICON_URL),

  privyAppId: trimEnv(process.env.EXPO_PUBLIC_PRIVY_APP_ID) || readExtra('privyAppId'),
  privyClientId: trimEnv(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID) || readExtra('privyClientId'),

  pimlicoApiKey:
    trimEnv(process.env.EXPO_PUBLIC_PIMLICO_API_KEY) || readExtra('pimlicoApiKey'),
  alchemyApiKey:
    trimEnv(process.env.EXPO_PUBLIC_ALCHEMY_API_KEY) || readExtra('alchemyApiKey'),
  baseRpcUrl: trimEnv(process.env.EXPO_PUBLIC_BASE_RPC_URL),
  payGasInUsdc: envBool(trimEnv(process.env.EXPO_PUBLIC_PAY_GAS_IN_USDC), true),

  logodevToken:
    trimEnv(process.env.EXPO_PUBLIC_LOGODEV_TOKEN) || readExtra('logodevToken'),

  lifiIntegrator:
    trimEnv(process.env.EXPO_PUBLIC_LIFI_INTEGRATOR) || readExtra('lifiIntegrator'),
  lifiFee: trimEnv(process.env.EXPO_PUBLIC_LIFI_FEE) || readExtra('lifiFee'),
  lifiApiKey:
    trimEnv(process.env.EXPO_PUBLIC_LIFI_API_KEY) || readExtra('lifiApiKey'),

  /** Optional CoinGecko Demo API key — raises rate limits for price/chart calls. */
  coingeckoApiKey:
    trimEnv(process.env.EXPO_PUBLIC_COINGECKO_API_KEY) || readExtra('coingeckoApiKey'),

  /** Morpho Earn — set to `false` to hide Earn tab (default: on when Pimlico key is set). */
  morphoEarnEnabled: trimEnv(process.env.EXPO_PUBLIC_MORPHO_EARN_ENABLED),
  /**
   * JSON array of Morpho vault addresses on Base to list in Invest → Earn.
   * Default: Steakhouse USDC + Gauntlet EURC Balanced + Gauntlet USDC Prime + Gauntlet USDC Frontier when unset.
   */
  morphoEarnVaultAllowlist: trimEnv(process.env.EXPO_PUBLIC_MORPHO_EARN_VAULT_ALLOWLIST),
  /** Morpho Earn — Kura performance fee (0–1 decimal, default 0.1 = 10%). */
  morphoEarnFee: trimEnv(process.env.EXPO_PUBLIC_MORPHO_EARN_FEE) || '0.1',
  /** Treasury address that receives Kura's Morpho earn performance fee. */
  kuraEarnFeeRecipient:
    trimEnv(process.env.EXPO_PUBLIC_KURA_EARN_FEE_RECIPIENT) || readExtra('kuraEarnFeeRecipient'),
  /**
   * Optional JSON map of inner vault → fee-wrapper vault addresses.
   * Example: {"0xee8f...":"0x002f..."}
   */
  morphoFeeWrapperOverrides: trimEnv(process.env.EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES),
  /** When false, skip Morpho API fee-wrapper discovery (env overrides only). */
  morphoFeeWrapperAutoDiscover: trimEnv(process.env.EXPO_PUBLIC_MORPHO_FEE_WRAPPER_AUTO_DISCOVER),
} as const;
