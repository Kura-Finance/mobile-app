/**
 * Li.Fi same-chain token swap on Base.
 * Uses the same /v1/quote endpoint with fromChain === toChain,
 * which Li.Fi routes through DEXes (Uniswap v3, Aerodrome, etc.) on Base.
 */

import { USDC_BASE } from '../../../features/card/config/cardWalletConfig';
import { LIFI_API, lifiHeaders, applyIntegratorParams } from '../bridge/lifiCommon';

const BASE_CHAIN_ID = 8453;

export interface SwapQuote {
  fromToken: { address: string; symbol: string; decimals: number };
  toToken: { address: string; symbol: string; decimals: number };
  fromAmount: string;
  /** Amount out (raw, in toToken decimals) */
  toAmount: string;
  /** Minimum amount out after slippage */
  toAmountMin: string;
  /** Estimated USD value of output */
  toAmountUSD?: string;
  /** Fee in USD */
  feeUSD: string;
  /** Tools/DEXes used */
  tools: string[];
  /** Approval spender (the Li.Fi router, must be USDC-approved before tx) */
  approvalAddress: string;
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  };
}

export async function fetchSwapQuote(params: {
  /** Amount of the source token in its base units — integer string */
  fromAmountWei: string;
  fromAddress: string;
  /**
   * ERC-20 address of the source token on Base.
   * Defaults to USDC (buy flow); pass a token address for the sell flow.
   */
  fromTokenAddress?: string;
  /** ERC-20 address of the destination token on Base */
  toTokenAddress: string;
  slippage?: number;
}): Promise<SwapQuote> {
  const {
    fromAmountWei,
    fromAddress,
    fromTokenAddress = USDC_BASE,
    toTokenAddress,
    slippage = 0.005,
  } = params;

  const qs = new URLSearchParams({
    fromChain: String(BASE_CHAIN_ID),
    toChain: String(BASE_CHAIN_ID),
    fromToken: fromTokenAddress,
    toToken: toTokenAddress,
    fromAmount: fromAmountWei,
    fromAddress,
    toAddress: fromAddress,
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
      `Li.Fi swap quote failed (${res.status})`;
    throw new Error(msg);
  }

  const tr = json.transactionRequest;
  if (!tr?.to || !tr?.data) {
    throw new Error('Unexpected Li.Fi response — missing transactionRequest');
  }

  const est = json.estimate ?? {};
  const feeCosts: any[] = est.feeCosts ?? [];
  const feeUSD = feeCosts
    .reduce((sum: number, f: any) => sum + parseFloat(f.amountUSD ?? '0'), 0)
    .toFixed(4);

  const tools: string[] = (json.includedSteps ?? [])
    .map((s: any) => s.tool as string)
    .filter(Boolean);

  return {
    fromToken: {
      address: json.action?.fromToken?.address ?? fromTokenAddress,
      symbol: json.action?.fromToken?.symbol ?? '',
      decimals: json.action?.fromToken?.decimals ?? 18,
    },
    toToken: {
      address: json.action?.toToken?.address ?? toTokenAddress,
      symbol: json.action?.toToken?.symbol ?? '',
      decimals: json.action?.toToken?.decimals ?? 18,
    },
    fromAmount: fromAmountWei,
    toAmount: est.toAmount ?? '0',
    toAmountMin: est.toAmountMin ?? '0',
    toAmountUSD: est.toAmountUSD,
    feeUSD,
    tools,
    approvalAddress: est.approvalAddress ?? tr.to,
    transactionRequest: {
      to: tr.to,
      data: tr.data,
      value: tr.value ?? '0x0',
      chainId: tr.chainId ?? BASE_CHAIN_ID,
      gasLimit: tr.gasLimit,
    },
  };
}
