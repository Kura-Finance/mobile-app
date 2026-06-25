/**
 * Dinari hooks.
 *
 *  useDinariGate   — KYC + wallet-connect gating state machine.
 *  useDinariStocks — full Dinari catalog index + lazy prices for featured / held / starred.
 *  placeDinariOrder — prepare → SCA-sign → submit → poll until filled/failed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import * as dinari from '../../../lib/api/dinari/client';
import type {
  DinariAccount,
  DinariEntity,
  DinariOrderResult,
  DinariStock,
  OrderSide,
} from '../../../lib/api/dinari/client';
import { isDinariWhitelistError } from '../../../lib/api/dinari/errors';
import { KuraApiError } from '../../../lib/api/errors';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { DEFAULT_STOCK_SYMBOLS } from '../config/dinariStocks';

// ─────────────────────────────────────────────────────────────────────────────
// Gating
// ─────────────────────────────────────────────────────────────────────────────

export type GateState =
  | 'idle'        // gate check deferred (quotes-only view)
  | 'checking'    // loading entity/account
  | 'kyc'         // KYC required (canTransact === false)
  | 'connect'     // KYC ok but SCA not connected
  | 'ready'       // good to trade
  | 'waitlist'    // user not on Dinari whitelist — join waitlist
  | 'unsupported'; // backend not configured / unreachable

export function useDinariGate(
  scaAddress: string,
  signMessage: UseKuraCardWalletReturn['signMessage'],
  options?: { deferInitialCheck?: boolean },
) {
  const deferInitialCheck = options?.deferInitialCheck ?? false;
  const [state, setState] = useState<GateState>(deferInitialCheck ? 'idle' : 'checking');
  const [entity, setEntity] = useState<DinariEntity | null>(null);
  const [account, setAccount] = useState<DinariAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const resolve = useCallback(async (): Promise<GateState> => {
    setError(null);
    setState('checking');
    try {
      const ent = await dinari.getEntity();
      setEntity(ent);
      if (!ent.canTransact) {
        setState('kyc');
        return 'kyc';
      }
      const acc = await dinari.getAccount();
      setAccount(acc);
      const connected =
        !!acc.walletAddress &&
        scaAddress &&
        acc.walletAddress.toLowerCase() === scaAddress.toLowerCase();
      const next = connected ? 'ready' : 'connect';
      setState(next);
      return next;
    } catch (e: unknown) {
      if (isDinariWhitelistError(e)) {
        setError(e instanceof KuraApiError ? e.message : 'Not on whitelist.');
        setState('waitlist');
        return 'waitlist';
      }
      // 404 / network / not-configured → graceful "unsupported" state.
      setError(e instanceof Error ? e.message : 'Dinari is unavailable right now.');
      setState('unsupported');
      return 'unsupported';
    }
  }, [scaAddress]);

  useEffect(() => {
    if (deferInitialCheck || !scaAddress) return;
    setState('checking');
    void resolve();
  }, [scaAddress, resolve, deferInitialCheck]);

  /** Re-check entity only (used while polling after KYC submission). */
  const refreshEntity = useCallback(async () => {
    try {
      const ent = await dinari.getEntity();
      setEntity(ent);
      if (ent.canTransact) await resolve();
      return ent;
    } catch {
      return null;
    }
  }, [resolve]);

  const startKyc = useCallback(async (name?: string) => {
    const link = await dinari.createKycLink(name);
    return link.embedUrl;
  }, []);

  const connectWallet = useCallback(async () => {
    if (!scaAddress) throw new Error('Wallet not ready.');
    setConnecting(true);
    setError(null);
    try {
      const { nonce, message, chainId } = await dinari.getWalletNonce(scaAddress);
      const signature = await signMessage(message);
      const acc = await dinari.connectWallet({
        walletAddress: scaAddress,
        nonce,
        signature,
        ...(chainId ? { chainId } : {}),
      });
      setAccount(acc);
      setState('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to connect wallet to Dinari.');
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [scaAddress, signMessage]);

  return { state, entity, account, error, connecting, resolve, refreshEntity, startKyc, connectWallet };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stocks list + prices + holdings
// ─────────────────────────────────────────────────────────────────────────────

export interface StockItem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  holdings: number;   // dShares held
  value: number;      // USD market value
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function featuredSortIndex(symbol: string): number {
  const idx = DEFAULT_STOCK_SYMBOLS.indexOf(symbol.toUpperCase());
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function sortStockItems(items: StockItem[]): StockItem[] {
  return [...items].sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;
    const featured = featuredSortIndex(a.symbol) - featuredSortIndex(b.symbol);
    if (featured !== 0) return featured;
    return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: 'base' });
  });
}

function symbolsNeedingPrice(
  list: DinariStock[],
  holdingBySymbol: Map<string, number>,
  favoriteSymbols: string[],
): DinariStock[] {
  const targets = new Set<string>(DEFAULT_STOCK_SYMBOLS);
  for (const sym of holdingBySymbol.keys()) targets.add(sym.toUpperCase());
  for (const sym of favoriteSymbols) targets.add(sym.toUpperCase());

  return list.filter((s) => targets.has(s.symbol.toUpperCase()));
}

