/**
 * Li.Fi Bridge API client — cross-chain USDC transfers via aggregated bridges.
 * API key + integrator fee are optional and configured in `lifiCommon`.
 * Docs: https://docs.li.fi/li.fi-api/li.fi-api
 */

import { LIFI_API, lifiHeaders, applyIntegratorParams, LIFI_DEFAULT_SLIPPAGE } from "../bridge/lifiCommon";

// ─────────────────────────────────────────────────────────────────────────────
// Supported destination chains 
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeChain {
  id: number;
  key: string;
  name: string;
  /** Native currency symbol */
  native: string;
  /** Brand color (hex) */
  color: string;
  /** Token colour for USDC display on that chain */
  logoIon: string;
}

export const BASE_CHAIN_ID = 8453;
export const GNOSIS_CHAIN_ID = 100;

/** Canonical USDC on each supported chain (Li.Fi `fromToken` / `toToken`). */
const USDC_BY_CHAIN: Record<number, string> = {
  [BASE_CHAIN_ID]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813c4aa29D760963A1E5885780D5',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  [GNOSIS_CHAIN_ID]: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
};

export const BRIDGE_CHAINS: BridgeChain[] = [
  { id:  1,     key: 'ETH', name: 'Ethereum', native: 'ETH',  color: '#627EEA', logoIon: 'logo-ethereum'   },
  { id: 10,     key: 'OP',  name: 'Optimism', native: 'ETH',  color: '#FF0420', logoIon: 'flash-outline'   },
  { id: 137,    key: 'POL', name: 'Polygon',  native: 'POL',  color: '#8247E5', logoIon: 'triangle-outline'},
  { id: 42161,  key: 'ARB', name: 'Arbitrum', native: 'ETH',  color: '#28A0F0', logoIon: 'layers-outline'  },
  { id: GNOSIS_CHAIN_ID, key: 'GNO', name: 'Gnosis', native: 'xDAI', color: '#04795B', logoIon: 'infinite-outline' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types (minimal subset of Li.Fi v1 quote response used by the app)
// ─────────────────────────────────────────────────────────────────────────────

export interface LiFiFeeCost {
  name: string;
  amount: string;
  amountUSD: string;
  token: { symbol: string; decimals: number };
}

export interface LiFiEstimate {
  toAmount: string;
  toAmountMin: string;
  toAmountUSD?: string;
  estimatedExecutionDuration?: number;
  feeCosts: LiFiFeeCost[];
  approvalAddress?: string;
}

export interface LiFiTransactionRequest {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  gasPrice?: string;
}

export interface LiFiBridgeQuote {
  /** Approval spender address — must be approved before calling transactionRequest */
  approvalAddress: string;
  fromAmount: string;
  fromToken: { address: string; symbol: string; decimals: number };
  toToken: { address: string; symbol: string; decimals: number; chainId: number };
  estimate: LiFiEstimate;
  transactionRequest: LiFiTransactionRequest;
  /** Which bridge tools are used, e.g. ["across"] */
  tools: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchBridgeQuote(params: {
  fromChainId: number;
  toChainId: number;
  /** Sell amount in USDC base units (6 decimals) — integer string */
  fromAmountWei: string;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
}): Promise<LiFiBridgeQuote> {
  const { fromChainId, toChainId, fromAmountWei, fromAddress, toAddress, slippage = LIFI_DEFAULT_SLIPPAGE } = params;

  const fromToken = USDC_BY_CHAIN[fromChainId] ?? 'USDC';
  const toToken = USDC_BY_CHAIN[toChainId] ?? 'USDC';

  const qs = new URLSearchParams({
    fromChain: String(fromChainId),
    toChain: String(toChainId),
    fromToken,
    toToken,
    fromAmount: fromAmountWei,
    fromAddress,
    toAddress,
    slippage: String(slippage),
  });
  applyIntegratorParams(qs);

  const res = await fetch(`${LIFI_API}/quote?${qs.toString()}`, {
    headers: lifiHeaders(),
  });

  const json = await res.json();

  if (!res.ok) {
    const msg =
      (json as any)?.message ??
      (json as any)?.errors?.[0]?.message ??
      `Li.Fi quote failed (${res.status})`;
    throw new Error(msg);
  }

  // Validate minimal shape
  const tr = json.transactionRequest;
  if (!tr?.to || !tr?.data) {
    throw new Error('Unexpected Li.Fi quote response — missing transaction request');
  }

  const est: LiFiEstimate = {
    toAmount: json.estimate?.toAmount ?? '0',
    toAmountMin: json.estimate?.toAmountMin ?? '0',
    toAmountUSD: json.estimate?.toAmountUSD,
    estimatedExecutionDuration: json.estimate?.estimatedExecutionDuration,
    feeCosts: (json.estimate?.feeCosts ?? []).map((f: any) => ({
      name: f.name ?? '',
      amount: f.amount ?? '0',
      amountUSD: f.amountUSD ?? '0',
      token: { symbol: f.token?.symbol ?? 'USDC', decimals: f.token?.decimals ?? 6 },
    })),
    approvalAddress: json.estimate?.approvalAddress ?? tr.to,
  };

  const steps: string[] = (json.includedSteps ?? [])
    .map((s: any) => s.tool as string)
    .filter(Boolean);

  return {
    approvalAddress: est.approvalAddress ?? tr.to,
    fromAmount: fromAmountWei,
    fromToken: {
      address: json.action?.fromToken?.address ?? '',
      symbol: json.action?.fromToken?.symbol ?? 'USDC',
      decimals: json.action?.fromToken?.decimals ?? 6,
    },
    toToken: {
      address: json.action?.toToken?.address ?? '',
      symbol: json.action?.toToken?.symbol ?? 'USDC',
      decimals: json.action?.toToken?.decimals ?? 6,
      chainId: toChainId,
    },
    estimate: est,
    transactionRequest: {
      to: tr.to,
      data: tr.data,
      value: tr.value ?? '0x0',
      chainId: tr.chainId ?? fromChainId,
      gasLimit: tr.gasLimit,
      gasPrice: tr.gasPrice,
    },
    tools: steps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatBridgeReceive(quote: LiFiBridgeQuote): string {
  try {
    const decimals = quote.toToken.decimals;
    const amount = parseFloat(quote.estimate.toAmountMin) / Math.pow(10, decimals);
    return amount.toFixed(2);
  } catch {
    return '—';
  }
}

export function formatBridgeFeeTotal(quote: LiFiBridgeQuote): string {
  const total = bridgeFeeUsdTotal(quote);
  if (total <= 0) return '$0.00';
  return `$${total.toFixed(4)}`;
}

/** Total Li.Fi bridge/protocol fees in USD (excludes on-chain gas). */
export function bridgeFeeUsdTotal(quote: LiFiBridgeQuote): number {
  try {
    return quote.estimate.feeCosts.reduce((s, f) => {
      const decimals = f.token.decimals;
      return s + parseFloat(f.amount) / Math.pow(10, decimals);
    }, 0);
  } catch {
    return 0;
  }
}

export function hasBridgeFee(quote: LiFiBridgeQuote): boolean {
  return bridgeFeeUsdTotal(quote) > 0.000001;
}

export function formatBridgeTime(quote: LiFiBridgeQuote): string {
  const secs = quote.estimate.estimatedExecutionDuration;
  if (!secs) return '~2 min';
  if (secs < 60) return `~${secs}s`;
  return `~${Math.ceil(secs / 60)} min`;
}
