/** Format a token/asset quantity; tiny values show as "<0.000001" instead of scientific notation. */
export function formatTokenQuantity(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.000001) return `<0.000001 ${symbol}`;
  if (n < 1) return `${n.toFixed(4)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(2)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}
