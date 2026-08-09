/**
 * Configuration for the Kura Smart Card Wallet (ERC-4337 on Base).
 *
 * Wallet key derivation is handled entirely within the app from the user's
 * CryptoSession — no external wallet SDK required.
 *
 * Optional:
 *   EXPO_PUBLIC_PIMLICO_API_KEY — enables USDC gas (ERC-20 paymaster)
 *   Without a key, UserOps use Pimlico's public bundler and pay gas in ETH.
 *
 * Base RPC (public by default):
 *   EXPO_PUBLIC_BASE_RPC_URL — defaults to https://mainnet.base.org
 */

import { fallback, http } from 'viem';
import { env } from '../../../config/env';

/** Pimlico API key — required only for USDC gas (ERC-20 paymaster). */
export const PIMLICO_API_KEY = env.pimlicoApiKey;

const PIMLICO_SETUP_HINT =
  'Set EXPO_PUBLIC_PIMLICO_API_KEY in .env (get a key at https://dashboard.pimlico.io), then restart the dev server.';

/** @deprecated Public bundler works without a key; kept for callers that still check. */
export function assertPimlicoConfigured(): void {
  if (!PIMLICO_API_KEY) {
    throw new Error(
      `Pimlico API key is required for USDC gas. ${PIMLICO_SETUP_HINT} ` +
        'Leave the key empty to pay gas in ETH via the public bundler.',
    );
  }
}

/** Free public Base mainnet RPC (default + fallback). */
export const BASE_RPC_FALLBACK_URL = 'https://mainnet.base.org' as const;

/**
 * Base mainnet RPC (primary).
 * Uses EXPO_PUBLIC_BASE_RPC_URL when set, otherwise the free public node.
 * {@link getBaseRpcUrls} appends the public fallback when primary differs.
 */
export const BASE_RPC_URL = env.baseRpcUrl || BASE_RPC_FALLBACK_URL;

/** Ordered RPC endpoints — primary first, public Base fallback last (deduped). */
export function getBaseRpcUrls(): readonly string[] {
  if (BASE_RPC_URL === BASE_RPC_FALLBACK_URL) return [BASE_RPC_URL];
  return [BASE_RPC_URL, BASE_RPC_FALLBACK_URL];
}

/** viem transport: tries primary RPC, then {@link BASE_RPC_FALLBACK_URL}. */
export function createBaseTransport() {
  return fallback(getBaseRpcUrls().map((url) => http(url)));
}

/** USDC on Base mainnet */
export const USDC_BASE =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/** Wrapped ETH on Base */
export const WETH_BASE =
  '0x4200000000000000000000000000000000000006' as const;

/** Pimlico public bundler (no API key) — Base chain id 8453. */
export const PIMLICO_PUBLIC_BUNDLER_URL =
  'https://public.pimlico.io/v2/8453/rpc' as const;

/**
 * Bundler RPC for UserOps.
 * Authenticated Pimlico when a key is set; otherwise the public endpoint.
 */
export const PIMLICO_BUNDLER_URL = PIMLICO_API_KEY
  ? (`https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_API_KEY}` as const)
  : PIMLICO_PUBLIC_BUNDLER_URL;

/** @deprecated Prefer {@link PIMLICO_BUNDLER_URL}. */
export const PIMLICO_URL = PIMLICO_BUNDLER_URL;

/**
 * Gas payment mode for ERC-4337 UserOperations.
 *
 *   true  → USDC via Pimlico ERC-20 paymaster
 *           (requires EXPO_PUBLIC_PIMLICO_API_KEY + EXPO_PUBLIC_PAY_GAS_IN_USDC=true)
 *   false → SCA pays gas in ETH on the public (or authenticated) bundler
 *
 * Without a Pimlico key this is always false (ETH via public bundler).
 */
export const PAY_GAS_IN_USDC = Boolean(PIMLICO_API_KEY) && env.payGasInUsdc;

/** ERC-20 token the user pays gas in when {@link PAY_GAS_IN_USDC} is enabled. */
export const GAS_TOKEN = USDC_BASE;

/**
 * Safety multiplier applied to the estimated USDC gas cost when reserving funds.
 * The estimate is already a max cost, but fees can move between estimate and
 * submission, so we reserve a little extra. Over-reserving a few cents is far
 * cheaper than a UserOp that reverts for lack of gas.
 */
export const GAS_RESERVE_BUFFER = 1.3;

/**
 * Fallback USDC reserve used when the live estimate is unavailable (e.g. the
 * bundler RPC fails). Base gas is cheap, so a fixed ~$0.10 comfortably covers a
 * single transfer/swap UserOp.
 */
export const GAS_RESERVE_FALLBACK_USDC = 0.1;

/** expo-secure-store key for persisting the counterfactual Smart Account address */
export const WALLET_ADDRESS_STORE_KEY = 'kura_smart_wallet_address_v1' as const;

/**
 * expo-secure-store key for an imported private key (hex, without 0x prefix).
 * When present, the hook uses this key instead of the session-derived one.
 * Cleared when the user disconnects/resets to the derived wallet.
 */
export const WALLET_IMPORTED_KEY = 'kura_wallet_imported_privkey_v1' as const;

/**
 * Clear all locally-cached wallet material (cached SCA address + imported key).
 *
 * MUST be called on logout: the cached SCA/EOA address is account-specific, so
 * leaving it behind would leak the previous user's wallet into the next session
 * on the same device.
 */
export async function clearLocalWalletCache(): Promise<void> {
  const SecureStore = await import('expo-secure-store');
  await Promise.allSettled([
    SecureStore.deleteItemAsync(WALLET_ADDRESS_STORE_KEY),
    SecureStore.deleteItemAsync(WALLET_IMPORTED_KEY),
  ]);
}
