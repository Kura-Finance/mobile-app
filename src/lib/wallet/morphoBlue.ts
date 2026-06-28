/**
 * Morpho Blue on Base — read helpers and transaction builders for borrow / repay.
 */
import { encodeFunctionData, erc20Abi, getAddress, isAddress, maxUint256, parseUnits } from 'viem';

import type { MorphoMarket } from '../api/morpho/markets';
import { getPublicClient, type SmartAccountCall } from './smartAccountClient';

/** Morpho Blue singleton — same address on Ethereum and Base. */
export const MORPHO_BLUE_ADDRESS =
  '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

export const ORACLE_PRICE_SCALE = 10n ** 36n;
export const WAD = 10n ** 18n;

const morphoOracleAbi = [
  {
    type: 'function',
    name: 'price',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const morphoBlueAbi = [
  {
    type: 'function',
    name: 'supplyCollateral',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'borrow',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repay',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawCollateral',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'market',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'totalSupplyAssets', type: 'uint128' },
          { name: 'totalSupplyShares', type: 'uint128' },
          { name: 'totalBorrowAssets', type: 'uint128' },
          { name: 'totalBorrowShares', type: 'uint128' },
          { name: 'lastUpdate', type: 'uint128' },
          { name: 'fee', type: 'uint128' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'position',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'supplyShares', type: 'uint256' },
      { name: 'borrowShares', type: 'uint128' },
      { name: 'collateral', type: 'uint128' },
    ],
  },
] as const;

export interface MorphoMarketParams {
  marketId: `0x${string}`;
  loanToken: `0x${string}`;
  collateralToken: `0x${string}`;
  oracle: `0x${string}`;
  irm: `0x${string}`;
  lltv: bigint;
  loanDecimals: number;
  collateralDecimals: number;
  loanSymbol: string;
  collateralSymbol: string;
}

export interface MorphoOnChainPosition {
  collateralRaw: bigint;
  borrowShares: bigint;
  collateralFormatted: number;
}

function amountToRaw(amount: number, decimals: number): bigint {
  const raw = amount.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
  return parseUnits(safe as `${number}`, decimals);
}

function marketParamsTuple(market: MorphoMarketParams) {
  return {
    loanToken: market.loanToken,
    collateralToken: market.collateralToken,
    oracle: market.oracle,
    irm: market.irm,
    lltv: market.lltv,
  } as const;
}

function requireAddress(value: string, label: string): `0x${string}` {
  if (!isAddress(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return getAddress(value);
}

export function toMorphoMarketParams(market: MorphoMarket): MorphoMarketParams {
  if (!market.oracleAddress || !market.irmAddress) {
    throw new Error('Market is missing oracle or IRM configuration.');
  }
  return {
    marketId: market.marketId as `0x${string}`,
    loanToken: requireAddress(market.loanAsset.address, 'Loan token'),
    collateralToken: requireAddress(market.collateralAsset.address, 'Collateral token'),
    oracle: requireAddress(market.oracleAddress, 'Oracle'),
    irm: requireAddress(market.irmAddress, 'IRM'),
    lltv: BigInt(market.lltv),
    loanDecimals: market.loanAsset.decimals,
    collateralDecimals: market.collateralAsset.decimals,
    loanSymbol: market.loanAsset.symbol,
    collateralSymbol: market.collateralAsset.symbol,
  };
}

export async function readMorphoOraclePrice(oracle: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: oracle,
    abi: morphoOracleAbi,
    functionName: 'price',
  }) as Promise<bigint>;
}

/** LTV = borrowRaw / collateralValueInLoan (0–1+ fraction). Returns 0 when no debt. */
export function computeMorphoLtvRatio(params: {
  borrowRaw: bigint;
  collateralRaw: bigint;
  oraclePrice: bigint;
}): number | null {
  const { borrowRaw, collateralRaw, oraclePrice } = params;
  if (borrowRaw <= 0n) return 0;
  if (collateralRaw <= 0n) return null;
  const collateralValueInLoan = (collateralRaw * oraclePrice) / ORACLE_PRICE_SCALE;
  if (collateralValueInLoan <= 0n) return null;
  return Number(borrowRaw) / Number(collateralValueInLoan);
}

export function isMorphoBorrowWithinLltv(params: {
  borrowRaw: bigint;
  collateralRaw: bigint;
  oraclePrice: bigint;
  lltv: bigint;
}): boolean {
  const { borrowRaw, collateralRaw, oraclePrice, lltv } = params;
  if (collateralRaw <= 0n || borrowRaw <= 0n) return borrowRaw <= 0n;
  const maxBorrow = computeMaxBorrowRaw({ collateralRaw, oraclePrice, lltv });
  return borrowRaw <= maxBorrow;
}

/** Max loan-token amount (raw) borrowable against collateral at max LLTV. */
export function computeMaxBorrowRaw(params: {
  collateralRaw: bigint;
  oraclePrice: bigint;
  lltv: bigint;
}): bigint {
  const { collateralRaw, oraclePrice, lltv } = params;
  if (collateralRaw <= 0n) return 0n;
  return ((collateralRaw * oraclePrice) / ORACLE_PRICE_SCALE) * lltv / WAD;
}

