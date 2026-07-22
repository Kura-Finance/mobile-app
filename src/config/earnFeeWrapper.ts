/**
 * Morpho V2 fee-wrapper address routing.
 *
 * Deposits can go through a fee-wrapper vault that skims performance fee on
 * yield. Map inner (listed) vault addresses → wrapper deposit addresses via:
 *
 *   1. `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES` — explicit JSON map (always wins)
 *   2. Morpho API auto-discovery — optional, when fee + recipient are configured
 *
 * @see docs/fork-guide.md
 */

import { env } from './env';
import { OFFICIAL_FEE_WRAPPER_DEFAULTS as OFFICIAL_FEE_WRAPPER_DEFAULTS_SOURCE } from './morphoVaultAddresses';

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function envBool(raw: string, fallback: boolean): boolean {
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

/** inner vault (lowercase) → fee-wrapper vault deposit address */
export type MorphoFeeWrapperMap = Record<string, `0x${string}`>;

/**
 * Official-app fee-wrapper vaults on Base (inner Morpho vault → FeeWrapper).
 * Forks / buyers should set `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES` to their
 * own contracts, or set `EXPO_PUBLIC_MORPHO_EARN_FEE=0` to disable yield fees.
 * Env overrides matching keys.
 */
export const OFFICIAL_FEE_WRAPPER_DEFAULTS: MorphoFeeWrapperMap = {
  ...OFFICIAL_FEE_WRAPPER_DEFAULTS_SOURCE,
};

/** @deprecated Prefer {@link OFFICIAL_FEE_WRAPPER_DEFAULTS}. */
export const DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES = OFFICIAL_FEE_WRAPPER_DEFAULTS;

export function normalizeMorphoVaultAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Parse `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES`.
 * JSON object: `{ "0xInnerVault...": "0xWrapperVault..." }`
 */
export function parseMorphoFeeWrapperOverrides(raw: string): MorphoFeeWrapperMap {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: MorphoFeeWrapperMap = {};
    for (const [inner, wrapper] of Object.entries(parsed)) {
      if (
        typeof inner === 'string' &&
        typeof wrapper === 'string' &&
        ETH_ADDRESS.test(inner) &&
        ETH_ADDRESS.test(wrapper)
      ) {
        out[normalizeMorphoVaultAddress(inner)] = wrapper as `0x${string}`;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Static inner → wrapper map: defaults merged with env (env wins per key). Keys are lowercase. */
function mergeFeeWrapperMaps(...maps: MorphoFeeWrapperMap[]): MorphoFeeWrapperMap {
  const out: MorphoFeeWrapperMap = {};
  for (const map of maps) {
    for (const [inner, wrapper] of Object.entries(map)) {
      out[normalizeMorphoVaultAddress(inner)] = wrapper;
    }
  }
  return out;
}

export const MORPHO_FEE_WRAPPER_OVERRIDES: MorphoFeeWrapperMap = mergeFeeWrapperMaps(
  OFFICIAL_FEE_WRAPPER_DEFAULTS,
  parseMorphoFeeWrapperOverrides(env.morphoFeeWrapperOverrides),
);

/**
 * When true, query Morpho for FeeWrapper vaults matching fee rate + recipient.
 * Default: enabled. Set `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_AUTO_DISCOVER=false` to
 * use env overrides only.
 */
export function isMorphoFeeWrapperAutoDiscoverEnabled(): boolean {
  return envBool(env.morphoFeeWrapperAutoDiscover, true);
}

/** Resolve deposit target from a pre-built map (sync — tests / previews). */
export function resolveMorphoDepositFromMap(
  innerVaultAddress: string,
  map: MorphoFeeWrapperMap,
): { depositAddress: string; usesFeeWrapper: boolean } {
  const inner = normalizeMorphoVaultAddress(innerVaultAddress);
  const wrapper = map[inner];
  if (wrapper) {
    return { depositAddress: wrapper, usesFeeWrapper: true };
  }
  return { depositAddress: innerVaultAddress, usesFeeWrapper: false };
}

/** Whether a vault address is a configured inner or fee-wrapper route (sync — for UI). */
export function hasEarnVaultFeeWrapper(vaultAddress: string): boolean {
  const normalized = normalizeMorphoVaultAddress(vaultAddress);
  if (MORPHO_FEE_WRAPPER_OVERRIDES[normalized]) return true;
  // Listed/detail address may be the wrapper vault itself (e.g. after Morpho V2 refresh).
  for (const wrapper of Object.values(MORPHO_FEE_WRAPPER_OVERRIDES)) {
    if (normalizeMorphoVaultAddress(wrapper) === normalized) return true;
  }
  return false;
}

export function morphoFeeWrapperConfigSummary() {
  return {
    overrideCount: Object.keys(MORPHO_FEE_WRAPPER_OVERRIDES).length,
    autoDiscover: isMorphoFeeWrapperAutoDiscoverEnabled(),
  };
}
