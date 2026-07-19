import * as dinari from '../../../lib/api/dinari/client';
import type { DinariStock } from '../../../lib/api/dinari/client';
import { isDinariWhitelistError } from '../../../lib/api/dinari/errors';
import { applyYahooMarket, fetchYahooMarketMap } from '../utils/yahooStockStats';
import type { StockItem } from '../types';

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** Fetch Dinari catalog and optionally merge portfolio holdings + holding quotes. */
export async function fetchStocksCatalog(includePortfolio: boolean): Promise<{
  stocks: StockItem[];
  totalValue: number;
}> {
  const [list, portfolio] = await Promise.all([
    dinari.listAllStocks(),
    includePortfolio
      ? dinari.getPortfolio().catch(() => ({ positions: [] as Record<string, unknown>[] }))
      : Promise.resolve({ positions: [] as Record<string, unknown>[] }),
  ]);

  const positions = portfolio?.positions ?? [];
  const holdingByStock = new Map<string, number>();
  const holdingBySymbol = new Map<string, number>();
  const valueByStock = new Map<string, number>();
  const valueBySymbol = new Map<string, number>();

  for (const p of positions) {
    const qty = num(p.quantity);
    const marketValue = num(p.marketValue);
    if (p.stockId) {
      holdingByStock.set(String(p.stockId), qty);
      if (marketValue > 0) valueByStock.set(String(p.stockId), marketValue);
    }
    if (p.symbol) {
      const sym = String(p.symbol).toUpperCase();
      holdingBySymbol.set(sym, qty);
      if (marketValue > 0) valueBySymbol.set(sym, marketValue);
    }
  }

  const indexed = list.map((s: DinariStock) => {
    const sym = String(s.symbol).toUpperCase();
    const holdings =
      holdingByStock.get(String(s.id)) ??
      holdingBySymbol.get(sym) ??
      0;
    const value =
      valueByStock.get(String(s.id)) ??
      valueBySymbol.get(sym) ??
      0;
    return {
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      price: 0,
      change24h: null,
      holdings,
      value,
    } satisfies StockItem;
  });

  const holdingSymbols = indexed
    .filter((item) => item.holdings > 0)
    .map((item) => item.symbol);

  let enriched = indexed;
  if (holdingSymbols.length > 0) {
    const market = await fetchYahooMarketMap(holdingSymbols);
    enriched = indexed.map((item) =>
      applyYahooMarket(item, market.get(String(item.symbol).toUpperCase())),
    );
  }

  const totalValue = enriched.reduce((sum, s) => sum + s.value, 0);
  return { stocks: enriched, totalValue };
}

export class StocksCatalogLoadError extends Error {
  readonly silent: boolean;

  constructor(message: string, silent: boolean) {
    super(message);
    this.name = 'StocksCatalogLoadError';
    this.silent = silent;
  }
}

export async function fetchStocksCatalogSafe(includePortfolio: boolean): Promise<{
  stocks: StockItem[];
  totalValue: number;
}> {
  try {
    return await fetchStocksCatalog(includePortfolio);
  } catch (e: unknown) {
    if (isDinariWhitelistError(e)) {
      throw new StocksCatalogLoadError('', true);
    }
    throw new StocksCatalogLoadError(
      e instanceof Error ? e.message : 'Failed to load stocks.',
      false,
    );
  }
}
