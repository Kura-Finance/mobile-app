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
