import type { MorphoMarket } from '../../../lib/api/morpho/markets';

export function borrowFavoriteKey(market: MorphoMarket): string {
  return `borrow:${market.marketId.toLowerCase()}`;
}
