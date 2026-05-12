/**
 * Dinari dShares API client.
 *
 * Talks to the Kura backend proxy at `/api/dinari/*` (the backend holds the
 * Dinari API keys and performs all upstream calls). Mirrors the standard
 * {@link requestJson} envelope-unwrapping pattern used by the other clients.
 *
 * Funding source for orders is the user's existing Base smart account (SCA);
 * the same USDC balance shown in the crypto portfolio.
 *
 * @see Kura × Dinari integration spec.
 */
import { requestJson } from '../client';
import type { TypedDataInput } from '../../../features/card/hooks/useKuraCardWallet';

const API = 'DinariAPI';

/** CAIP-2 chain id for Base mainnet (what Dinari expects). */
export const DINARI_CHAIN_ID = 'eip155:8453';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type KycStatus = 'not_started' | 'PENDING' | 'NEEDS_REVIEW' | 'PASS' | 'FAIL';

export interface DinariEntity {
  entityId: string;
  kycStatus: KycStatus;
  /** The single gating flag — only true once KYC has passed. */
  canTransact: boolean;
}

export interface DinariKycLink {
  embedUrl: string;
  expiresAt: string;
}

export interface DinariAccount {
  accountId: string;
  walletAddress: string | null;
  walletChainId: string | null;
  isActive: boolean;
}

export interface DinariWalletNonce {
  nonce: string;
  message: string;
  /** CAIP-2 chain id used for this nonce — echo back on connect. */
  chainId?: string;
}

export interface DinariStock {
  id: string;
  symbol: string;
  name: string;
  cik?: string;
  // Dinari may include more raw fields; keep it open.
  [key: string]: unknown;
}

export interface DinariStockPrice {
  price: number;
  [key: string]: unknown;
}

export interface DinariStockQuote {
  bid?: number;
  ask?: number;
  spread?: number;
  [key: string]: unknown;
}

export type OrderSide = 'BUY' | 'SELL';

export type OrderRequestStatus =
  | 'QUOTED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'ERROR'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export type OnChainOrderStatus =
  | 'OPEN'
  | 'PENDING_FILL'
  | 'PENDING_ESCROW'
  | 'FILLED'
  | 'REJECTED'
  | 'CANCELLED';

export interface DinariPreparedOrder {
  orderRequestId: string;
  /** EIP-712 typed data — pass straight to the SCA's signTypedData. */
  permit: TypedDataInput;
}

export interface DinariOrderResult {
  orderRequestId: string;
  orderId: string | null;
  status: OrderRequestStatus | OnChainOrderStatus;
  side: OrderSide;
  type: string;
  tif: string;
  stockId: string;
  paymentTokenQuantity: string | null;
  assetTokenQuantity: string | null;
  chainId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DinariPortfolioPosition {
  stockId?: string;
  symbol?: string;
  name?: string;
  quantity?: number | string;
  marketValue?: number | string;
  [key: string]: unknown;
}

export interface DinariPortfolio {
  positions?: DinariPortfolioPosition[];
  [key: string]: unknown;
}

export interface DinariCash {
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC / entity
// ─────────────────────────────────────────────────────────────────────────────

export function getEntity(): Promise<DinariEntity> {
  return requestJson<DinariEntity>('/api/dinari/entity', { apiName: API });
}

export function createKycLink(name?: string): Promise<DinariKycLink> {
  return requestJson<DinariKycLink>('/api/dinari/kyc-link', {
    apiName: API,
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Account / wallet connection
// ─────────────────────────────────────────────────────────────────────────────

export function getAccount(): Promise<DinariAccount> {
  return requestJson<DinariAccount>('/api/dinari/account', { apiName: API });
}

export function getWalletNonce(
  walletAddress: string,
  chainId: string = DINARI_CHAIN_ID,
): Promise<DinariWalletNonce> {
  return requestJson<DinariWalletNonce>('/api/dinari/wallet/nonce', {
    apiName: API,
    method: 'POST',
    body: JSON.stringify({ walletAddress, chainId }),
  });
}

export function connectWallet(params: {
  walletAddress: string;
  nonce: string;
  signature: string;
  chainId?: string;
}): Promise<DinariAccount> {
  const { walletAddress, nonce, signature, chainId = DINARI_CHAIN_ID } = params;
  return requestJson<DinariAccount>('/api/dinari/wallet/connect', {
    apiName: API,
    method: 'POST',
    body: JSON.stringify({ walletAddress, chainId, nonce, signature }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Market data
// ─────────────────────────────────────────────────────────────────────────────

export function listStocks(params?: {
  symbols?: string[];
  page?: number;
  pageSize?: number;
}): Promise<DinariStock[]> {
  const qs = new URLSearchParams();
  if (params?.symbols?.length) qs.set('symbols', params.symbols.join(','));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return requestJson<DinariStock[]>(`/api/dinari/stocks${suffix}`, { apiName: API });
}

export function getStockPrice(stockId: string): Promise<DinariStockPrice> {
  return requestJson<DinariStockPrice>(`/api/dinari/stocks/${stockId}/price`, { apiName: API });
}

export function getStockQuote(stockId: string): Promise<DinariStockQuote> {
  return requestJson<DinariStockQuote>(`/api/dinari/stocks/${stockId}/quote`, { apiName: API });
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

export function prepareOrder(params: {
  side: OrderSide;
  stockId: string;
  /** BUY: USDC amount as a string. */
  paymentTokenQuantity?: string;
  /** SELL: dShare quantity as a string. */
  assetTokenQuantity?: string;
  clientOrderId?: string;
}): Promise<DinariPreparedOrder> {
  return requestJson<DinariPreparedOrder>('/api/dinari/orders/prepare', {
    apiName: API,
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function submitOrder(params: {
  orderRequestId: string;
  permitSignature: string;
}): Promise<DinariOrderResult> {
  return requestJson<DinariOrderResult>('/api/dinari/orders/submit', {
    apiName: API,
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function listOrders(): Promise<DinariOrderResult[]> {
  return requestJson<DinariOrderResult[]>('/api/dinari/orders', { apiName: API });
}

export function getOrderRequest(orderRequestId: string): Promise<DinariOrderResult> {
  return requestJson<DinariOrderResult>(`/api/dinari/order-requests/${orderRequestId}`, {
    apiName: API,
  });
}

export function getOrder(orderId: string): Promise<DinariOrderResult> {
  return requestJson<DinariOrderResult>(`/api/dinari/orders/${orderId}`, { apiName: API });
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio / cash / sandbox
// ─────────────────────────────────────────────────────────────────────────────

export function getPortfolio(): Promise<DinariPortfolio> {
  return requestJson<DinariPortfolio>('/api/dinari/portfolio', { apiName: API });
}

export function getCash(): Promise<DinariCash> {
  return requestJson<DinariCash>('/api/dinari/cash', { apiName: API });
}

export function sandboxFaucet(): Promise<{ minted: boolean }> {
  return requestJson<{ minted: boolean }>('/api/dinari/sandbox/faucet', {
    apiName: API,
    method: 'POST',
    body: JSON.stringify({}),
  });
}