export function computeRemainingBorrowRaw(params: {
  collateralRaw: bigint;
  borrowRaw: bigint;
  oraclePrice: bigint;
  lltv: bigint;
}): bigint {
  const maxBorrow = computeMaxBorrowRaw(params);
  if (maxBorrow <= params.borrowRaw) return 0n;
  return maxBorrow - params.borrowRaw;
}

export function loanRawToAmount(raw: bigint, loanDecimals: number): number {
  return Number(raw) / 10 ** loanDecimals;
}

/** Round up shares → loan assets (Morpho `toAssetsUp`). */
export function sharesToAssetsUp(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  if (shares <= 0n || totalShares <= 0n) return 0n;
  return (shares * totalAssets + totalShares - 1n) / totalShares;
}

async function readMorphoMarketTotals(
  marketId: `0x${string}`,
): Promise<{ totalBorrowAssets: bigint; totalBorrowShares: bigint }> {
  const client = getPublicClient();
  const result = (await client.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: morphoBlueAbi,
    functionName: 'market',
    args: [marketId],
  })) as {
    totalBorrowAssets: bigint;
    totalBorrowShares: bigint;
  };

  return {
    totalBorrowAssets: BigInt(result.totalBorrowAssets),
    totalBorrowShares: BigInt(result.totalBorrowShares),
  };
}

/** On-chain borrow debt from shares (more accurate than indexed borrowAssets). */
export async function readMorphoBorrowDebtAssets(
  market: MorphoMarketParams,
  user: `0x${string}`,
): Promise<{ borrowShares: bigint; borrowAssetsRaw: bigint }> {
  const position = await readMorphoOnChainPosition(market, user);
  if (position.borrowShares <= 0n) {
    return { borrowShares: 0n, borrowAssetsRaw: 0n };
  }

  const totals = await readMorphoMarketTotals(market.marketId);
  return {
    borrowShares: position.borrowShares,
    borrowAssetsRaw: sharesToAssetsUp(
      position.borrowShares,
      totals.totalBorrowAssets,
      totals.totalBorrowShares,
    ),
  };
}

export interface MorphoUserPositionDisplay {
  borrowAssetsRaw: bigint;
  borrowAssetsUsd: number;
  collateralRaw: bigint;
  collateralFormatted: number;
  collateralUsd: number;
  borrowShares: bigint;
  hasDebt: boolean;
}

/** User position for UI — reads Morpho Blue on-chain (no indexer lag). */
export async function readMorphoUserPositionDisplay(
  market: MorphoMarketParams,
  user: `0x${string}`,
): Promise<MorphoUserPositionDisplay> {
  const mp = market;
  const [position, oraclePrice, debt] = await Promise.all([
    readMorphoOnChainPosition(mp, user),
    readMorphoOraclePrice(mp.oracle),
    readMorphoBorrowDebtAssets(mp, user),
  ]);

  const collateralValueLoanRaw = position.collateralRaw > 0n && oraclePrice > 0n
    ? (position.collateralRaw * oraclePrice) / ORACLE_PRICE_SCALE
    : 0n;

  return {
    borrowAssetsRaw: debt.borrowAssetsRaw,
    borrowAssetsUsd: loanRawToAmount(debt.borrowAssetsRaw, mp.loanDecimals),
    collateralRaw: position.collateralRaw,
    collateralFormatted: position.collateralFormatted,
    collateralUsd: loanRawToAmount(collateralValueLoanRaw, mp.loanDecimals),
    borrowShares: position.borrowShares,
    hasDebt: position.borrowShares > 0n,
  };
}

export async function readMorphoOnChainPosition(
  market: MorphoMarketParams,
  user: `0x${string}`,
): Promise<MorphoOnChainPosition> {
  const client = getPublicClient();
  const result = (await client.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: morphoBlueAbi,
    functionName: 'position',
    args: [market.marketId, user],
  })) as readonly [bigint, bigint, bigint];

  const collateralRaw = result[2];
  return {
    collateralRaw,
    borrowShares: result[1],
    collateralFormatted: Number(collateralRaw) / 10 ** market.collateralDecimals,
  };
}

async function appendApprovalIfNeeded(params: {
  calls: SmartAccountCall[];
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
  required: bigint;
}): Promise<void> {
  const { calls, token, owner, spender, required } = params;
  if (required <= 0n) return;

  const allowance = (await getPublicClient().readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  })) as bigint;

  if (allowance < required) {
    calls.push({
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, maxUint256],
      }),
    });
  }
}

