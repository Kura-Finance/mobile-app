/** Mask shown when the user enables Hide balance in Security Settings. */
export const HIDDEN_BALANCE_TEXT = '••••••';

export function maskBalanceText(formatted: string, hidden: boolean): string {
  return hidden ? HIDDEN_BALANCE_TEXT : formatted;
}

/** Fiat display with hide-balance support — pass `money.value` / `money.compact` as formatter. */
export function formatSensitiveMoney(
  usd: number,
  hidden: boolean,
  format: (amountUsd: number) => string,
): string {
  if (hidden) return HIDDEN_BALANCE_TEXT;
  return format(usd);
}

/** @deprecated Use useMoneyFormat().compact instead. */
export function formatUsdCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** @deprecated Use formatSensitiveMoney(usd, hidden, money.value) instead. */
export function formatSensitiveUsd(n: number, hidden: boolean): string {
  if (hidden) return HIDDEN_BALANCE_TEXT;
  return formatUsdCompact(n);
}
