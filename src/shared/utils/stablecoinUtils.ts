/**
 * Utility functions for stablecoin detection
 * Supports common stablecoin variants across different blockchains
 */

/**
 * 检测是否为稳定币（包括不同链上的变体）
 * 支持：USDC, USDT, USDC.B, USDT.E, USDC.E, USDT.E 等
 * 
 * 示例：
 * - USDC (Ethereum)
 * - USDC.B (Base)
 * - USDT (Ethereum)
 * - USDT.E (Avalanche)
 * - USDC.E (Avalanche)
 */
export function isStablecoin(symbol: string): boolean {
  if (!symbol) return false;
  
  return (
    symbol === 'USDC' ||
    symbol === 'USDT' ||
    symbol === 'DAI' ||
    symbol === 'BUSD' ||
    symbol.startsWith('USDC.') ||
    symbol.startsWith('USDT.') ||
    symbol.startsWith('DAI.')
  );
}

/**
 * 获取稳定币的标准价格
 * 稳定币的价格应该 ≈ 1.0 USD
 * 如果后端没有提供价格，使用此默认值
 */
export const STABLECOIN_PRICE = 1.0;

/**
 * 验证和规范化投资价格
 * 如果检测到稳定币但价格为 0，使用默认价格
 */
export function normalizeInvestmentPrice(
  symbol: string,
  price: number
): number {
  // 如果价格为 0 或无效，且是稳定币，使用默认价格
  if (isStablecoin(symbol) && price === 0) {
    return STABLECOIN_PRICE;
  }
  
  // 否则返回原始价格
  return price;
}