async function fetchStockPrices(stocksToPrice: DinariStock[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  await Promise.all(
    stocksToPrice.map(async (s) => {
      try {
        const p = await dinari.getStockPrice(s.id);
        prices.set(String(s.id), num(p.price));
      } catch {
        prices.set(String(s.id), 0);
      }
    }),
  );
  return prices;
}

export function useDinariStocks(
  enabled: boolean,
  options?: { includePortfolio?: boolean; favoriteSymbols?: string[] },
) {
  const includePortfolio = options?.includePortfolio ?? true;
  const favoriteSymbols = options?.favoriteSymbols ?? [];
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const [list, portfolio] = await Promise.all([
        dinari.listAllStocks(),
        includePortfolio
          ? dinari.getPortfolio().catch(() => ({ positions: [] as any[] }))
          : Promise.resolve({ positions: [] as any[] }),
      ]);

      // Holdings keyed by stockId and by symbol for resilience.
      const positions = (portfolio?.positions ?? []) as any[];
      const holdingByStock = new Map<string, number>();
      const holdingBySymbol = new Map<string, number>();
      for (const p of positions) {
        const qty = num(p.quantity);
        if (p.stockId) holdingByStock.set(String(p.stockId), qty);
        if (p.symbol) holdingBySymbol.set(String(p.symbol).toUpperCase(), qty);
      }

      // Price only featured watchlist tickers + anything the user holds.
      const stocksToPrice = symbolsNeedingPrice(list, holdingBySymbol, favoriteSymbols);
      const priceById = await fetchStockPrices(stocksToPrice);

      const indexed = list.map((s: DinariStock) => {
        const holdings =
          holdingByStock.get(String(s.id)) ??
          holdingBySymbol.get(String(s.symbol).toUpperCase()) ??
          0;
        const price = priceById.get(String(s.id)) ?? 0;
        return {
          id: s.id,
          symbol: s.symbol,
          name: s.name,
          price,
          holdings,
          value: holdings * price,
        } as StockItem;
      });

      const sorted = sortStockItems(indexed);

      setStocks(sorted);
      setTotalValue(sorted.reduce((sum, s) => sum + s.value, 0));
      hasLoadedRef.current = true;
    } catch (e: unknown) {
      if (!isDinariWhitelistError(e)) {
        setError(e instanceof Error ? e.message : 'Failed to load stocks.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [favoriteSymbols, includePortfolio]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, includePortfolio, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { stocks, totalValue, loading, refreshing, error, refresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order placement (prepare → sign → submit → poll)
// ─────────────────────────────────────────────────────────────────────────────

const TERMINAL_OK = new Set(['FILLED']);
const TERMINAL_FAIL = new Set(['ERROR', 'CANCELLED', 'EXPIRED', 'REJECTED']);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface PlaceOrderParams {
  side: OrderSide;
  stockId: string;
  /** BUY: USDC amount string. SELL: dShare quantity string. */
  quantity: string;
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  /** Progress callback for UI status text. */
  onStatus?: (status: string) => void;
  /** Abort signal — set true to stop polling. */
  isCancelled?: () => boolean;
}

export interface PlaceOrderResult {
  ok: boolean;
  status: string;
  order: DinariOrderResult;
}

export async function placeDinariOrder({
  side,
  stockId,
  quantity,
  signTypedData,
  onStatus,
  isCancelled,
}: PlaceOrderParams): Promise<PlaceOrderResult> {
  onStatus?.('Preparing order…');
  const prepared = await dinari.prepareOrder({
    side,
    stockId,
    ...(side === 'BUY'
      ? { paymentTokenQuantity: quantity }
      : { assetTokenQuantity: quantity }),
  });

  onStatus?.('Awaiting signature…');
  const permitSignature = await signTypedData(prepared.permit);

  onStatus?.('Submitting…');
  let order = await dinari.submitOrder({
    orderRequestId: prepared.orderRequestId,
    permitSignature,
  });

  // Poll order-request until an on-chain orderId appears.
  let guard = 0;
  while (!order.orderId && !TERMINAL_FAIL.has(order.status) && guard < 60) {
    if (isCancelled?.()) return { ok: false, status: 'CANCELLED', order };
    await sleep(5000);
    onStatus?.('Confirming on-chain…');
    order = await dinari.getOrderRequest(prepared.orderRequestId);
    guard++;
  }

  if (TERMINAL_FAIL.has(order.status)) {
    return { ok: false, status: order.status, order };
  }

  // Poll the on-chain order until terminal.
  guard = 0;
  while (order.orderId && !TERMINAL_OK.has(order.status) && !TERMINAL_FAIL.has(order.status) && guard < 60) {
    if (isCancelled?.()) return { ok: false, status: 'CANCELLED', order };
    await sleep(10000);
    onStatus?.('Filling order…');
    order = await dinari.getOrder(order.orderId);
    guard++;
  }

  return { ok: TERMINAL_OK.has(order.status), status: order.status, order };
}