export async function buildMorphoBorrowCalls(params: {
  market: MorphoMarketParams;
  collateralAmount: number;
  borrowAmount: number;
  onBehalf: `0x${string}`;
}): Promise<{ calls: SmartAccountCall[]; collateralRaw: bigint; borrowRaw: bigint }> {
  const { market, collateralAmount, borrowAmount, onBehalf } = params;
  const collateralRaw = amountToRaw(collateralAmount, market.collateralDecimals);
  const borrowRaw = amountToRaw(borrowAmount, market.loanDecimals);

  if (collateralRaw <= 0n && borrowRaw <= 0n) {
    throw new Error('Borrow or collateral amount must be greater than 0.');
  }

  const tuple = marketParamsTuple(market);
  const calls: SmartAccountCall[] = [];

  if (collateralRaw > 0n) {
    await appendApprovalIfNeeded({
      calls,
      token: market.collateralToken,
      owner: onBehalf,
      spender: MORPHO_BLUE_ADDRESS,
      required: collateralRaw,
    });

    calls.push({
      to: MORPHO_BLUE_ADDRESS,
      data: encodeFunctionData({
        abi: morphoBlueAbi,
        functionName: 'supplyCollateral',
        args: [tuple, collateralRaw, onBehalf, '0x'],
      }),
    });
  }

  if (borrowRaw > 0n) {
    if (collateralRaw <= 0n) {
      const position = await readMorphoOnChainPosition(market, onBehalf);
      if (position.collateralRaw <= 0n) {
        throw new Error('Collateral amount must be greater than 0.');
      }
    }

    calls.push({
      to: MORPHO_BLUE_ADDRESS,
      data: encodeFunctionData({
        abi: morphoBlueAbi,
        functionName: 'borrow',
        args: [tuple, borrowRaw, 0n, onBehalf, onBehalf],
      }),
    });
  }

  return { calls, collateralRaw, borrowRaw };
}

export async function buildMorphoRepayCalls(params: {
  market: MorphoMarketParams;
  onBehalf: `0x${string}`;
  repayAmount?: number;
  /** Repay full debt via borrowShares — avoids rounding dust on Morpho. */
  repayAll?: boolean;
}): Promise<{ calls: SmartAccountCall[]; repayRaw: bigint }> {
  const { market, onBehalf, repayAmount = 0, repayAll = false } = params;
  const position = await readMorphoOnChainPosition(market, onBehalf);
  if (position.borrowShares <= 0n) {
    throw new Error('No outstanding debt.');
  }

  const tuple = marketParamsTuple(market);
  const calls: SmartAccountCall[] = [];

  if (repayAll) {
    const totals = await readMorphoMarketTotals(market.marketId);
    const repayRaw = sharesToAssetsUp(
      position.borrowShares,
      totals.totalBorrowAssets,
      totals.totalBorrowShares,
    );
    // Buffer for interest accrued between read and inclusion.
    const approvalAmount = repayRaw + 1000n;

    await appendApprovalIfNeeded({
      calls,
      token: market.loanToken,
      owner: onBehalf,
      spender: MORPHO_BLUE_ADDRESS,
      required: approvalAmount,
    });

    calls.push({
      to: MORPHO_BLUE_ADDRESS,
      data: encodeFunctionData({
        abi: morphoBlueAbi,
        functionName: 'repay',
        args: [tuple, 0n, position.borrowShares, onBehalf, '0x'],
      }),
    });

    return { calls, repayRaw };
  }

  const repayRaw = amountToRaw(repayAmount, market.loanDecimals);
  if (repayRaw <= 0n) throw new Error('Repay amount must be greater than 0.');

  await appendApprovalIfNeeded({
    calls,
    token: market.loanToken,
    owner: onBehalf,
    spender: MORPHO_BLUE_ADDRESS,
    required: repayRaw,
  });

  calls.push({
    to: MORPHO_BLUE_ADDRESS,
    data: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: 'repay',
      args: [tuple, repayRaw, 0n, onBehalf, '0x'],
    }),
  });

  return { calls, repayRaw };
}

export async function buildMorphoWithdrawCollateralCalls(params: {
  market: MorphoMarketParams;
  withdrawAmount: number;
  onBehalf: `0x${string}`;
  receiver: `0x${string}`;
}): Promise<{ calls: SmartAccountCall[]; withdrawRaw: bigint }> {
  const { market, withdrawAmount, onBehalf, receiver } = params;
  const withdrawRaw = amountToRaw(withdrawAmount, market.collateralDecimals);
  if (withdrawRaw <= 0n) throw new Error('Withdraw amount must be greater than 0.');

  const position = await readMorphoOnChainPosition(market, onBehalf);
  if (position.borrowShares > 0n) {
    throw new Error('Repay outstanding debt before withdrawing collateral.');
  }
  if (position.collateralRaw < withdrawRaw) {
    throw new Error('Insufficient collateral in market position.');
  }

  const tuple = marketParamsTuple(market);
  const calls: SmartAccountCall[] = [{
    to: MORPHO_BLUE_ADDRESS,
    data: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: 'withdrawCollateral',
      args: [tuple, withdrawRaw, onBehalf, receiver],
    }),
  }];

  return { calls, withdrawRaw };
}

export type MorphoBorrowTxParams = {
  market: MorphoMarket;
  collateralAmount: number;
  borrowAmount: number;
};

export type MorphoRepayTxParams = {
  market: MorphoMarket;
  repayAmount?: number;
  repayAll?: boolean;
};

export type MorphoWithdrawCollateralTxParams = {
  market: MorphoMarket;
  withdrawAmount: number;
};
