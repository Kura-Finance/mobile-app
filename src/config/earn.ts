/**
 * Morpho Earn configuration.
 *
 * Vault listings use Morpho's public GraphQL API. Deposits and withdrawals
 * require a Pimlico smart-account key. All env vars are read via {@link env}.
 *
 * @see docs/fork-guide.md
 */

import { env, hasPimlicoApiKey } from './env';
import { hasEarnVaultFeeWrapper, morphoFeeWrapperConfigSummary, MORPHO_FEE_WRAPPER_OVERRIDES, normalizeMorphoVaultAddress } from './earnFeeWrapper';
import { DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST } from './morphoVaultAddresses';

// ── Defaults (official app allowlist — forks may override via env) ────────────

/** Underlying Morpho vaults (Base) — Steakhouse Prime USDC, Gauntlet EURC Balanced, Gauntlet USDC Prime, Gauntlet USDC Frontier. */
export { DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST };

/**
 * Display-only stats source when the listed V2 vault TVL/APY is not representative
 * (e.g. new V2 clone with minimal deposits). Deposit routing address is unchanged.
 */
export const DEFAULT_EARN_VAULT_STATS_SOURCES: Record<string, `0x${string}`> = {};

export function getEarnVaultStatsSource(vaultAddress: string): `0x${string}` | null {
  return DEFAULT_EARN_VAULT_STATS_SOURCES[vaultAddress.toLowerCase()] ?? null;
}

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function envBool(raw: string, fallback: boolean): boolean {
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function parseFeeRate(raw: string): number {
  if (!raw) return 0.1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.1;
  return n;
}

function parseVaultAllowlist(raw: string): readonly `0x${string}`[] {
  if (!raw.trim()) return DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST;
    const addresses = parsed.filter(
      (item): item is `0x${string}` => typeof item === 'string' && ETH_ADDRESS.test(item),
    );
    return addresses.length > 0 ? addresses : DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST;
  } catch {
    return DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST;
  }
}

// ── Feature gate ──────────────────────────────────────────────────────────────

/**
 * Whether Morpho Earn UI and vault actions are enabled.
 * Default: on when a Pimlico key is configured (required for on-chain earn txs).
 */
export function isMorphoEarnEnabled(): boolean {
  return envBool(env.morphoEarnEnabled, hasPimlicoApiKey());
}

// ── Vault allowlist ───────────────────────────────────────────────────────────

export const MORPHO_EARN_VAULT_ALLOWLIST = parseVaultAllowlist(env.morphoEarnVaultAllowlist);

const earnVaultAllowSet = new Set(MORPHO_EARN_VAULT_ALLOWLIST.map((a) => a.toLowerCase()));

export function isEarnVaultAllowed(vaultAddress: string): boolean {
  return earnVaultAllowSet.has(vaultAddress.toLowerCase());
}

export function filterEarnVaultAllowlist<T extends { address: string }>(vaults: T[]): T[] {
  const byAddress = new Map(vaults.map((v) => [v.address.toLowerCase(), v]));
  return MORPHO_EARN_VAULT_ALLOWLIST.map((addr) => byAddress.get(addr.toLowerCase())).filter(
    (v): v is T => v != null,
  );
}

/** Map Morpho position vault (inner or fee-wrapper) → allowlisted inner vault key. */
export function resolveEarnPositionVaultKey(vaultAddress: string): string | null {
  const normalized = normalizeMorphoVaultAddress(vaultAddress);
  if (isEarnVaultAllowed(normalized)) return normalized;

  for (const [inner, wrapper] of Object.entries(MORPHO_FEE_WRAPPER_OVERRIDES)) {
    if (normalizeMorphoVaultAddress(wrapper) === normalized && isEarnVaultAllowed(inner)) {
      return normalizeMorphoVaultAddress(inner);
    }
  }
  return null;
}

// ── Performance fee (optional Morpho V2 fee wrapper) ──────────────────────────

export const MORPHO_EARN_FEE_RATE = parseFeeRate(env.morphoEarnFee);
export const MORPHO_EARN_FEE_BPS = Math.round(MORPHO_EARN_FEE_RATE * 10_000);
export const EARN_FEE_RECIPIENT = env.earnFeeRecipient as `0x${string}` | '';
/** @deprecated Prefer {@link EARN_FEE_RECIPIENT}. */
export const KURA_EARN_FEE_RECIPIENT = EARN_FEE_RECIPIENT;

export function hasEarnFee(): boolean {
  return MORPHO_EARN_FEE_BPS > 0 && EARN_FEE_RECIPIENT.length > 0;
}

/** @deprecated Prefer {@link hasEarnFee}. */
export const hasKuraEarnFee = hasEarnFee;

export function formatEarnFeePercent(): string {
  return `${(MORPHO_EARN_FEE_RATE * 100).toFixed(0)}%`;
}

/** Estimated user APY after yield-only service fee (performance fee on earnings). */
export function effectiveEarnNetApy(grossNetApy: number, appliesServiceFee = hasEarnFee()): number {
  if (!appliesServiceFee || !Number.isFinite(grossNetApy) || grossNetApy <= 0) return grossNetApy;
  return grossNetApy * (1 - MORPHO_EARN_FEE_RATE);
}

/**
 * Whether to disclose the service fee in UI for a vault (sync config check).
 * Uses fee rate + fee-wrapper map only — recipient env is for on-chain routing / API discovery.
 */
export function appliesEarnServiceFee(vaultAddress: string): boolean {
  return MORPHO_EARN_FEE_BPS > 0 && hasEarnVaultFeeWrapper(vaultAddress);
}

// Fee-wrapper routing → src/config/earnFeeWrapper.ts
export {
  DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES,
  MORPHO_FEE_WRAPPER_OVERRIDES,
  hasEarnVaultFeeWrapper,
  isMorphoFeeWrapperAutoDiscoverEnabled,
  morphoFeeWrapperConfigSummary,
  parseMorphoFeeWrapperOverrides,
  resolveMorphoDepositFromMap,
  type MorphoFeeWrapperMap,
} from './earnFeeWrapper';

/** Resolved earn settings snapshot (for debugging / fork docs). */
export function morphoEarnConfigSummary() {
  return {
    enabled: isMorphoEarnEnabled(),
    vaultCount: MORPHO_EARN_VAULT_ALLOWLIST.length,
    performanceFeeBps: MORPHO_EARN_FEE_BPS,
    hasFeeRecipient: EARN_FEE_RECIPIENT.length > 0,
    feeWrapper: morphoFeeWrapperConfigSummary(),
  };
}
