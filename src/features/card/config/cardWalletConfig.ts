/**
 * Configuration for the Kura Smart Card Wallet (ERC-4337 on Base).
 *
 * Wallet key derivation is handled entirely within the app from the user's
 * CryptoSession — no external wallet SDK required.
 *
 * Required env vars:
 *   EXPO_PUBLIC_PIMLICO_API_KEY  — from https://dashboard.pimlico.io
 *   EXPO_PUBLIC_ALCHEMY_API_KEY  — from https://dashboard.alchemy.com (Base RPC)
 *   EXPO_PUBLIC_BASE_RPC_URL     — optional custom RPC if Alchemy key is unset
 *
 * Free-tier limits (no subscription):
 *   Pimlico — ~13,000 UserOps/month free, $0.0075/op after
 */

import { fallback, http } from 'viem';
import { env } from '../../../config/env';

/** Pimlico API key — ERC-4337 bundler + Verifying Paymaster on Base */
export const PIMLICO_API_KEY = env.pimlicoApiKey;

const PIMLICO_SETUP_HINT =
  'Set EXPO_PUBLIC_PIMLICO_API_KEY in .env (get a key at https://dashboard.pimlico.io), then restart the dev server.';

/** Throws when the Pimlico bundler key is missing — avoids opaque 401s from Pimlico. */
export function assertPimlicoConfigured(): void {
  if (!PIMLICO_API_KEY) {
    throw new Error(`Pimlico API key is not configured. ${PIMLICO_SETUP_HINT}`);
  }
}

/** Public Base RPC used when the primary endpoint is unreachable. */
export const BASE_RPC_FALLBACK_URL = 'https://mainnet.base.org' as const;

/** Alchemy API key — builds the Base mainnet RPC URL when set. */
export const ALCHEMY_API_KEY = env.alchemyApiKey;

const ALCHEMY_BASE_RPC_URL = ALCHEMY_API_KEY
  ? (`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` as const)
  : '';

/**
 * Base mainnet RPC (primary).
 * Priority: Alchemy key → EXPO_PUBLIC_BASE_RPC_URL → public Base fallback.
 * {@link getBaseRpcUrls} appends {@link BASE_RPC_FALLBACK_URL} when primary differs.
 */
export const BASE_RPC_URL =
  ALCHEMY_BASE_RPC_URL || env.baseRpcUrl || BASE_RPC_FALLBACK_URL;

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

/** Pimlico bundler/paymaster URL for Base */
export const PIMLICO_URL =
  `https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_API_KEY}` as const;

/**
 * Gas payment mode for ERC-4337 UserOperations.
 *
 *   false → Kura sponsors gas via Pimlico's *verifying* paymaster (fully gasless
 *           for the user; Kura pays the bill).
 *   true  → the user pays gas in USDC via Pimlico's *ERC-20* paymaster. The first
 *           UserOp from the SCA batches an unlimited USDC approval to the ERC-20
 *           paymaster contract so it can pull each op's gas cost in USDC.
 *
 * Toggle without a code change via EXPO_PUBLIC_PAY_GAS_IN_USDC=true|false.
 * Defaults to `true` (user pays in USDC).
 */
export const PAY_GAS_IN_USDC = env.payGasInUsdc;

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
