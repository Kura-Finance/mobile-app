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

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function envBool(raw: string, fallback: boolean): boolean {
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

/** inner vault (lowercase) → fee-wrapper vault deposit address */
export type MorphoFeeWrapperMap = Record<string, `0x${string}`>;

/**
 * Kura fee-wrapper vaults on Base (inner Morpho vault → Kura FeeWrapper).
 * Env `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES` overrides matching keys.
 */
export const DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES = {
  '0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9': '0x0F457aa0AfD3D208cbfEE520804118f88965a529',
  '0x94Af495DE1F56Aa5576dEB17986bDCeE5Dd9778D': '0x6D10990b11f88EE40e4ABc2f8CbE1f7194190Db0',
  '0x050cE30b927Da55177A4914EC73480238BAD56f0': '0x50e8B8B50037322BE0Efc2048d66Cb957f349816',
  '0x1deEfABEe758AAbdC29a542B24ca3b75aFD56765': '0x07540AeeD4B12408c87365417aE7CE59A966CA47',
} as const satisfies MorphoFeeWrapperMap;

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
  DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES,
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
