/**
 * Centralised environment configuration for the open-source mobile client.
 *
 * All EXPO_PUBLIC_* variables should be read here (or via helpers exported
 * from this module). See docs/fork-guide.md.
 */

import Constants from 'expo-constants';

function readEnv(key: string): string {
  const value = process.env[key];
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
    readEnv('EXPO_PUBLIC_API_BASE_URL') ||
    readEnv('EXPO_PUBLIC_BACKEND_URL');

  const fromExtra = readExtra('apiBaseUrl') || readExtra('backendUrl');

  let url = fromEnv || fromExtra;

  if (__DEV__) {
    const devOverride =
      readEnv('EXPO_PUBLIC_API_BASE_URL_DEV') ||
      readEnv('EXPO_PUBLIC_BACKEND_URL_DEV') ||
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

export const env = {
  appEnv: readEnv('APP_ENV') || readEnv('NODE_ENV') || 'development',

  apiBaseUrl: getResolvedApiBaseUrl(),

  walletConnectProjectId:
    readEnv('EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID') ||
    readEnv('WALLETCONNECT_PROJECT_ID') ||
    readExtra('walletConnectProjectId'),

  kuraWalletIconUrl: readEnv('EXPO_PUBLIC_KURA_WALLET_ICON_URL'),

  privyAppId: readEnv('EXPO_PUBLIC_PRIVY_APP_ID') || readExtra('privyAppId'),
  privyClientId: readEnv('EXPO_PUBLIC_PRIVY_CLIENT_ID') || readExtra('privyClientId'),

  pimlicoApiKey:
    readEnv('EXPO_PUBLIC_PIMLICO_API_KEY') || readExtra('pimlicoApiKey'),
  alchemyApiKey:
    readEnv('EXPO_PUBLIC_ALCHEMY_API_KEY') || readExtra('alchemyApiKey'),
  baseRpcUrl: readEnv('EXPO_PUBLIC_BASE_RPC_URL'),
  payGasInUsdc: envBool(readEnv('EXPO_PUBLIC_PAY_GAS_IN_USDC'), true),

  gpDirectEnabled: envBool(readEnv('EXPO_PUBLIC_GP_DIRECT_ENABLED'), false),
  gpApiUrl: readEnv('EXPO_PUBLIC_GP_API_URL') || 'https://app.gnosispay.com',
  gpApiBaseUrl: readEnv('EXPO_PUBLIC_GP_API_BASE_URL') || 'https://api.gnosispay.com',
  gpSiweDomain: readEnv('EXPO_PUBLIC_GP_SIWE_DOMAIN'),
  gpSiweUri: readEnv('EXPO_PUBLIC_GP_SIWE_URI'),
  gpPartnerId: readEnv('EXPO_PUBLIC_GP_PARTNER_ID'),
  gpJwtTtlSeconds: readEnv('EXPO_PUBLIC_GP_JWT_TTL_SECONDS'),

  moonpayApiKey: readEnv('EXPO_PUBLIC_MOONPAY_API_KEY'),
  moonpayEnv: (readEnv('EXPO_PUBLIC_MOONPAY_ENV') || 'sandbox') as 'sandbox' | 'live',
  moonpayCurrencyCode: readEnv('EXPO_PUBLIC_MOONPAY_CURRENCY_CODE') || 'usdc_base',

  logodevToken:
    readEnv('EXPO_PUBLIC_LOGODEV_TOKEN') || readExtra('logodevToken'),

  lifiIntegrator: readEnv('EXPO_PUBLIC_LIFI_INTEGRATOR'),
  lifiFee: readEnv('EXPO_PUBLIC_LIFI_FEE'),
  lifiApiKey: readEnv('EXPO_PUBLIC_LIFI_API_KEY'),
} as const;
