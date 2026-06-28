/** User position LTV helpers for Morpho borrow markets. */

import { parseUnits } from 'viem';

import { ORACLE_PRICE_SCALE, WAD } from '../../../lib/wallet/morphoBlue';

/** Default LTV used when auto-filling collateral from a borrow amount. */
export const BORROW_AUTOFILL_LTV = 0.6;

export function parseMarketMaxLltv(raw: string): number | null {
  try {
    const value = Number(raw) / 1e18;
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  } catch {
    return null;
  }
}

/** Debt / collateral in USD (0–1 fraction). */
export function computeUserLtvRatio(borrowedUsd: number, collateralUsd: number): number | null {
  if (borrowedUsd <= 0 || collateralUsd <= 0) return null;
  const ratio = borrowedUsd / collateralUsd;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function formatUserLtvPercent(ratio: number | null): string {
  if (ratio == null) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

/** How close the position is to the market max LTV (0–1+). */
export function ltvUtilization(userLtv: number, maxLltv: number): number | null {
  if (maxLltv <= 0) return null;
  return userLtv / maxLltv;
}

export type LtvRiskLevel = 'safe' | 'warning' | 'danger';

export function ltvRiskLevel(userLtv: number, maxLltv: number): LtvRiskLevel {
  const util = ltvUtilization(userLtv, maxLltv) ?? 0;
  if (util >= 0.9) return 'danger';
  if (util >= 0.75) return 'warning';
  return 'safe';
}

/** Collateral × LLTV / debt. Values above 1.0 are safer. */
export function computeHealthFactor(
  borrowedUsd: number,
  collateralUsd: number,
  maxLltv: number | null,
): number | null {
  if (borrowedUsd <= 0 || collateralUsd <= 0 || maxLltv == null || maxLltv <= 0) return null;
  const factor = (collateralUsd * maxLltv) / borrowedUsd;
  return Number.isFinite(factor) && factor > 0 ? factor : null;
}

export function formatHealthFactor(factor: number | null): string {
  if (factor == null) return '—';
  if (factor >= 10) return '10+';
  return factor.toFixed(2);
}

export function healthFactorRiskLevel(factor: number | null): LtvRiskLevel {
  if (factor == null) return 'safe';
  if (factor <= 1.05) return 'danger';
  if (factor <= 1.25) return 'warning';
  return 'safe';
}

function amountToRaw(amount: number, decimals: number): bigint {
  if (amount <= 0) return 0n;
  const raw = amount.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
  try {
    return parseUnits(safe as `${number}`, decimals);
  } catch {
    return 0n;
  }
}

/** Additional collateral (human amount) to supply for a new borrow at target LTV. */
export function computeAdditionalCollateralForBorrow(params: {
  borrowAmount: number;
  loanDecimals: number;
  collateralDecimals: number;
  oraclePrice: bigint;
  existingCollateralRaw: bigint;
  existingBorrowRaw: bigint;
  targetLtv?: number;
}): number {
  const {
    borrowAmount,
    loanDecimals,
    collateralDecimals,
    oraclePrice,
    existingCollateralRaw,
    existingBorrowRaw,
    targetLtv = BORROW_AUTOFILL_LTV,
  } = params;

  if (borrowAmount <= 0 || oraclePrice <= 0n || targetLtv <= 0) return 0;

  const newBorrowRaw = amountToRaw(borrowAmount, loanDecimals);
  if (newBorrowRaw <= 0n) return 0;

  const ltvWad = BigInt(Math.round(targetLtv * 1e18));
  const totalBorrowRaw = existingBorrowRaw + newBorrowRaw;
  const totalCollateralRaw =
    (totalBorrowRaw * ORACLE_PRICE_SCALE * WAD) / (oraclePrice * ltvWad);

  const additionalRaw = totalCollateralRaw > existingCollateralRaw
    ? totalCollateralRaw - existingCollateralRaw
    : 0n;

  return Number(additionalRaw) / 10 ** collateralDecimals;
}
