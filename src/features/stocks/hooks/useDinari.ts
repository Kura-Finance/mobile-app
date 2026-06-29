/**
 * Dinari hooks.
 *
 *  useDinariGate   — shared store KYC + wallet-connect gating.
 *  useDinariStocks — shared store catalog + portfolio holdings (quotes per page in list UI).
 *  placeDinariOrder — prepare → SCA-sign → submit → poll until filled/failed.
 */
import { useCallback, useEffect } from 'react';

import i18n from '../../../shared/locales/i18n';
import * as dinari from '../../../lib/api/dinari/client';
import type {
  DinariOrderResult,
  OrderSide,
} from '../../../lib/api/dinari/client';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useDinariGateStore } from '../store/useDinariGateStore';
import { useStocksStore } from '../store/useStocksStore';
import type { GateState, StockItem } from '../types';

export type { GateState, StockItem };

// ─────────────────────────────────────────────────────────────────────────────
// Gating
// ─────────────────────────────────────────────────────────────────────────────

export function useDinariGate(
  scaAddress: string,
  signMessage: UseKuraCardWalletReturn['signMessage'],
  options?: { deferInitialCheck?: boolean; active?: boolean },
) {
  const deferInitialCheck = options?.deferInitialCheck ?? false;
  const active = options?.active ?? true;

  const state = useDinariGateStore((s) => s.state);
  const entity = useDinariGateStore((s) => s.entity);
  const account = useDinariGateStore((s) => s.account);
  const error = useDinariGateStore((s) => s.error);
  const connecting = useDinariGateStore((s) => s.connecting);
  const bindScaAddress = useDinariGateStore((s) => s.bindScaAddress);
  const resolve = useDinariGateStore((s) => s.resolve);
  const refreshEntity = useDinariGateStore((s) => s.refreshEntity);
  const startKyc = useDinariGateStore((s) => s.startKyc);
  const storeConnectWallet = useDinariGateStore((s) => s.connectWallet);

  useEffect(() => {
    bindScaAddress(scaAddress);
  }, [scaAddress, bindScaAddress]);

  useEffect(() => {
    if (deferInitialCheck || !scaAddress || !active) return;
    void resolve();
  }, [scaAddress, deferInitialCheck, active, resolve]);

  const connectWallet = useCallback(
    () => storeConnectWallet(signMessage),
    [signMessage, storeConnectWallet],
  );

  return { state, entity, account, error, connecting, resolve, refreshEntity, startKyc, connectWallet };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stocks list + prices + holdings
// ─────────────────────────────────────────────────────────────────────────────

export function useDinariStocks(
  enabled: boolean,
  options?: { includePortfolio?: boolean },
) {
  const includePortfolio = options?.includePortfolio ?? true;
  const stocks = useStocksStore((s) => s.stocks);
  const totalValue = useStocksStore((s) => s.totalValue);
  const hasLoaded = useStocksStore((s) => s.hasLoaded);
  const storeLoading = useStocksStore((s) => s.loading);
  const refreshing = useStocksStore((s) => s.refreshing);
  const error = useStocksStore((s) => s.error);
  const load = useStocksStore((s) => s.load);

  const loading = storeLoading || (enabled && !hasLoaded);

  useEffect(() => {
    if (!enabled) return;
    void load({ includePortfolio });
  }, [enabled, includePortfolio, load]);

  const refresh = useCallback(
    () => load({ includePortfolio, force: true }),
    [includePortfolio, load],
  );

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
  onStatus?.(i18n.t('crypto.stockOrderPreparing'));
  const prepared = await dinari.prepareOrder({
    side,
    stockId,
    ...(side === 'BUY'
      ? { paymentTokenQuantity: quantity }
      : { assetTokenQuantity: quantity }),
  });

  onStatus?.(i18n.t('crypto.stockOrderAwaitingSignature'));
  const permitSignature = await signTypedData(prepared.permit);

  onStatus?.(i18n.t('crypto.stockOrderSubmitting'));
  let order = await dinari.submitOrder({
    orderRequestId: prepared.orderRequestId,
    permitSignature,
  });

  // Poll order-request until an on-chain orderId appears.
  let guard = 0;
  while (!order.orderId && !TERMINAL_FAIL.has(order.status) && guard < 60) {
    if (isCancelled?.()) return { ok: false, status: 'CANCELLED', order };
    await sleep(5000);
    onStatus?.(i18n.t('crypto.stockOrderConfirming'));
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
    onStatus?.(i18n.t('crypto.stockOrderFilling'));
    order = await dinari.getOrder(order.orderId);
    guard++;
  }

  return { ok: TERMINAL_OK.has(order.status), status: order.status, order };
}
